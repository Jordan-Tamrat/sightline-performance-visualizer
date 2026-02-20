'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, Clock, Sparkles } from 'lucide-react';
import clsx from 'clsx';

// Gauge Component (Inline for simplicity if import fails, but I'll try to import)
// import Gauge from '@/components/Gauge'; 
// Since I'm not sure if alias works without tsconfig paths setup (which usually is setup by create-next-app), I'll try relative import.
import Gauge from '../../../components/Gauge';

interface Issue {
  title: string;
  explanation: string;
  impact: string;
  suggestion: string;
  severity: 'High' | 'Medium' | 'Low';
}

interface AISummary {
  overall_assessment: string;
  issues: Issue[];
}

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

  const aiSummary: AISummary | null = useMemo(() => {
    if (!report?.ai_summary) return null;
    try {
      // Handle potentially double-stringified JSON or weird markdown formatting
      let cleanJson = report.ai_summary.trim();

      // Remove markdown code blocks if they exist (backup for backend cleaning)
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);

      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse AI Summary JSON:", e);
      return null;
    }
  }, [report?.ai_summary]);

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Performance Gauge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center h-fit sticky top-8"
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
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">Gemini AI Insights</span>
            </h3>

            {aiSummary ? (
              <div className="space-y-6">
                {/* Overall Assessment */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-sm">
                  <h4 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-2">Overall Assessment</h4>
                  <p className="text-lg text-zinc-100 leading-relaxed">{aiSummary.overall_assessment}</p>
                </div>

                {/* Issues Grid */}
                <div className="grid gap-4">
                  {aiSummary.issues.map((issue, idx) => (
                    <div key={idx} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h5 className="font-semibold text-zinc-200 text-lg">{issue.title}</h5>
                            <span className={clsx(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider md:hidden",
                              issue.severity === 'High' && "bg-red-500/10 text-red-500 border border-red-500/20",
                              issue.severity === 'Medium' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                              issue.severity === 'Low' && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                            )}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-zinc-400 text-sm mb-3 leading-relaxed">{issue.explanation}</p>

                          <div className="flex flex-col gap-2 mt-4">
                            <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-950/50 py-2 px-3 rounded-lg border border-zinc-800/50">
                              <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0" />
                              <span className="font-medium text-red-400/80 shrink-0">Impact:</span>
                              <span>{issue.impact}</span>
                            </div>
                            {issue.suggestion && (
                              <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-950/50 py-2 px-3 rounded-lg border border-zinc-800/50">
                                <CheckCircle className="w-4 h-4 text-emerald-400/80 shrink-0" />
                                <span className="font-medium text-emerald-400/80 shrink-0">Fix:</span>
                                <span>{issue.suggestion}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={clsx(
                          "hidden md:inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide h-fit whitespace-nowrap",
                          issue.severity === 'High' && "bg-red-500/10 text-red-500 border border-red-500/20",
                          issue.severity === 'Medium' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                          issue.severity === 'Low' && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                        )}>
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none text-zinc-300">
                {report.ai_summary ? (
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {report.ai_summary}
                  </div>
                ) : (
                  <p className="italic text-zinc-500">AI summary not available.</p>
                )}
              </div>
            )}
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
            <div className="flex items-end justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-1">Visual Loading Timeline</h3>
                <p className="text-sm text-zinc-400">See exactly how your page loads frame-by-frame. This helps identify layout shifts and perceived speed.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
              {report.lighthouse_json.audits['screenshot-thumbnails'].details.items.map((item: any, index: number) => (
                <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 flex flex-col items-center group hover:border-zinc-700 transition-colors">
                  <div className="relative w-full aspect-video bg-zinc-950 rounded overflow-hidden border border-zinc-800 mb-2">
                    <img src={item.data} alt={`Frame at ${item.timing}ms`} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    {(item.timing / 1000).toFixed(1)}s
                  </span>
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
