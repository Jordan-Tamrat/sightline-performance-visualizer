'use client';

import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, Clock, Sparkles, Monitor, Smartphone, Wifi, Signal, Share2, Copy, Check, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import Gauge from '../../../components/Gauge';
import ScoreGrid, { ScoreGridProps } from '@/components/ScoreGrid';
import WebVitalsGrid, { WebVitalsGridProps } from '@/components/WebVitalsGrid';
import NetworkWaterfall from '@/components/NetworkWaterfall';
import PerformanceSimulator from '@/components/PerformanceSimulator';
import AIInsightsPanel from '@/components/AIInsightsPanel';
import { InsightAction } from '@/components/InsightCard';

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
  device_type: 'desktop' | 'mobile';
  network_type: '4g' | 'fast3g' | 'slow3g';
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
  const [filmstrip, setFilmstrip] = useState<{ data: string; timing: number }[]>([]);
  const [loadingFilmstrip, setLoadingFilmstrip] = useState(false);
  
  // Share state
  const [isSharing, setIsSharing] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; expiresAt: string } | null>(null);
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'network' | 'visuals'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Monitor className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Insights', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'network', label: 'Network', icon: <Wifi className="w-4 h-4" /> },
    { id: 'visuals', label: 'Visuals', icon: <Clock className="w-4 h-4" /> }
  ] as const;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleInsightAction = (action: InsightAction) => {
    if (action.type === 'waterfall') {
      setActiveTab('network');
      setTimeout(() => {
        document.getElementById('network-waterfall')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } else if (action.type === 'filmstrip') {
      setActiveTab('visuals');
      setTimeout(() => {
        document.getElementById('visual-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } else if (action.type === 'metric') {
      setActiveTab('overview');
      setTimeout(() => {
        const el = document.getElementById('score-grid') || document.getElementById('web-vitals-grid');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchReport = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/reports/${id}/`);
        const data = response.data;
        setReport(data);

        if (data.status === 'completed' || data.status === 'failed') {
          setLoading(false);
          return true; // Signal completion
        }
      } catch (err: any) {
        console.error(err);
        const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch report';
        setError(errorMessage);
        setLoading(false);
        return true; // Signal error/completion
      }
      return false;
    };

    // Use a variable to track if we should stop polling
    let shouldStop = false;

    fetchReport().then((finished) => {
      if (finished || shouldStop) return;

      const intervalId = setInterval(async () => {
        const finished = await fetchReport();
        if (finished || shouldStop) {
          clearInterval(intervalId);
        }
      }, 2000);

      return () => {
        shouldStop = true;
        clearInterval(intervalId);
      };
    });
  }, [id, apiUrl]);

  useEffect(() => {
    if (report?.status === 'completed' && !hasRevealed) {
      // avoid synchronous setState in effect
      setTimeout(() => setShowReveal(true), 0);
      const timer = setTimeout(() => {
        setShowReveal(false);
        setHasRevealed(true);
      }, 2500); // Wait 2.5s for gauge to animate before revealing full UI

      // Fetch filmstrip
      const fetchFilmstrip = async () => {
        setLoadingFilmstrip(true);
        try {
          const response = await axios.get(`${apiUrl}/api/reports/${id}/filmstrip/`);
          setFilmstrip(response.data.frames || []);
        } catch (e) {
          console.error("Failed to fetch filmstrip", e);
        } finally {
          setLoadingFilmstrip(false);
        }
      };

      fetchFilmstrip();

      return () => clearTimeout(timer);
    }
  }, [report?.status, hasRevealed, id, apiUrl]);

  const handleShare = async () => {
    setIsSharing(true);
    setShareError('');
    try {
      const userIdentifier = localStorage.getItem('sightline_user_id');
      const response = await axios.post(`${apiUrl}/api/reports/${id}/share/`, {
        user_identifier: userIdentifier
      });
      setShareData({
        url: response.data.share_url,
        expiresAt: response.data.expires_at
      });
    } catch (err: any) {
      setShareError(err.response?.data?.error || 'Failed to generate share link');
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = () => {
    if (shareData) {
      navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const searchParams = useSearchParams();
  const autoShare = searchParams?.get('share') === 'true';
  const isFinished = report?.status === 'completed' || report?.status === 'failed';
  const hasAutoShared = useRef(false);

  useEffect(() => {
    if (isFinished && autoShare && !isSharing && !shareData && !shareError && !hasAutoShared.current) {
      hasAutoShared.current = true;
      handleShare();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished, autoShare]);

  // Show analysis view only if not finished
  if (!isFinished) {
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
            {/* Step 1: Lighthouse Audit */}
            <div className="flex items-center gap-4">
              <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                hasLighthouse ? "bg-emerald-500/20 text-emerald-500" : "bg-blue-500/20 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              )}>
                {hasLighthouse ? <CheckCircle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
              <div>
                <h4 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">Lighthouse Audit</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Benchmarking pure performance metrics...</p>
              </div>
            </div>

            {/* Step 2: Web Navigation & Screenshot (Visible after Lighthouse) */}
            {hasLighthouse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4"
              >
                <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center",
                  hasScreenshot ? "bg-emerald-500/20 text-emerald-500" : "bg-blue-500/20 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                )}>
                  {hasScreenshot ? <CheckCircle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">Visual Capture</h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Rendering page and capturing screenshot...</p>
                </div>
              </motion.div>
            )}

            {/* Step 3: AI Analysis (Visible after Screenshot) */}
            {hasScreenshot && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4"
              >
                <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  hasAI ? "bg-emerald-500/20 text-emerald-500" : "bg-blue-500/20 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                )}>
                  {hasAI ? <CheckCircle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">Gemini AI Analysis</h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Generating human-friendly insights...</p>
                </div>
              </motion.div>
            )}
          </div>

          <div className="mt-10 w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: "0%" }}
              animate={{ width: hasAI ? "100%" : hasScreenshot ? "66%" : hasLighthouse ? "33%" : "10%" }}
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
              {/* Device & Network Environment Badge */}
              <span className="flex items-center gap-1.5 bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 px-2.5 py-0.5 rounded text-xs font-semibold border border-zinc-300/30 dark:border-zinc-700/30">
                {report.device_type === 'mobile' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                {report.device_type === 'mobile' ? 'Mobile' : 'Desktop'}
                <span className="text-zinc-400 dark:text-zinc-600">·</span>
                {report.network_type === '4g' ? <Wifi className="w-3 h-3" /> : <Signal className="w-3 h-3" />}
                {report.network_type === 'slow3g' ? 'Slow 3G' : report.network_type === 'fast3g' ? 'Fast 3G' : '4G'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Share Report
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors text-sm font-medium cursor-pointer"
            >
              New Audit
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-px mb-8 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="min-h-[500px] mb-12 relative">
          <AnimatePresence mode="wait">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-12"
              >
                <div id="score-grid" className={clsx("transition-all duration-700", hasRevealed ? "opacity-100" : "opacity-0 translate-y-8")}>
                  <ScoreGrid categories={report.lighthouse_json?.categories as ScoreGridProps['categories']} />
                </div>
                <div id="web-vitals-grid" className={clsx("transition-all duration-700 delay-100", hasRevealed ? "opacity-100" : "opacity-0 translate-y-8")}>
                  <WebVitalsGrid audits={report.lighthouse_json?.audits as WebVitalsGridProps['audits']} />
                </div>
                <div className={clsx("transition-all duration-700 delay-200", hasRevealed ? "opacity-100" : "opacity-0 translate-y-8")}>
                  <PerformanceSimulator baseScore={report.performance_score || 0} />
                </div>
              </motion.div>
            )}

            {/* AI INSIGHTS TAB */}
            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <AIInsightsPanel 
                  aiSummary={report.ai_summary} 
                  onAction={handleInsightAction} 
                />
              </motion.div>
            )}

            {/* NETWORK TAB */}
            {activeTab === 'network' && (
              <motion.div
                key="network"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                id="network-waterfall"
              >
                <NetworkWaterfall audits={report.lighthouse_json?.audits as any} />
              </motion.div>
            )}

            {/* VISUALS TAB */}
            {activeTab === 'visuals' && (
              <motion.div
                key="visuals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-12"
              >
                {/* Visual Timeline (Filmstrip) */}
                <div id="visual-timeline" className="space-y-4">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter italic mb-1">Visual Loading Timeline</h3>
                <p className="text-sm text-zinc-400">See exactly how your page loads frame-by-frame. Generated from Lighthouse trace.</p>
              </div>
            </div>

            {loadingFilmstrip ? (
              <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading filmstrip...</span>
              </div>
            ) : filmstrip.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                {filmstrip.map((item, index) => (
                  <div key={index} className="flex-none w-[200px] snap-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex flex-col items-center group hover:border-zinc-700 transition-colors">
                    <div className="relative w-full aspect-video bg-zinc-950 rounded overflow-hidden border border-zinc-800 mb-2">
                      <Image
                        src={item.data}
                        alt={`Frame at ${item.timing}ms`}
                        fill
                        className="object-cover"
                        sizes="200px"
                        unoptimized
                      />
                    </div>
                    <span className="text-xs font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      {(item.timing / 1000).toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500 bg-zinc-900/50 border border-zinc-800/50 rounded-xl border-dashed">
                <p>No filmstrip data available for this report.</p>
                <p className="text-xs text-zinc-600 mt-1">Try running a new audit to generate a timeline.</p>
              </div>
            )}
                </div>

                {/* Screenshot */}
                {report.screenshot && (
                  <div className="space-y-4">
              <h3 className="text-xl font-black uppercase tracking-tighter italic">Final Screenshot</h3>
              <div className={clsx(
                "bg-zinc-900 border border-zinc-800 rounded-2xl overflow-y-auto w-full flex justify-center p-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent",
                report.device_type === 'mobile' ? "max-h-[600px] max-w-sm mx-auto" : ""
              )}>
                <Image
                  src={report.screenshot.startsWith('http')
                    ? report.screenshot.replace(/^https?:\/\/[^/]+/, '')
                    : report.screenshot}
                  alt="Full Page Screenshot"
                  width={report.device_type === 'mobile' ? 390 : 1200}
                  height={report.device_type === 'mobile' ? 844 : 800}
                  className={clsx(
                    "rounded-lg",
                    report.device_type === 'mobile' ? "w-full object-contain" : "w-full h-auto"
                  )}
                  sizes={report.device_type === 'mobile' ? "390px" : "(max-width: 768px) 100vw, 1200px"}
                  style={{ width: report.device_type === 'mobile' ? '100%' : '100%', height: 'auto' }}
                  priority
                />
              </div>
                  </div>
                )}
              </motion.div>
            )}
            
          </AnimatePresence>
        </div>
      </div>
      
      {/* Share Modal */}
      <AnimatePresence>
        {shareData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-md w-full"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-500" />
                  Share Report
                </h3>
                <button 
                  onClick={() => setShareData(null)}
                  className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
              
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 font-medium">
                Anyone with this link can view the report. <br/>
                <span className="text-red-500 flex flex-wrap items-center gap-1 mt-1 font-semibold">
                  <Clock className="w-3 h-3" /> Expires on {new Date(shareData.expiresAt).toLocaleDateString()} at {new Date(shareData.expiresAt).toLocaleTimeString()}
                </span>
              </p>

              <div className="flex items-center gap-2 bg-zinc-200/50 dark:bg-zinc-950/50 p-2 rounded-xl mb-6 border border-zinc-300 dark:border-zinc-800 text-sm">
                <input 
                  type="text" 
                  readOnly 
                  value={shareData.url} 
                  className="bg-transparent flex-1 text-zinc-800 dark:text-zinc-300 outline-none px-2 font-mono text-xs w-full"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyToClipboard}
                  className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-lg font-medium transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <a
                  href={shareData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Link
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Share Error Toast */}
      <AnimatePresence>
        {shareError && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 font-medium text-sm"
          >
            <AlertCircle className="w-5 h-5" />
            {shareError}
            <button onClick={() => setShareError('')} className="ml-2 hover:bg-red-600 p-1 rounded-md transition-colors cursor-pointer">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
