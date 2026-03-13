'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  ExternalLink, 
  Zap, 
  BarChart3, 
  Play,
  Info
} from 'lucide-react';
import clsx from 'clsx';

export interface InsightAction {
  type: 'waterfall' | 'metric' | 'filmstrip';
  target: string;
}

export interface Insight {
  title: string;
  explanation: string;
  impact: string;
  suggestion: string;
  severity: 'High' | 'Medium' | 'Low';
  code_fix?: string;
  references?: string[];
  action?: InsightAction;
}

interface InsightCardProps {
  insight: Insight;
  onAction?: (action: InsightAction) => void;
  index: number;
}

export default function InsightCard({ insight, onAction, index }: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const severityConfig = {
    High: {
      bg: 'bg-red-50 dark:bg-red-500/5',
      border: 'border-red-200 dark:border-red-500/20',
      accent: 'bg-red-500',
      text: 'text-red-700 dark:text-red-400',
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    },
    Medium: {
      bg: 'bg-amber-50 dark:bg-amber-500/5',
      border: 'border-amber-200 dark:border-amber-500/20',
      accent: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
      icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
    },
    Low: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/5',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      accent: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400',
      icon: <Info className="w-5 h-5 text-emerald-500" />,
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
    }
  };

  const config = severityConfig[insight.severity] || severityConfig.Low;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (insight.code_fix) {
      navigator.clipboard.writeText(insight.code_fix);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { delay: index * 0.1 } }
  };

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      layout
      className={clsx(
        "group relative overflow-hidden rounded-2xl border transition-all duration-300",
        config.border,
        config.bg,
        isExpanded ? "shadow-lg scale-[1.01]" : "hover:shadow-md hover:scale-[1.005]"
      )}
    >
      {/* Left accent border */}
      <div className={clsx("absolute left-0 top-0 bottom-0 w-1.5", config.accent)} />

      {/* Header / Clickable Area */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer p-5 flex items-start gap-4"
      >
        <div className="mt-1">{config.icon}</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg leading-tight uppercase tracking-tight italic">
              {insight.title}
            </h4>
            <span className={clsx("text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest", config.badge)}>
              {insight.severity}
            </span>
          </div>
          {!isExpanded && (
            <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-2">
              {insight.explanation}
            </p>
          )}
        </div>

        <button className="p-2 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-8 pt-2 space-y-6">
              
              {/* Detailed Explanation & Impact */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-3">Explanation</h5>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {insight.explanation}
                  </p>
                </div>
                <div className="bg-zinc-950/5 dark:bg-zinc-950/30 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
                  <h5 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-2">User Impact</h5>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    {insight.impact}
                  </p>
                </div>
              </div>

              {/* Technical Suggestion */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Recommendation</h5>
                <div className="flex items-start gap-3 text-sm text-zinc-800 dark:text-zinc-200 bg-white/50 dark:bg-white/5 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{insight.suggestion}</span>
                </div>
              </div>

              {/* Code Fix Block */}
              {insight.code_fix && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Code Example</h5>
                    <button 
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700">
                    <code className="text-xs font-mono text-zinc-300 leading-relaxed">
                      {insight.code_fix}
                    </code>
                  </pre>
                </div>
              )}

              {/* Action Buttons & References */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                <div className="flex flex-wrap gap-2">
                  {insight.action && (
                    <button
                      onClick={() => onAction?.(insight.action!)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 active:scale-95"
                    >
                      {insight.action.type === 'waterfall' && <BarChart3 className="w-4 h-4" />}
                      {insight.action.type === 'filmstrip' && <Play className="w-4 h-4" />}
                      {insight.action.type === 'metric' && <Zap className="w-4 h-4" />}
                      {insight.action.type === 'waterfall' ? 'View in Waterfall' : 
                       insight.action.type === 'filmstrip' ? 'Show in Timeline' : 'Explore Metric'}
                    </button>
                  )}
                  {insight.references && insight.references.map((ref, i) => (
                    <a 
                      key={i}
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Docs
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
