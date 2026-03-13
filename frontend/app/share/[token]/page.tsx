'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, Clock, Sparkles, Monitor, Smartphone, Wifi, Signal, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import Gauge from '@/components/Gauge';
import ScoreGrid from '@/components/ScoreGrid';
import WebVitalsGrid from '@/components/WebVitalsGrid';
import NetworkWaterfall from '@/components/NetworkWaterfall';
import PerformanceSimulator from '@/components/PerformanceSimulator';
import AIInsightsPanel from '@/components/AIInsightsPanel';
import { InsightAction } from '@/components/InsightCard';

export default function SharedReportPage() {
  const params = useParams();
  const token = params?.token as string;
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [filmstrip, setFilmstrip] = useState<any[]>([]);
  const [loadingFilmstrip, setLoadingFilmstrip] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'network' | 'visuals'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Monitor className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Insights', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'network', label: 'Network', icon: <Wifi className="w-4 h-4" /> },
    { id: 'visuals', label: 'Visuals', icon: <Clock className="w-4 h-4" /> }
  ] as const;
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!token) return;

    const fetchSharedReport = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/share/${token}/`);
        setReport(response.data.report);
      } catch (err: any) {
        console.error(err);
        const status = err.response?.status;
        setErrorStatus(status || 500);
        setErrorMsg(err.response?.data?.error || 'Failed to load shared report');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedReport();
  }, [token, apiUrl]);

  // Once report is loaded, fetch filmstrip if necessary
  useEffect(() => {
    if (report && report.id) {
      const fetchFilmstrip = async () => {
        setLoadingFilmstrip(true);
        try {
          const response = await axios.get(`${apiUrl}/api/reports/${report.id}/filmstrip/`);
          setFilmstrip(response.data.frames || []);
        } catch (e) {
          console.error("Failed to fetch filmstrip", e);
        } finally {
          setLoadingFilmstrip(false);
        }
      };

      fetchFilmstrip();
    }
  }, [report, apiUrl]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4">
        <div className="flex flex-col items-center gap-4 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p>Loading shared report...</p>
        </div>
      </div>
    );
  }

  // Handle errors explicitly based on status
  if (errorStatus) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 transition-colors">
        <AlertCircle className="w-16 h-16 text-zinc-400 mb-6" />
        <h2 className="text-3xl font-bold mb-3">
          {errorStatus === 410 ? "Link Expired" : 
           errorStatus === 403 ? "Link Revoked" : 
           errorStatus === 404 ? "Report Not Found" : "Error"}
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm text-center mb-8">
          {errorMsg || "This shared link is no longer accessible."}
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors font-medium shadow-md shadow-blue-500/20 cursor-pointer"
        >
          Run a New Audit <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors relative overflow-x-hidden">
      
      {/* Expiration Banner */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 border-b border-zinc-200/50 dark:border-zinc-800/50 py-3 px-6 top-0 z-40 sticky backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" /> 
            You are viewing a shared Sightline audit report.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="text-xs font-bold uppercase tracking-wider bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1.5 rounded-full hover:scale-105 transition-transform cursor-pointer"
          >
            Run Audit
          </button>
        </div>
      </div>

      <div className="p-6 md:p-12 max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 relative">
          <div>
            <h1 className="text-3xl font-bold truncate max-w-2xl">{report.url}</h1>
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mt-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>{new Date(report.created_at).toLocaleString()}</span>
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
          <div className="flex items-center">
            <Gauge score={report.performance_score || 0} label="Performance" size={100} />
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
                <div id="score-grid">
                  <ScoreGrid categories={report.lighthouse_json?.categories} />
                </div>
                <div id="web-vitals-grid">
                  <WebVitalsGrid audits={report.lighthouse_json?.audits} />
                </div>
                <div>
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
                <NetworkWaterfall audits={report.lighthouse_json?.audits} />
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
                <h3 className="text-xl font-semibold mb-1">Visual Loading Timeline</h3>
                <p className="text-sm text-zinc-400">See exactly how your page loads frame-by-frame.</p>
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
                <p>No filmstrip data available.</p>
              </div>
            )}
          </div>

          {/* Screenshot */}
          {report.screenshot && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Final Screenshot</h3>
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
    </div>
  );
}
