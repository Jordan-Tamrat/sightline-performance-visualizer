'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Loader2, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { getOrCreateUserIdentifier } from '@/lib/user';

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLatestReport = async () => {
            try {
                const userId = getOrCreateUserIdentifier();
                if (!userId) {
                    setLoading(false);
                    return;
                }

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const response = await axios.get(`${apiUrl}/api/reports/history/?user_identifier=${userId}`);

                const reports = response.data;
                if (reports && reports.length > 0) {
                    // Redirect to the most recent report (the first one)
                    router.replace(`/results/${reports[0].id}`);
                } else {
                    setLoading(false);
                }
            } catch (err: unknown) {
                console.error('Failed to fetch latest report:', err);
                setError('Failed to fetch your dashboard. Please try again later.');
                setLoading(false);
            }
        };

        fetchLatestReport();
    }, [router]);

    if (loading) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center p-8 text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                <p>Loading your dashboard...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen p-12 max-w-7xl mx-auto flex flex-col items-center justify-center text-center">
                <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-2xl text-red-600 dark:text-red-400 max-w-lg">
                    <p>{error}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-12 max-w-7xl mx-auto flex flex-col items-center justify-center text-center">
            <div className="py-24 px-8 bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <LayoutDashboard className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Welcome to your Dashboard</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-10">
                    You haven't run any audits yet! Your latest full report will automatically appear here once you run one.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-blue-600 text-white font-medium transition-all hover:bg-blue-500 shadow-sm"
                >
                    Run an Audit
                </Link>
            </div>
        </main>
    );
}
