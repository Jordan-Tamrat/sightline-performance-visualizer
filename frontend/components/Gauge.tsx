import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

interface GaugeProps {
  score: number;
  label: string;
  size?: number;
  baseScore?: number;
}

export default function Gauge({ score, label, size = 120, baseScore }: GaugeProps) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  // Motion values
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  // Local state to track color category
  const [colorClass, setColorClass] = useState('text-red-500');

  useEffect(() => {
    const controls = animate(count, score, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (latest >= 90) setColorClass('text-emerald-500');
        else if (latest >= 50) setColorClass('text-amber-500');
        else setColorClass('text-red-500');
      }
    });

    return controls.stop;
  }, [score, count]);

  const offset = circumference - (score / 100) * circumference;
  const baseOffset = baseScore !== undefined ? circumference - (baseScore / 100) * circumference : 0;

  // Calculate gain arc parameters
  const isForecast = baseScore !== undefined;
  const hasGain = isForecast && score > baseScore;
  const gainLength = hasGain ? ((score - baseScore) / 100) * circumference : 0;
  const gainOffset = isForecast ? -(baseScore / 100) * circumference : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-zinc-200 dark:text-zinc-800"
          />

          {!isForecast ? (
            /* CLASSIC STYLE: Main Result Gauges */
            <motion.circle
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 }}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeLinecap="round"
              className={clsx("transition-colors duration-200", colorClass)}
            />
          ) : (
            /* FORECAST STYLE: Simulation Gauge */
            <>
              {/* Base Score Arc (0 to baseScore) - Subtle color for context */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                style={{ strokeDashoffset: baseOffset }}
                className={clsx("opacity-20 dark:opacity-30", colorClass)}
              />

              {/* Gain Arc (Highlight gained points) */}
              {hasGain && (
                <motion.circle
                  initial={{ strokeDasharray: `0 ${circumference}` }}
                  animate={{ strokeDasharray: `${gainLength} ${circumference}` }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 }}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  style={{ strokeDashoffset: gainOffset }}
                  className="text-emerald-500"
                />
              )}

              {/* Ghost Score (Base Score) - Precise needle/marker */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`2 ${circumference}`}
                style={{ strokeDashoffset: - (baseScore / 100) * circumference + 1 }}
                className="text-zinc-400 dark:text-zinc-500 overflow-visible"
              />

              {/* Solid Needle (Predicted Score) - Precise needle/marker */}
              <motion.circle
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: - (score / 100) * circumference + 1 }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 }}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="white"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`2 ${circumference}`}
                className="overflow-visible shadow-xl"
              />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span className={clsx("text-3xl font-bold transition-colors duration-200", colorClass)}>
            {rounded}
          </motion.span>
        </div>
      </div>
      <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
    </div>
  );
}
