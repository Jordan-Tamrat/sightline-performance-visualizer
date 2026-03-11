'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Smartphone, Wifi, Signal, ArrowRight, Loader2, Clock, Share2 } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { getOrCreateUserIdentifier } from '@/lib/user';

interface Report {
    id: string;
    url: string;
    device_type: 'desktop' | 'mobile';
    network_type: '4g' | 'fast3g' | 'slow3g';
    performance_score: number | null;
    created_at: string;
}

export default function HistoryPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const userId = getOrCreateUserIdentifier();
                if (!userId) {
                    setLoading(false);
                    return;
                }

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const response = await axios.get(`${apiUrl}/api/reports/history/?user_identifier=${userId}`);
                setReports(response.data);
            } catch (err: unknown) {
                console.error('Failed to fetch history:', err);
                setError('Failed to load your audit history. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const getNetworkIcon = (type: string) => {
        switch (type) {
            case '4g': return <Wifi className="w-4 h-4" />;
            case 'fast3g': return <Signal className="w-4 h-4" />;
            case 'slow3g': return <Signal className="w-3 h-3" />;
            default: return <Wifi className="w-4 h-4" />;
        }
    };

    const getNetworkLabel = (type: string) => {
        switch (type) {
            case '4g': return '4G';
            case 'fast3g': return 'Fast 3G';
            case 'slow3g': return 'Slow 3G';
            default: return type.toUpperCase();
        }
    };

    const getScoreColor = (score: number | null) => {
        if (score === null) return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
        if (score >= 90) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
        if (score >= 50) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
        return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
    };

    return (
        <main className="min-h-screen p-8 md:p-12 max-w-7xl mx-auto">
            <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 border-b-2 border-transparent relative inline-block">
                        Dashboard History
                        <div className="absolute -bottom-1 left-0 w-1/3 h-1 bg-blue-500 rounded-full"></div>
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                        Your previous autonomous audits are saved anonymously below.
                    </p>
                </div>

                <Link
                    href="/"
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-sm"
                >
                    Run New Audit <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 text-zinc-500">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p>Loading your audit history...</p>
                </div>
            ) : error ? (
                <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-2xl text-red-600 dark:text-red-400">
                    <p>{error}</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center py-24 px-4 bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Clock className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No audits found</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm mx-auto">
                        You havent generated any performance audits on this device yet.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium transition-all hover:scale-105"
                    >
                        Start your first audit
                    </Link>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 text-sm font-medium border-b border-zinc-200 dark:border-zinc-800">
                                    <th className="px-6 py-4 font-medium tracking-wide">Target URL</th>
                                    <th className="px-6 py-4 font-medium tracking-wide">Configuration</th>
                                    <th className="px-6 py-4 font-medium tracking-wide">Performance</th>
                                    <th className="px-6 py-4 font-medium tracking-wide">Date & Time</th>
                                    <th className="px-6 py-4 font-medium tracking-wide text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {reports.map((report) => (
                                    <tr key={report.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2 max-w-xs truncate">
                                                {report.url.replace(/^https?:\/\//, '')}
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-500 font-mono mt-1 w-full truncate max-w-xs" style={{ direction: 'rtl', textOverflow: 'clip' }}>
                                                {report.id}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-300">
                                                    {report.device_type === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                                                    {report.device_type}
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-300">
                                                    {getNetworkIcon(report.network_type)}
                                                    {getNetworkLabel(report.network_type)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            {report.performance_score !== null ? (
                                                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 font-bold ${getScoreColor(report.performance_score)}`}>
                                                    {report.performance_score}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-zinc-400">Failed / Processing</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(report.created_at))}
                                            <span className="mx-2 text-zinc-300 dark:text-zinc-700">•</span>
                                            {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(report.created_at))}
                                        </td>
                                        <td className="px-6 py-5 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/results/${report.id}`}
                                                    className="inline-flex items-center justify-center p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                    title="View Report"
                                                >
                                                    <ArrowRight className="w-5 h-5" />
                                                </Link>
                                                <Link
                                                    href={`/results/${report.id}?share=true`}
                                                    className="inline-flex items-center justify-center p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                                    title="Share Report"
                                                >
                                                    <Share2 className="w-5 h-5" />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </main>
    );
}
