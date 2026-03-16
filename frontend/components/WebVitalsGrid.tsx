'use client';

import { motion } from 'framer-motion';
import { Activity, Layout, Zap, AlertCircle, CheckCircle, Paintbrush as PaintBrush, FastForward, MousePointer, Server } from 'lucide-react';
import clsx from 'clsx';

interface AuditData {
    id: string;
    title: string;
    displayValue: string;
    score: number | null;
    numericValue: number;
    details?: {
        items?: { data: string; timing: number }[];
    };
}

export interface WebVitalsGridProps {
    audits: {
        'largest-contentful-paint'?: AuditData;
        'cumulative-layout-shift'?: AuditData;
        'interaction-to-next-paint'?: AuditData;
        'total-blocking-time'?: AuditData;
        'first-contentful-paint'?: AuditData;
        'speed-index'?: AuditData;
        'interactive'?: AuditData;
        'server-response-time'?: AuditData;
    };
}

type Severity = 'good' | 'needs-improvement' | 'poor';

/**
 * Calculates severity based on official Google Core Web Vitals thresholds (2024).
 */
const getSeverity = (id: string, value: number, isTBTFallback?: boolean): Severity => {
    if (isTBTFallback) {
        // TBT Lab thresholds: Good <= 200ms, NI <= 600ms
        if (value <= 200) return 'good';
        if (value <= 600) return 'needs-improvement';
        return 'poor';
    }

    switch (id) {
        case 'lcp':
            // Thresholds: Good <= 2.5s (2500ms), NI <= 4.0s (4000ms)
            if (value <= 2500) return 'good';
            if (value <= 4000) return 'needs-improvement';
            return 'poor';
        case 'inp':
            // Thresholds: Good <= 200ms, NI <= 500ms
            if (value <= 200) return 'good';
            if (value <= 500) return 'needs-improvement';
            return 'poor';
        case 'cls':
            // Thresholds: Good <= 0.1, NI <= 0.25
            if (value <= 0.1) return 'good';
            if (value <= 0.25) return 'needs-improvement';
            return 'poor';
        case 'fcp':
            // Thresholds: Good <= 1.8s (1800ms), NI <= 3.0s (3000ms)
            if (value <= 1800) return 'good';
            if (value <= 3000) return 'needs-improvement';
            return 'poor';
        case 'si':
            // Thresholds: Good <= 3.4s (3400ms), NI <= 5.8s (5800ms)
            if (value <= 3400) return 'good';
            if (value <= 5800) return 'needs-improvement';
            return 'poor';
        case 'tti':
            // Thresholds: Good <= 3.8s (3800ms), NI <= 7.3s (7300ms)
            if (value <= 3800) return 'good';
            if (value <= 7300) return 'needs-improvement';
            return 'poor';
        case 'ttfb':
            // Thresholds: Good <= 800ms, NI <= 1800ms
            if (value <= 800) return 'good';
            if (value <= 1800) return 'needs-improvement';
            return 'poor';
        default:
            return 'poor';
    }
};

export default function WebVitalsGrid({ audits }: WebVitalsGridProps) {
    if (!audits) return null;

    // INP is often missing in simulated Lab flow; we fallback to TBT as the standard interactivity proxy
    const inpAudit = audits['interaction-to-next-paint'] as AuditData | undefined;
    const tbtAudit = audits['total-blocking-time'] as AuditData | undefined;
    const isTBTFallback = !inpAudit && !!tbtAudit;
    const finalInteractivityData = inpAudit || tbtAudit;

    const vitals = [
        {
            id: 'lcp',
            title: 'Largest Contentful Paint',
            short: 'LCP',
            data: audits['largest-contentful-paint'] as AuditData | undefined,
            icon: ImageLayer,
            description: 'Render time of the largest image or text block.'
        },
        {
            id: 'inp',
            title: isTBTFallback ? 'Total Blocking Time (INP Proxy)' : 'Interaction to Next Paint',
            short: isTBTFallback ? 'TBT' : 'INP',
            data: finalInteractivityData,
            icon: Zap,
            isFallback: isTBTFallback,
            description: isTBTFallback
                ? 'Sum of all periods between FCP and Time to Interactive.'
                : 'Measures how quickly the page responds to user interactions.'
        },
        {
            id: 'cls',
            title: 'Cumulative Layout Shift',
            short: 'CLS',
            data: audits['cumulative-layout-shift'] as AuditData | undefined,
            icon: Layout,
            description: 'Movement of visible elements within the viewport.'
        },
        {
            id: 'fcp',
            title: 'First Contentful Paint',
            short: 'FCP',
            data: audits['first-contentful-paint'] as AuditData | undefined,
            icon: PaintBrush,
            description: 'First text or image painted.'
        },
        {
            id: 'si',
            title: 'Speed Index',
            short: 'SI',
            data: audits['speed-index'] as AuditData | undefined,
            icon: FastForward,
            description: 'How quickly content is visually populated.'
        },
        {
            id: 'tti',
            title: 'Time to Interactive',
            short: 'TTI',
            data: audits['interactive'] as AuditData | undefined,
            icon: MousePointer,
            description: 'Time until page is fully interactive.'
        },
        {
            id: 'ttfb',
            title: 'Time to First Byte',
            short: 'TTFB',
            data: audits['server-response-time'] as AuditData | undefined,
            icon: Server,
            description: 'Time taken for the server to respond.'
        }
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <h3 className="text-xl font-black uppercase tracking-tighter italic">Web Vitals</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {vitals.map((vital, index) => {
                    if (!vital.data) return null;

                    const severity = getSeverity(vital.id, vital.data.numericValue, vital.isFallback);
                    const Icon = vital.icon;

                    return (
                        <motion.div
                            key={vital.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.2 + (index * 0.1) }}
                            className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm relative overflow-hidden group"
                        >
                            {/* Top Accent Line */}
                            <div className={clsx(
                                "absolute top-0 left-0 right-0 h-1",
                                severity === 'good' && "bg-emerald-500",
                                severity === 'needs-improvement' && "bg-amber-500",
                                severity === 'poor' && "bg-red-500",
                            )} />

                            <div className="flex items-center justify-between mb-4 mt-1">
                                <div className="flex items-center gap-2">
                                    <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg text-zinc-600 dark:text-zinc-400">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{vital.short}</span>
                                    </div>
                                </div>

                                {severity === 'good' ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <AlertCircle className={clsx("w-5 h-5", severity === 'poor' ? "text-red-500" : "text-amber-500")} />
                                )}
                            </div>

                            <div className="mb-2">
                                <span className={clsx(
                                    "text-2xl font-bold tracking-tight",
                                    severity === 'good' && "text-emerald-600 dark:text-emerald-400",
                                    severity === 'needs-improvement' && "text-amber-600 dark:text-amber-400",
                                    severity === 'poor' && "text-red-600 dark:text-red-400",
                                )}>
                                    {vital.data.displayValue}
                                </span>
                            </div>

                            <div className="text-sm text-zinc-500 dark:text-zinc-400 h-10 line-clamp-2">
                                {vital.description}
                            </div>

                            {/* Status Badge */}
                            <div className="mt-4 flex">
                                <span className={clsx(
                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded",
                                    severity === 'good' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400",
                                    severity === 'needs-improvement' && "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
                                    severity === 'poor' && "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
                                )}>
                                    {severity.replace('-', ' ')}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// Image icon for LCP
const ImageLayer = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
);
