'use client';

import { useEffect, useState, use } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import clsx from 'clsx';

// Gauge Component (Inline for simplicity if import fails, but I'll try to import)
// import Gauge from '@/components/Gauge'; 
// Since I'm not sure if alias works without tsconfig paths setup (which usually is setup by create-next-app), I'll try relative import.
import Gauge from '../../../components/Gauge';

interface Report {
  id: number;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  performance_score: number | null;
  lighthouse_json: any;
  ai_summary: string | null;
  screenshot: string | null;
  created_at: string;
}

export default function ResultPage() {
  const params = useParams();
  const id = params?.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    let intervalId: NodeJS.Timeout;

    const fetchReport = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await axios.get(`${apiUrl}/api/reports/${id}/`);
        const data = response.data;
        setReport(data);

        if (data.status === 'completed' || data.status === 'failed') {
          setLoading(false);
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch report');
        setLoading(false);
        clearInterval(intervalId);
      }
    };

    fetchReport();
    intervalId = setInterval(fetchReport, 2000);

    return () => clearInterval(intervalId);
  }, [id]);

  if (loading && (!report || report.status === 'pending' || report.status === 'processing')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <h2 className="text-2xl font-bold">Analyzing {report?.url || 'Website'}...</h2>
        <p className="text-zinc-400 mt-2">
          {report?.status === 'pending' ? 'Waiting for worker...' : 'Running Playwright & Lighthouse audit...'}
        </p>
        <div className="mt-8 w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
                className="h-full bg-blue-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 20, ease: "linear", repeat: Infinity }}
            />
        </div>
      </div>
    );
  }

  if (error || report?.status === 'failed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Audit Failed</h2>
        <p className="text-zinc-400 mt-2">{report?.ai_summary || error || 'Unknown error occurred'}</p>
        <button 
            onClick={() => window.location.href = '/'}
            className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
        >
            Try Another URL
        </button>
      </div>
    );
  }

  if (!report) return null;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12">
        <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold truncate max-w-2xl">{report.url}</h1>
            <div className="flex items-center gap-2 text-zinc-400 mt-2 text-sm">
                <Clock className="w-4 h-4" />
                <span>{new Date(report.created_at).toLocaleString()}</span>
                <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wide border border-emerald-500/20">
                    {report.status}
                </span>
            </div>
          </div>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors text-sm"
          >
            New Audit
          </button>
        </header>

        {/* Top Section: Score & AI Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Performance Gauge */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center"
            >
                <Gauge score={report.performance_score || 0} label="Performance Score" size={200} />
            </motion.div>

            {/* AI Summary */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8"
            >
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">Gemini AI Insights</span>
                </h3>
                <div className="prose prose-invert max-w-none text-zinc-300">
                    {report.ai_summary ? (
                        <div className="whitespace-pre-wrap leading-relaxed">
                            {report.ai_summary}
                        </div>
                    ) : (
                        <p className="italic text-zinc-500">AI summary not available.</p>
                    )}
                </div>
            </motion.div>
        </div>

        {/* Visual Timeline (Filmstrip) */}
        {report.lighthouse_json?.audits?.['screenshot-thumbnails']?.details?.items && (
             <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
             >
                <h3 className="text-xl font-semibold">Visual Loading Timeline</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
                    {report.lighthouse_json.audits['screenshot-thumbnails'].details.items.map((item: any, index: number) => (
                        <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 flex flex-col items-center">
                            <img src={item.data} alt={`Frame ${index}`} className="w-full h-auto rounded border border-zinc-700" />
                            <span className="text-xs text-zinc-500 mt-2">{item.timing}ms</span>
                        </div>
                    ))}
                </div>
             </motion.div>
        )}

        {/* Screenshot */}
        {report.screenshot && (
             <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-4"
             >
                <h3 className="text-xl font-semibold">Final Screenshot</h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden p-2">
                    <img 
                        src={report.screenshot.startsWith('http') ? report.screenshot : `${apiUrl}${report.screenshot}`} 
                        alt="Full Page Screenshot" 
                        className="w-full h-auto rounded-lg"
                    />
                </div>
             </motion.div>
        )}
      </div>
    </div>
  );
}
