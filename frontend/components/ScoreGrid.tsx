'use client';

import { motion } from 'framer-motion';
import { Zap, Eye, ShieldCheck, Search } from 'lucide-react';
import clsx from 'clsx';
import Gauge from './Gauge';

interface CategoryData {
    title: string;
    score: number | null;
}

export interface ScoreGridProps {
    categories: {
        performance?: CategoryData;
        accessibility?: CategoryData;
        'best-practices'?: CategoryData;
        seo?: CategoryData;
    };
}

type Band = 'good' | 'needs-improvement' | 'poor';
const getBand = (score: number): Band => (score >= 90 ? 'good' : score >= 50 ? 'needs-improvement' : 'poor');

export default function ScoreGrid({ categories }: ScoreGridProps) {
    if (!categories) return null;

    const data = [
        { label: 'Performance', score: categories.performance?.score, icon: Zap },
        { label: 'Accessibility', score: categories.accessibility?.score, icon: Eye },
        { label: 'Best Practices', score: categories['best-practices']?.score, icon: ShieldCheck },
        { label: 'SEO', score: categories.seo?.score, icon: Search },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {data.map((item, index) => {
                // Lighthouse scores are 0-1, convert to 0-100
                const normalizedScore = item.score !== null && item.score !== undefined
                    ? Math.round(item.score * 100)
                    : 0;
                const band = getBand(normalizedScore);
                const Icon = item.icon;

                return (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.15 }}
                        whileHover={{ y: -5, scale: 1.02 }}
                        className={clsx(
                            "relative overflow-hidden bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 shadow-sm hover:shadow-xl group",
                            band === 'good' && "hover:border-emerald-400/50 hover:shadow-emerald-500/10",
                            band === 'needs-improvement' && "hover:border-amber-400/50 hover:shadow-amber-500/10",
                            band === 'poor' && "hover:border-red-400/50 hover:shadow-red-500/10",
                        )}
                    >
                        {/* Top accent line */}
                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.6, delay: 0.3 + index * 0.15 }}
                            style={{ transformOrigin: 'left' }}
                            className={clsx(
                                "absolute top-0 left-0 right-0 h-1",
                                band === 'good' && "bg-emerald-500",
                                band === 'needs-improvement' && "bg-amber-500",
                                band === 'poor' && "bg-red-500",
                            )}
                        />

                        {/* Soft glow on hover */}
                        <div className={clsx(
                            "absolute -top-8 -right-8 w-28 h-28 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                            band === 'good' && "bg-emerald-500/10",
                            band === 'needs-improvement' && "bg-amber-500/10",
                            band === 'poor' && "bg-red-500/10",
                        )} />

                        {/* Category icon chip */}
                        <div className={clsx(
                            "absolute top-4 left-4 p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
                            band === 'good' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                            band === 'needs-improvement' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                            band === 'poor' && "bg-red-500/10 text-red-600 dark:text-red-400",
                        )}>
                            <Icon className="w-3.5 h-3.5" />
                        </div>

                        <Gauge score={normalizedScore} label={item.label} size={140} />
                    </motion.div>
                );
            })}
        </div>
    );
}
