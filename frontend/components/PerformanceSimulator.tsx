'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Settings2, ArrowRight } from 'lucide-react';
import Gauge from './Gauge';

interface PerformanceSimulatorProps {
    baseScore: number;
}

export default function PerformanceSimulator({ baseScore }: PerformanceSimulatorProps) {
    const [jsReduction, setJsReduction] = useState(0);
    const [imageOptimization, setImageOptimization] = useState(0);
    const [serverResponse, setServerResponse] = useState(0);

    /**
     * Calculates the simulated score based on Lighthouse v12 weighting logic.
     * Weights: 
     * - TBT (JS Reduction): 30%
     * - LCP (Images): 25%
     * - FCP (Server Response): 10%
     * 
     * Formula: Uses a saturation curve (1 - e^-x) to ensure diminishing returns.
     */
    const calculateSimulatedScore = () => {
        // We normalize the gains. 100% on a slider translates to the "maximum possible" 
        // improvement for that specific metric.

        // Intensity factors (how much the metric can actually "push" the score)
        // Adjusting these to feel realistic for a 0-100 scale relative to baseScore
        const jsWeight = 0.30;
        const imgWeight = 0.25;
        const serverWeight = 0.10;

        // Cumulative intensity based on current sliders
        // We divide by 100 to get a 0-1 factor
        const x = (
            (jsReduction / 100) * jsWeight +
            (imageOptimization / 100) * imgWeight +
            (serverResponse / 100) * serverWeight
        ) * 5; // Scaling factor for the saturation curve

        // Saturation curve: 1 - e^(-x) gives a value between 0 and 1
        const gainFactor = 1 - Math.exp(-x);

        const distanceTo100 = 100 - baseScore;
        const totalGain = distanceTo100 * gainFactor;

        return Math.min(100, Math.round(baseScore + totalGain));
    };

    const simulatedScore = calculateSimulatedScore();
    const pointsGained = simulatedScore - baseScore;

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row gap-8 relative overflow-hidden transition-colors">
            {/* Subtle Background Glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex-1 z-10 space-y-6">
                <h3 className="text-xl font-black uppercase tracking-tighter text-zinc-800 dark:text-zinc-100 italic flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 not-italic" />
                    Performance Forecast
                </h3>
                <button
                    onClick={() => {
                        setJsReduction(0);
                        setImageOptimization(0);
                        setServerResponse(0);
                    }}
                    className="ml-auto flex items-center gap-1.5 text-[10px] font-black uppercase text-zinc-500 hover:text-emerald-500 transition-all py-1.5 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 hover:bg-emerald-500/10 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/30 shadow-sm group"
                >
                    <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" />
                    Reset
                </button>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Dial in hypothetical optimizations to predict how much your core performance score would improve if the engineering team tackled specific technical debt.</p>

                <div className="space-y-6">
                    {/* Slider 1: JS */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                            <label className="text-zinc-500 dark:text-zinc-400">Reduce JavaScript Payload (TBT - 30%)</label>
                            <span className="text-emerald-600 dark:text-emerald-400">{jsReduction > 0 ? `-${jsReduction}%` : '0%'}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={jsReduction}
                            onChange={(e) => setJsReduction(Number(e.target.value))}
                            className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>

                    {/* Slider 2: Images */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                            <label className="text-zinc-500 dark:text-zinc-400">Optimize & Compress Images (LCP - 25%)</label>
                            <span className="text-emerald-600 dark:text-emerald-400">{imageOptimization > 0 ? `-${imageOptimization}%` : '0%'}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={imageOptimization}
                            onChange={(e) => setImageOptimization(Number(e.target.value))}
                            className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>

                    {/* Slider 3: Server */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                            <label className="text-zinc-500 dark:text-zinc-400">Improve Server Response (FCP - 10%)</label>
                            <span className="text-emerald-600 dark:text-emerald-400">{serverResponse > 0 ? `-${serverResponse}%` : '0%'}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={serverResponse}
                            onChange={(e) => setServerResponse(Number(e.target.value))}
                            className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>
                </div>
            </div>

            {/* Live Gauges Zone */}
            <div className="w-full md:w-64 shrink-0 flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-black/40 rounded-xl z-10 border border-zinc-200 dark:border-white/5 transition-colors">
                <div className="flex items-center gap-4 mb-6">
                    <div className="text-center">
                        <span className="text-2xl font-bold text-zinc-400 dark:text-zinc-500">{baseScore}</span>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-bold mt-1">Current</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
                    <div className="text-center">
                        <motion.span
                            key={simulatedScore}
                            initial={{ scale: 1.2, color: '#059669' }}
                            animate={{ scale: 1, color: undefined }}
                            className="text-2xl font-bold text-zinc-900 dark:text-zinc-100"
                        >
                            {simulatedScore}
                        </motion.span>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-wider mt-1">Predicted</div>
                    </div>
                </div>

                <div className="relative">
                    <Gauge score={simulatedScore} label="Simulation" size={160} baseScore={baseScore} />

                    {pointsGained > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, x: 20 }}
                            animate={{ opacity: 1, y: 0, x: 0 }}
                            key={pointsGained}
                            className="absolute -top-3 -right-3 bg-emerald-500 text-white font-black px-2.5 py-1 rounded-full text-xs shadow-xl ring-2 ring-white dark:ring-zinc-900"
                        >
                            +{pointsGained}
                        </motion.div>
                    )}
                </div>

                <p className="mt-6 text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-tight">
                    Predicted using official <b>Lighthouse v12</b> weighting.
                    Gains diminish as score approach 100.
                </p>
            </div>
        </div>
    );
}
