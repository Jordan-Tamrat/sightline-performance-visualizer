'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, LayoutPanelTop, Info } from 'lucide-react';
import InsightCard, { Insight, InsightAction } from './InsightCard';

interface AIInsightsPanelProps {
  aiSummary: string | null;
  onAction?: (action: InsightAction) => void;
}

export default function AIInsightsPanel({ aiSummary, onAction }: AIInsightsPanelProps) {
  const parsedData = useMemo(() => {
    if (!aiSummary) return null;
    try {
      let cleanJson = aiSummary.trim();
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
      }
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("AI Summary parsing failed", e);
      return null;
    }
  }, [aiSummary]);

  const sortedIssues = useMemo(() => {
    const issues = parsedData?.issues || [];
    const severityOrder: Record<string, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
    return [...issues].sort((a: Insight, b: Insight) => {
      const aOrder = severityOrder[a.severity] ?? 3;
      const bOrder = severityOrder[b.severity] ?? 3;
      return aOrder - bOrder;
    });
  }, [parsedData]);

  if (!parsedData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl border-dashed">
        <Info className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-sm font-medium">No insights available for this report.</p>
      </div>
    );
  }

  const { overall_assessment } = parsedData;
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="space-y-10">
      {/* Assessment Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-indigo-500/10 dark:border-indigo-500/20 rounded-3xl p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-xl border border-indigo-500/20">
            <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.3em] mb-2">Automated Analysis</h3>
            <h4 className="text-xl font-black uppercase tracking-tighter bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent leading-tight mb-3 italic">
              AI Performance Assessment
            </h4>
            <p className="text-zinc-700 dark:text-zinc-300 text-lg leading-relaxed max-w-4xl font-medium">
              {overall_assessment}
            </p>
          </div>
        </div>
        
        {/* Decorative background shape */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full" />
      </div>

      {/* Issues Grid/List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
             <LayoutPanelTop className="w-5 h-5 text-zinc-400" />
             <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Key Insights ({sortedIssues.length})</h4>
          </div>
          <p className="text-[10px] text-zinc-400 font-medium">Click to expand details</p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid gap-5"
        >
          {sortedIssues.map((insight: Insight, idx: number) => (
            <InsightCard 
              key={idx} 
              insight={insight} 
              onAction={onAction}
              index={idx}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
