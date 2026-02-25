/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, Clock, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import ThemeToggle from '@/components/ThemeToggle';
import Gauge from '../../../components/Gauge';
import ScoreGrid, { ScoreGridProps } from '@/components/ScoreGrid';
import WebVitalsGrid, { WebVitalsGridProps } from '@/components/WebVitalsGrid';
import NetworkWaterfall, { NetworkWaterfallProps } from '@/components/NetworkWaterfall';
import PerformanceSimulator from '@/components/PerformanceSimulator';

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
  lighthouse_json: {
    categories?: Record<string, unknown>;
    audits?: Record<string, unknown>;
  } | null;
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
  const [showReveal, setShowReveal] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);

  // memoize parsed AI summary string
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
    const intervalId = setInterval(fetchReport, 2000);

    return () => clearInterval(intervalId);
  }, [id]);

  useEffect(() => {
    if (report?.status === 'completed' && !hasRevealed) {
      // avoid synchronous setState in effect
      setTimeout(() => setShowReveal(true), 0);
      const timer = setTimeout(() => {
        setShowReveal(false);
        setHasRevealed(true);
      }, 2500); // Wait 2.5s for gauge to animate before revealing full UI
      return () => clearTimeout(timer);
    }
  }, [report?.status, hasRevealed]);

  if (loading && (!report || report.status === 'pending' || report.status === 'processing')) {
    // Determine active steps
    const hasScreenshot = !!report?.screenshot;
    const hasLighthouse = !!report?.lighthouse_json;
    const hasAI = !!report?.ai_summary;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 transition-colors">
        <div className="max-w-md w-full bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
            Analyzing {report?.url ? new URL(report.url).hostname : 'Website'}
          </h2>

          <div className="space-y-6">
            {/* Step 1: Web Navigation & Screenshot */}
            <div className="flex items-center gap-4">
              <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center",
                hasScreenshot ? "bg-emerald-500/20 text-emerald-500" : "bg-blue-500/20 text-blue-500"
              )}>
                {hasScreenshot ? <CheckCircle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
              <div>
                <h4 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">Browser Initialization</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading page and capturing screenshots...</p>
              </div>
            </div>

            {/* Step 2: Lighthouse Audit */}
            <div className="flex items-center gap-4">
              <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                hasLighthouse ? "bg-emerald-500/20 text-emerald-500" : hasScreenshot ? "bg-blue-500/20 text-blue-500" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
              )}>
                {hasLighthouse ? <CheckCircle className="w-5 h-5" /> : (hasScreenshot ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />)}
              </div>
              <div>
                <h4 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">Lighthouse Audit</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Benchmarking performance metrics...</p>
              </div>
            </div>

            {/* Step 3: AI Analysis */}
            <div className="flex items-center gap-4">
              <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                hasAI ? "bg-emerald-500/20 text-emerald-500" : hasLighthouse ? "bg-purple-500/20 text-purple-500" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
              )}>
                {hasAI ? <CheckCircle className="w-5 h-5" /> : (hasLighthouse ? <Sparkles className="w-5 h-5 animate-pulse" /> : <Clock className="w-5 h-5" />)}
              </div>
              <div>
                <h4 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">Gemini AI Analysis</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Generating human-friendly insights...</p>
              </div>
            </div>
          </div>

          <div className="mt-10 w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: "0%" }}
              animate={{ width: hasAI ? "100%" : hasLighthouse ? "66%" : hasScreenshot ? "33%" : "10%" }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error || report?.status === 'failed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 transition-colors">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Audit Failed</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">{report?.ai_summary || error || 'Unknown error occurred'}</p>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-6 px-6 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-full transition-colors text-zinc-900 dark:text-zinc-100"
        >
          Try Another URL
        </button>
      </div>
    );
  }

  if (!report) return null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors relative overflow-x-hidden">

      <AnimatePresence>
        {showReveal && (
          <motion.div
            key="reveal-overlay"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(16px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)', scale: 1.1 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-100/50 dark:bg-zinc-950/50"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1.2, y: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
              className="bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-full p-12 shadow-2xl"
            >
              <Gauge score={report.performance_score || 0} label="Performance" size={240} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6 md:p-12 max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 relative">
          <div>
            <h1 className="text-3xl font-bold truncate max-w-2xl">{report.url}</h1>
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mt-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>{new Date(report.created_at).toLocaleString()}</span>
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wide border border-emerald-500/20">
                {report.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors text-sm font-medium"
            >
              New Audit
            </button>
          </div>
        </header>

        {/* Top Section: Advanced Metrics & AI Summary */}
        <div className="space-y-12">

          {/* 4-Pillar Score Grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: hasRevealed ? 1 : 0, y: hasRevealed ? 0 : 40 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <ScoreGrid categories={report.lighthouse_json?.categories as ScoreGridProps['categories']} />
          </motion.div>

          {/* Core Web Vitals Heatmap */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: hasRevealed ? 1 : 0, y: hasRevealed ? 0 : 40 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <WebVitalsGrid audits={report.lighthouse_json?.audits as WebVitalsGridProps['audits']} />
          </motion.div>

          {/* Interactive Network Waterfall */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: hasRevealed ? 1 : 0, y: hasRevealed ? 0 : 40 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <NetworkWaterfall audits={report.lighthouse_json?.audits as NetworkWaterfallProps['audits']} />
          </motion.div>

          {/* Performance Simulator */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: hasRevealed ? 1 : 0, y: hasRevealed ? 0 : 40 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <PerformanceSimulator baseScore={report.performance_score || 0} />
          </motion.div>

          {/* AI Summary */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: hasRevealed ? 1 : 0, y: hasRevealed ? 0 : 40 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm"
          >
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">Gemini AI Insights</span>
            </h3>

            {aiSummary ? (
              <div className="space-y-6">
                {/* Overall Assessment */}
                <div className="bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                  <h4 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium uppercase tracking-wider mb-2">Overall Assessment</h4>
                  <p className="text-lg text-zinc-900 dark:text-zinc-100 leading-relaxed">{aiSummary.overall_assessment}</p>
                </div>

                {/* Issues Grid */}
                <div className="grid gap-4">
                  {aiSummary.issues.map((issue, idx) => (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={hasRevealed ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                      transition={{ delay: 0.4 + (idx * 0.1) }}
                      key={idx}
                      className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h5 className="font-semibold text-zinc-900 dark:text-zinc-200 text-lg">{issue.title}</h5>
                            <span className={clsx(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider md:hidden",
                              issue.severity === 'High' && "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500 border border-red-500/20",
                              issue.severity === 'Medium' && "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500 border border-amber-500/20",
                              issue.severity === 'Low' && "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-500 border border-blue-500/20",
                            )}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3 leading-relaxed">{issue.explanation}</p>

                          <div className="flex flex-col gap-2 mt-4">
                            <div className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-950/50 py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
                              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400/80 shrink-0" />
                              <span className="font-medium text-red-600 dark:text-red-400/80 shrink-0">Impact:</span>
                              <span>{issue.impact}</span>
                            </div>
                            {issue.suggestion && (
                              <div className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-950/50 py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
                                <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400/80 shrink-0" />
                                <span className="font-medium text-emerald-600 dark:text-emerald-400/80 shrink-0">Fix:</span>
                                <span>{issue.suggestion}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={clsx(
                          "hidden md:inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide h-fit whitespace-nowrap",
                          issue.severity === 'High' && "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-500 border border-red-500/20",
                          issue.severity === 'Medium' && "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500 border border-amber-500/20",
                          issue.severity === 'Low' && "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-500 border border-blue-500/20",
                        )}>
                          {issue.severity}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
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

          {/* Visual Timeline (Filmstrip) */}
          {((report.lighthouse_json?.audits?.['screenshot-thumbnails'] as {details?:{items?:{data:string;timing:number}[]}})?.details?.items) && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={hasRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="space-y-4"
            >   <div className="flex items-end justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold mb-1">Visual Loading Timeline</h3>
                  <p className="text-sm text-zinc-400">See exactly how your page loads frame-by-frame. This helps identify layout shifts and perceived speed.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
                {((report.lighthouse_json?.audits?.['screenshot-thumbnails'] as {details?:{items?:{data:string;timing:number}[]}})?.details?.items || []).map((item: { data: string; timing: number }, index: number) => (
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
              initial={{ opacity: 0, y: 40 }}
              animate={hasRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.6, delay: 1 }}
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
    </div>
  );
}
