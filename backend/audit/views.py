from rest_framework import viewsets, throttling
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from django.http import JsonResponse
from django.views import View
from .models import Report, SharedReport
from .serializers import ReportSerializer, SharedReportSerializer
from .tasks import run_audit, cleanup_old_reports, cleanup_expired_shares

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all().order_by('-created_at')
    serializer_class = ReportSerializer
    
    def get_throttles(self):
        if self.action == 'create':
            self.throttle_scope = 'audit_create'
            return [throttling.ScopedRateThrottle()]
        return []

    def perform_create(self, serializer):
        report = serializer.save()
        run_audit.delay(report.id)

    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        """Generates a shareable link that expires in 15 days."""
        report = self.get_object()
        
        # Validate ownership
        user_identifier = request.data.get('user_identifier')
        if report.user_identifier and user_identifier != report.user_identifier:
            return Response({'error': 'Unauthorized to share this report.'}, status=403)
            
        # Check for existing active share
        existing_share = SharedReport.objects.filter(
            report=report,
            is_active=True,
            expires_at__gt=timezone.now()
        ).first()

        if existing_share:
            share_url = f"{settings.BASE_URL}/share/{existing_share.share_token}"
            return Response({
                'share_url': share_url,
                'expires_at': existing_share.expires_at
            })

        shared_report = SharedReport.objects.create(
            report=report,
            expires_at=timezone.now() + timedelta(days=15)
        )
        
        share_url = f"{settings.BASE_URL}/share/{shared_report.share_token}"
        return Response({
            'share_url': share_url,
            'expires_at': shared_report.expires_at
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        """
        Returns a list of reports matching the provided user_identifier.
        Expects ?user_identifier=<uuid> query parameter.
        """
        user_identifier = request.query_params.get('user_identifier')
        if not user_identifier:
            return Response({'error': 'user_identifier parameter is required'}, status=400)

        # Filter reports by user_identifier, order by newest first, limit to last 20
        reports = Report.objects.filter(user_identifier=user_identifier).order_by('-created_at')[:20]
        
        # Serialize only the fields needed for the history table
        data = [
            {
                'id': r.id,
                'url': r.url,
                'device_type': r.device_type,
                'network_type': r.network_type,
                'performance_score': r.performance_score,
                'created_at': r.created_at,
            }
            for r in reports
        ]
        return Response(data)

    @action(detail=True, methods=['get'])
    def filmstrip(self, request, pk=None):
        """
        Extracts screenshots from the Lighthouse trace events stored in the JSON report.
        Returns a list of frames with timing and base64 data.
        """
        report = self.get_object()
        lighthouse_data = report.lighthouse_json or {}
        
        # Check if trace data exists (new format)
        trace_events = lighthouse_data.get('trace_screenshots', [])
        
        if not trace_events:
            # Fallback for old reports or failed trace extraction: return empty list
            return Response({'frames': []})
            
        # Find start time (navigationStart)
        # We try to find the 'firstContentfulPaint' event to calibrate the start time perfectly.
        # This solves the "drift" where filmstrip timestamps don't match the metric cards.
        
        start_ts = None
        fcp_event_ts = None
        
        for event in trace_events:
            if event.get('name') == 'firstContentfulPaint':
                fcp_event_ts = event.get('ts')
                break
                
        # If we found FCP event in trace, use it to back-calculate start_ts
        if fcp_event_ts:
            # Get the FCP metric value from the audit
            fcp_audit = lighthouse_data.get('audits', {}).get('first-contentful-paint', {})
            fcp_value_ms = fcp_audit.get('numericValue')
            
            if fcp_value_ms:
                # Calculate what start_ts SHOULD be to make FCP align
                # event_ts - start_ts = fcp_value_us
                # start_ts = event_ts - (fcp_value_ms * 1000)
                start_ts = fcp_event_ts - (fcp_value_ms * 1000)
        
        # Fallback to standard navigationStart logic if calibration fails
        if start_ts is None:
            # Sort events by TS to ensure we pick earliest
            trace_events.sort(key=lambda x: x.get('ts', 0))
            
            for event in trace_events:
                if event.get('name') == 'navigationStart':
                    start_ts = event.get('ts')
                    break
            
            if start_ts is None:
                for event in trace_events:
                    if event.get('name') == 'TracingStartedInBrowser':
                        start_ts = event.get('ts')
                        break
                        
            if start_ts is None:
                 screenshots = [e for e in trace_events if e.get('name') == 'Screenshot']
                 if screenshots:
                     start_ts = screenshots[0].get('ts')
                 else:
                     return Response({'frames': []})

        frames = []
        seen_timings = set()
        
        # Sort events first to process in order
        screenshot_events = [e for e in trace_events if e.get('name') == 'Screenshot']
        screenshot_events.sort(key=lambda x: x.get('ts', 0))

        for event in screenshot_events:
            ts = event.get('ts', 0)
            # Calculate timing in milliseconds (trace events are in microseconds)
            timing_ms = (ts - start_ts) / 1000
            
            # Ensure non-negative timing
            if timing_ms < 0:
                timing_ms = 0
            
            # Round to nearest 100ms (0.1s) to normalize
            normalized_timing = round(timing_ms / 100) * 100
            
            # Skip if we already have a frame for this 0.1s slot
            if normalized_timing in seen_timings:
                continue
                
            snapshot = event.get('args', {}).get('snapshot')
            if snapshot:
                frames.append({
                    'timing': normalized_timing,
                    'data': f"data:image/jpeg;base64,{snapshot}"
                })
                seen_timings.add(normalized_timing)
        
        # Fill gaps logic:
        # If there's a gap > 500ms, we might want to fill it, but Lighthouse usually captures enough frames.
        # The user's complaint "jumps from 0.4 to 2.1" suggests the page was blocked or doing nothing visible.
        # However, to ensure a smooth filmstrip, we should just return what we captured,
        # but deduplicated by the 100ms window.
        
        # Sort frames by timing just in case
        frames.sort(key=lambda x: x['timing'])
        
        # Logic to ensure continuity:
        # If we have a large gap (e.g. 0.4s to 2.1s), it usually means the screen didn't change.
        # We can optionally fill these gaps with the previous frame to show "nothing happened".
        # Let's fill gaps > 500ms with intermediate frames every 500ms
        
        filled_frames = []
        if frames:
            # Check if the first frame is > 0s (e.g. 1.5s)
            # If so, we should backfill from 0s to that first frame with a blank/white frame
            # OR just duplicate the first frame if it looks blank?
            # But the first frame usually IS blank or has partial content.
            # If it starts at 1.5s, it means Lighthouse didn't capture any screenshot before 1.5s.
            # This implies the screen was static (probably white) from 0s to 1.5s.
            
            # Let's create a synthetic blank frame at 0s if needed.
            # Or duplicate the first frame at 0s?
            first_frame = frames[0]
            if first_frame['timing'] > 500: # If gap > 500ms at start
                # Create a 0s frame. Ideally this is a white/transparent frame.
                # But we don't have a white image base64 handy easily without hardcoding.
                # A 1x1 white pixel base64:
                # data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII=
                
                # Wait, if the first captured frame is at 1.5s, it's likely the first PAINT.
                # The frames before it were likely blank.
                
                # Let's insert a white frame at 0s.
                white_pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII="
                
                filled_frames.append({
                    'timing': 0,
                    'data': white_pixel
                })
                
                # Fill gap from 0 to first_frame['timing']
                current_fill_time = 500
                while current_fill_time < first_frame['timing']:
                     filled_frames.append({
                         'timing': current_fill_time,
                         'data': white_pixel
                     })
                     current_fill_time += 500
            
            filled_frames.append(first_frame)
            
            for i in range(1, len(frames)):
                prev = filled_frames[-1]
                curr = frames[i]
                
                # If gap > 500ms, add intermediate frames
                gap = curr['timing'] - prev['timing']
                if gap > 500:
                    # e.g., 0.4 to 2.1, gap = 1700
                    # we want to fill at 0.9, 1.4, 1.9
                    current_fill_time = prev['timing'] + 500
                    while current_fill_time < curr['timing']:
                         filled_frames.append({
                             'timing': current_fill_time,
                             'data': prev['data']
                         })
                         current_fill_time += 500
                
                filled_frames.append(curr)
                
        return Response({'frames': filled_frames})

class SharedReportView(APIView):
    throttle_classes = []
    
    def get(self, request, token):
        shared_report = get_object_or_404(SharedReport, share_token=token)
        
        if not shared_report.is_active:
            return Response({'error': 'This share link has been revoked.'}, status=403)
            
        if timezone.now() > shared_report.expires_at:
            return Response({'error': 'This share link has expired.'}, status=410)
            
        shared_report.views += 1
        shared_report.save(update_fields=['views'])
        
        # Return associated report data
        serializer = SharedReportSerializer(shared_report)
        return Response(serializer.data)

    def delete(self, request, token):
        shared_report = get_object_or_404(SharedReport, share_token=token)
        shared_report.is_active = False
        shared_report.save(update_fields=['is_active'])
        return Response({'message': 'Share link revoked successfully.'})


class CronCleanupView(View):
    """
    Protected endpoint called by Vercel Cron (or any external scheduler) once per day.
    Runs both cleanup tasks directly without needing Celery Beat.

    Security: Requires the Authorization header to match the CRON_SECRET env variable.
    Vercel sets this automatically when you define 'Authorization' in vercel.json crons.
    """
    def post(self, request):
        expected_secret = getattr(settings, 'CRON_SECRET', None)

        # Reject requests without a configured secret
        if not expected_secret:
            return JsonResponse({'error': 'Cron endpoint is not configured.'}, status=503)

        # Validate Authorization header: "Bearer <token>"
        auth_header = request.headers.get('Authorization', '')
        if auth_header != f'Bearer {expected_secret}':
            return JsonResponse({'error': 'Unauthorized.'}, status=401)

        # Run cleanups directly (no Celery needed for scheduled tasks)
        reports_result = cleanup_old_reports()
        shares_result = cleanup_expired_shares()

        return JsonResponse({
            'status': 'ok',
            'reports': reports_result,
            'shares': shares_result,
        })

