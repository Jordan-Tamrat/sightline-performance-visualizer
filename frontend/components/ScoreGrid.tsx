'use client';

import { motion } from 'framer-motion';
import Gauge from './Gauge';

interface CategoryData {
    title: string;
    score: number | null;
}

interface ScoreGridProps {
    categories: {
        performance?: CategoryData;
        accessibility?: CategoryData;
        'best-practices'?: CategoryData;
        seo?: CategoryData;
    };
}

export default function ScoreGrid({ categories }: ScoreGridProps) {
    if (!categories) return null;

    const data = [
        { label: 'Performance', score: categories.performance?.score },
        { label: 'Accessibility', score: categories.accessibility?.score },
        { label: 'Best Practices', score: categories['best-practices']?.score },
        { label: 'SEO', score: categories.seo?.score },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {data.map((item, index) => {
                // Lighthouse scores are 0-1, convert to 0-100
                const normalizedScore = item.score !== null && item.score !== undefined
                    ? Math.round(item.score * 100)
                    : 0;

                return (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.15 }}
                        className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
                    >
                        <Gauge score={normalizedScore} label={item.label} size={140} />
                    </motion.div>
                );
            })}
        </div>
    );
}
