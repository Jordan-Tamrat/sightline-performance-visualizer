import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

interface GaugeProps {
  score: number;
  label: string;
  size?: number;
}

export default function Gauge({ score, label, size = 120 }: GaugeProps) {
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
            className="text-zinc-800"
          />
          {/* Progress Circle */}
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
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span className={clsx("text-3xl font-bold transition-colors duration-200", colorClass)}>
            {rounded}
          </motion.span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-zinc-400">{label}</span>
    </div>
  );
}
