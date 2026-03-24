import { NextResponse } from 'next/server';

/**
 * Vercel Cron handler: called once per day at midnight UTC.
 * It proxies the request to the Django backend cleanup endpoint,
 * passing the CRON_SECRET for authentication.
 * 
 * This route runs at POST /api/cron/cleanup on Vercel.
 */
export async function GET() {
  const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!backendUrl || !cronSecret) {
    return NextResponse.json(
      { error: 'INTERNAL_API_URL or CRON_SECRET not configured.' },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${backendUrl}/api/cron/cleanup/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: 'Backend cleanup failed', detail: data }, { status: response.status });
    }

    return NextResponse.json({ status: 'Cleanup complete', ...data });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reach backend', detail: String(err) }, { status: 500 });
  }
}
