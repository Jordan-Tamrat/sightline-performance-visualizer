'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Loader2, Monitor, Smartphone, Wifi, Signal,
  Zap, Activity, Brain, Network, BarChart3, Share2,
  History, PlayCircle, Settings2, LineChart, Shield, Gauge,
  ChevronDown, Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import ThemeToggle from '@/components/ThemeToggle';
import { getOrCreateUserIdentifier } from '@/lib/user';

type DeviceType = 'desktop' | 'mobile';
type NetworkType = '4g' | 'fast3g' | 'slow3g';

/* ─── Performance Radar Cursor ──────────────────────────────── */
function RadarCursor() {
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [rings, setRings] = useState<{ id: number; x: number; y: number }[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const ringId = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      const el = document.elementFromPoint(e.clientX, e.clientY);
      setIsHovering(
        !!(el && (el.closest('button') || el.closest('a') || el.closest('[data-interactive]')))
      );
    };
    const onClick = (e: MouseEvent) => {
      const id = ringId.current++;
      setRings(r => [...r, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setRings(r => r.filter(ring => ring.id !== id)), 900);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <>
      {/* Trailing dot */}
      <motion.div
        className="fixed pointer-events-none z-[9999] mix-blend-difference"
        animate={{ x: pos.x - 6, y: pos.y - 6 }}
        transition={{ type: 'spring', stiffness: 800, damping: 60, mass: 0.1 }}
      >
        <div className={clsx(
          "w-3 h-3 rounded-full transition-transform duration-200",
          isHovering ? "scale-[2.5] bg-blue-400" : "bg-blue-500"
        )} />
      </motion.div>

      {/* Radar ring */}
      <motion.div
        className="fixed pointer-events-none z-[9998]"
        animate={{ x: pos.x - 24, y: pos.y - 24 }}
        transition={{ type: 'spring', stiffness: 200, damping: 40, mass: 0.3 }}
      >
        <div className={clsx(
          "w-12 h-12 rounded-full border transition-all duration-300",
          isHovering
            ? "border-blue-400/80 scale-150 opacity-80"
            : "border-blue-500/30"
        )} />
      </motion.div>

      {/* Click ripples */}
      {rings.map(ring => (
        <motion.div
          key={ring.id}
          className="fixed pointer-events-none z-[9997] rounded-full border-2 border-blue-400/60"
          style={{ left: ring.x - 5, top: ring.y - 5, width: 10, height: 10 }}
          animate={{ scale: 8, opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      ))}
    </>
  );
}

/* ─── Interactive Eye Icon ───────────────────────────────────── */
function InteractiveEye({ className }: { className?: string }) {
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const eyeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!eyeRef.current) return;
      
      const rect = eyeRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const maxOffset = 3.5; 
      const angle = Math.atan2(dy, dx);
      const cappedDistance = Math.min(distance / 25, maxOffset); 

      setPupil({
        x: Math.cos(angle) * cappedDistance,
        y: Math.sin(angle) * cappedDistance
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <svg 
      ref={eyeRef}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <motion.circle 
        cx="12" 
        cy="12" 
        r="2.5" 
        animate={{ x: pupil.x, y: pupil.y }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/* ─── Feature Card ──────────────────────────────────────────── */
const features = [
  {
    icon: Zap,
    title: 'Lighthouse Audit',
    desc: 'Full Lighthouse v12 audit powered by Playwright. Performance, Accessibility, Best Practices, and SEO scores in one click.',
    color: 'blue',
  },
  {
    icon: Activity,
    title: 'Web Vitals Grid',
    desc: 'Real-time Web Vitals: LCP, FCP, CLS, TBT, Speed Index and TTI displayed with Google\'s official thresholds.',
    color: 'emerald',
  },
  {
    icon: Gauge,
    title: 'Score Gauge',
    desc: 'Animated arc gauge showing your performance score with color-coded severity. At a glance, know exactly where you stand.',
    color: 'violet',
  },
  {
    icon: Network,
    title: 'Network Waterfall',
    desc: 'Interactive waterfall chart showing every network request, TTFB, latency and transfer size with filter and zoom controls.',
    color: 'orange',
  },
  {
    icon: PlayCircle,
    title: 'Visual Filmstrip',
    desc: 'Frame-by-frame loading timeline. See exactly how your page renders as screenshots captured during a live Playwright run.',
    color: 'pink',
  },
  {
    icon: Brain,
    title: 'AI Insights Engine',
    desc: 'Gemini AI analyses your specific metrics and generates actionable insights sorted by High / Medium / Low severity.',
    color: 'indigo',
  },
  {
    icon: Settings2,
    title: 'Performance Forecast',
    desc: 'Interactive sliders to simulate JS reduction, image optimization and server improvements, predict your score gain instantly.',
    color: 'teal',
  },
  {
    icon: History,
    title: 'Audit History',
    desc: 'Every audit is saved and accessible from your personal history. Track performance regressions or improvements over time.',
    color: 'amber',
  },
  {
    icon: Share2,
    title: 'Shareable Reports',
    desc: 'Generate a secure public link for any report. Expiry-protected, token-based sharing with view-count tracking.',
    color: 'rose',
  },
  {
    icon: Monitor,
    title: 'Device Simulation',
    desc: 'Test from a real Desktop or Mobile viewport with configurable network throttling (4G, Fast 3G, Slow 3G).',
    color: 'cyan',
  },
  {
    icon: BarChart3,
    title: 'Score Breakdown',
    desc: 'Multi-category score grid showing Performance, Accessibility, Best Practices and SEO scores with animated progress bars.',
    color: 'green',
  },
  {
    icon: LineChart,
    title: 'Live Metrics',
    desc: 'Real numeric data — not just scores. See exact millisecond timings and byte sizes for every metric on the report.',
    color: 'slate',
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20',   glow: 'shadow-blue-500/10' },
  emerald:{ bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-emerald-500/20',glow: 'shadow-emerald-500/10' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', glow: 'shadow-violet-500/10' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', glow: 'shadow-orange-500/10' },
  pink:   { bg: 'bg-pink-500/10',   text: 'text-pink-400',   border: 'border-pink-500/20',   glow: 'shadow-pink-500/10' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', glow: 'shadow-indigo-500/10' },
  teal:   { bg: 'bg-teal-500/10',   text: 'text-teal-400',   border: 'border-teal-500/20',   glow: 'shadow-teal-500/10' },
  amber:  { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/20',  glow: 'shadow-amber-500/10' },
  rose:   { bg: 'bg-rose-500/10',   text: 'text-rose-400',   border: 'border-rose-500/20',   glow: 'shadow-rose-500/10' },
  cyan:   { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/20',   glow: 'shadow-cyan-500/10' },
  green:  { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20',  glow: 'shadow-green-500/10' },
  slate:  { bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-slate-500/20',  glow: 'shadow-slate-500/10' },
};

function FeatureCard({ feat, index }: { feat: typeof features[0]; index: number }) {
  const c = colorMap[feat.color];
  const Icon = feat.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      whileHover={{ y: -6, scale: 1.02 }}
      data-interactive="true"
      className={clsx(
        "group relative bg-white dark:bg-zinc-900/60 border rounded-2xl p-5 transition-all duration-300 cursor-default",
        "hover:shadow-xl",
        c.border, c.glow
      )}
    >
      <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", c.bg)}>
        <Icon className={clsx("w-5 h-5", c.text)} />
      </div>
      <h3 className="font-bold text-zinc-800 dark:text-zinc-100 mb-2 text-sm">{feat.title}</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{feat.desc}</p>

      {/* Hover shine */}
      <div className={clsx(
        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        "bg-gradient-to-br from-white/5 to-transparent pointer-events-none"
      )} />
    </motion.div>
  );
}

/* ─── Preview Mockups ──────────────────────────────────────── */
function ScoreMockup() {
  const score = 87;
  const r = 52, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} stroke="#27272a" strokeWidth="8" fill="none" />
        <motion.circle
          cx={cx} cy={cy} r={r} stroke="#22c55e" strokeWidth="8" fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.5, ease: 'easeOut', repeat: Infinity, repeatDelay: 3 }}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#22c55e">{score}</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="8" fill="#71717a" fontWeight="600">PERFORMANCE</text>
      </svg>
      <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
        <span className="text-emerald-400">Good</span>
        <span className="text-amber-400">Medium</span>
        <span className="text-red-400">Poor</span>
      </div>
    </div>
  );
}

function WaterfallMockup() {
  const bars = [
    { label: 'HTML',       w: 15,  delay: 0,    color: 'bg-blue-500',   left: 0 },
    { label: 'CSS',        w: 25,  delay: 12,   color: 'bg-purple-500', left: 12 },
    { label: 'JS Bundle',  w: 55,  delay: 15,   color: 'bg-orange-500', left: 15 },
    { label: 'hero.webp',  w: 35,  delay: 10,   color: 'bg-emerald-500',left: 10 },
    { label: 'font.woff2', w: 20,  delay: 8,    color: 'bg-pink-500',   left: 8  },
    { label: 'api/data',   w: 40,  delay: 30,   color: 'bg-cyan-500',   left: 30 },
  ];
  return (
    <div className="w-full space-y-1.5 py-2">
      {bars.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-500 w-16 truncate shrink-0">{b.label}</span>
          <div className="flex-1 relative h-4 bg-zinc-800/50 rounded-sm overflow-hidden">
            <motion.div
              className={clsx("absolute top-0 h-full rounded-sm opacity-80", b.color)}
              style={{ left: `${b.left}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${b.w}%` }}
              transition={{ duration: 0.8, delay: i * 0.1 + 0.4, ease: 'easeOut', repeat: Infinity, repeatDelay: 4 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FilmstripMockup() {
  const frames = [5, 30, 60, 80, 100];
  return (
    <div className="flex gap-2 items-end">
      {frames.map((fill, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15 + 0.3, repeat: Infinity, repeatDelay: 4 }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-14 h-10 rounded bg-zinc-800 border border-zinc-700 overflow-hidden relative">
            <div
              className="absolute inset-0 bg-white dark:bg-zinc-200 transition-all"
              style={{ clipPath: `inset(${100 - fill}% 0 0 0)` }}
            />
            <div className="absolute bottom-1 right-1 text-[8px] text-zinc-400">{fill}%</div>
          </div>
          <span className="text-[8px] text-zinc-500">{(i * 0.5).toFixed(1)}s</span>
        </motion.div>
      ))}
    </div>
  );
}

function InsightMockup() {
  const items = [
    { sev: 'High',   color: 'text-red-400 bg-red-500/10 border-red-500/20',   title: 'Eliminate Render-Blocking Resources' },
    { sev: 'Medium', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', title: 'Optimize LCP Image Preload Chain' },
    { sev: 'Low',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', title: 'CLS is well-optimized at 0.03' },
  ];
  return (
    <div className="w-full space-y-2">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.2 + 0.3, repeat: Infinity, repeatDelay: 4 }}
          className={clsx("flex items-center gap-3 p-3 rounded-xl border", item.color.split(' ').slice(1).join(' '))}
        >
          <Sparkles className={clsx("w-3.5 h-3.5 shrink-0", item.color.split(' ')[0])} />
          <div>
            <span className={clsx("text-[9px] font-black uppercase tracking-wider", item.color.split(' ')[0])}>{item.sev}</span>
            <p className="text-[11px] text-zinc-300 font-medium">{item.title}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function Home() {
  const [url, setUrl] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [networkType, setNetworkType] = useState<NetworkType>('4g');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<'score' | 'waterfall' | 'filmstrip' | 'insights'>('score');
  const router = useRouter();

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, -60]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    // Basic URL validation: Check for protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('Please enter a complete URL starting with http:// or https:// (e.g., https://google.com)');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const userIdentifier = getOrCreateUserIdentifier();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/api/reports/`, {
        url,
        device_type: deviceType,
        network_type: networkType,
        user_identifier: userIdentifier,
      });
      router.push(`/results/${response.data.id}`);
    } catch (err: unknown) {
      console.error('Error creating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to the server.');
      setLoading(false);
    }
  };

  const deviceOptions: { value: DeviceType; label: string; icon: React.ReactNode }[] = [
    { value: 'desktop', label: 'Desktop', icon: <Monitor className="w-4 h-4" /> },
    { value: 'mobile',  label: 'Mobile',  icon: <Smartphone className="w-4 h-4" /> },
  ];
  const networkOptions: { value: NetworkType; label: string; icon: React.ReactNode }[] = [
    { value: '4g',      label: '4G',      icon: <Wifi className="w-4 h-4" /> },
    { value: 'fast3g',  label: 'Fast 3G', icon: <Signal className="w-4 h-4" /> },
    { value: 'slow3g',  label: 'Slow 3G', icon: <Signal className="w-3 h-3" /> },
  ];

  const previews: { key: typeof activePreview; label: string; icon: React.ReactNode }[] = [
    { key: 'score',     label: 'Score',     icon: <Gauge className="w-4 h-4" /> },
    { key: 'waterfall', label: 'Waterfall', icon: <Network className="w-4 h-4" /> },
    { key: 'filmstrip', label: 'Filmstrip', icon: <PlayCircle className="w-4 h-4" /> },
    { key: 'insights',  label: 'AI Insights', icon: <Brain className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-x-hidden">
      <RadarCursor />

      {/* ── Nav ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-8 py-4 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="flex items-center gap-2">
          <InteractiveEye className="w-5 h-5 text-blue-500" />
          <span className="font-black tracking-tight text-lg bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Sightline</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <motion.a 
            href="/history" 
            whileHover={{ y: -1 }}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            History
          </motion.a>
          <motion.a 
            href="/dashboard" 
            whileHover={{ y: -1 }}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Dashboard
          </motion.a>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Hero ── */}
      <motion.section
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-24 pb-20"
      >
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#71717a15_1px,transparent_1px),linear-gradient(to_bottom,#71717a15_1px,transparent_1px)] bg-[size:40px_40px]" />
        {/* Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-emerald-500/8 blur-[100px] rounded-full" />

        <div className="relative max-w-4xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest"
          >
            <Shield className="w-3.5 h-3.5 animate-pulse" />
            Powered by Lighthouse v12 & Gemini AI
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl sm:text-8xl font-black tracking-tight leading-none"
          >
            <span className="bg-gradient-to-br from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Sightline</span>
            <br />
            <span className="text-zinc-800 dark:text-zinc-100 text-4xl sm:text-5xl font-bold">Performance Visualizer</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed"
          >
            Paste any URL. Get a full Lighthouse audit, Web Vitals, Network Waterfall, Visual Filmstrip, and AI-powered insights all in one place.
          </motion.p>

          {/* Audit Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* URL + Button */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-2xl mx-auto">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="https://your-website.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-base placeholder:text-zinc-400 shadow-sm"
                />
              </div>
              <motion.button
                type="submit"
                disabled={loading}
                data-interactive="true"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 text-white font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-blue-500/25 whitespace-nowrap text-sm uppercase tracking-wider overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <Loader2 className="animate-spin w-5 h-5" />
                  ) : (
                    <>
                      Analyze
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                      >
                        <ArrowRight className="w-5 h-5" />
                      </motion.span>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/10 transition-opacity" />
              </motion.button>
            </div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-medium"
            >
              <Sparkles className="w-3 h-3 inline mr-1 text-emerald-500" />
              Lighthouse results vary by 2-5%. Run 3+ audits for a reliable average.
            </motion.p>

            {/* Device & Network */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Device</span>
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-sm">
                  {deviceOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-interactive="true"
                      onClick={() => setDeviceType(opt.value)}
                      className={clsx(
                        "flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-full transition-all cursor-pointer",
                        deviceType === opt.value
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                      )}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Network</span>
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-sm">
                  {networkOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-interactive="true"
                      onClick={() => setNetworkType(opt.value)}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-full transition-all cursor-pointer",
                        networkType === opt.value
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                      )}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.form>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 bg-red-900/50 border border-red-500/30 rounded-2xl text-red-300 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex flex-col items-center gap-2 text-zinc-400 pt-6"
          >
            <span className="text-xs font-medium uppercase tracking-widest">Explore Features</span>
            <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Feature Grid ── */}
      <section className="py-28 px-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Everything You Need
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            One URL. <span className="text-blue-400">Complete Picture.</span>
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
            Sightline combines automated auditing, AI analysis, and interactive visualizations in a single workflow — no plugins, no config.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {features.map((feat, i) => (
            <FeatureCard key={feat.title} feat={feat} index={i} />
          ))}
        </div>
      </section>

      {/* ── Visual Preview ── */}
      <section className="py-28 px-6 bg-zinc-100/50 dark:bg-zinc-900/30 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6">
              <Activity className="w-3.5 h-3.5" />
              Live Preview
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              See What You Get
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
              Every audit generates a rich, multi-panel report. Here is a preview of the key visualization panels.
            </p>
          </motion.div>

          {/* Preview tab switcher */}
          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {previews.map(p => (
              <button
                key={p.key}
                data-interactive="true"
                onClick={() => setActivePreview(p.key)}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer",
                  activePreview === p.key
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {/* Preview Panel */}
          <motion.div
            key={activePreview}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-black/90 dark:bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-2xl shadow-black/50 min-h-[260px] flex items-center justify-center"
          >
            {activePreview === 'score' && (
              <div className="flex flex-col sm:flex-row items-center gap-12">
                <ScoreMockup />
                <div className="space-y-3 text-left">
                  <p className="text-sm font-bold text-zinc-300">Category Scores</p>
                  {[
                    { label: 'Performance', pct: 87, color: 'bg-emerald-500' },
                    { label: 'Accessibility', pct: 95, color: 'bg-blue-500' },
                    { label: 'Best Practices', pct: 92, color: 'bg-violet-500' },
                    { label: 'SEO', pct: 100, color: 'bg-pink-500' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3 w-56">
                      <span className="text-xs text-zinc-400 w-28 shrink-0">{s.label}</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          className={clsx("h-full rounded-full", s.color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${s.pct}%` }}
                          transition={{ duration: 1, delay: 0.3 }}
                        />
                      </div>
                      <span className="text-xs font-bold text-zinc-300 w-8 text-right">{s.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activePreview === 'waterfall' && (
              <div className="w-full max-w-lg">
                <p className="text-sm font-bold text-zinc-300 mb-4">Network Requests — 6 resources</p>
                <WaterfallMockup />
                <div className="flex gap-4 mt-4 text-[10px] text-zinc-500">
                  <span>Total: 1.3MB</span>
                  <span>Requests: 6</span>
                  <span>TTFB: 340ms</span>
                </div>
              </div>
            )}
            {activePreview === 'filmstrip' && (
              <div className="flex flex-col items-center gap-6">
                <p className="text-sm font-bold text-zinc-300">Page Load Filmstrip</p>
                <FilmstripMockup />
                <p className="text-xs text-zinc-500">Screenshots captured at 0.5s intervals during Playwright run</p>
              </div>
            )}
            {activePreview === 'insights' && (
              <div className="w-full max-w-sm">
                <p className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  AI-Generated Insights
                </p>
                <InsightMockup />
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5" />
            Start Analyzing
          </div>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Know Where<br />
            <span className="text-blue-400">Every Millisecond</span><br />
            Goes.
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-md mx-auto">
            Join developers who use Sightline to find and fix performance bottlenecks before users notice them.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.a
              href="#"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              data-interactive="true"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold uppercase tracking-wider shadow-xl shadow-blue-500/25 cursor-pointer text-sm"
            >
              Run Your First Audit
            </motion.a>
            <a href="/history" data-interactive="true" className="px-8 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-all text-sm uppercase tracking-wider">
              View Audit History
            </a>
          </div>
          <div className="flex items-center justify-center gap-8 text-xs text-zinc-500 pt-4">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400" /> Private &amp; Secure</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-blue-400" /> No Registration</span>
            <span className="flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5 text-violet-400" /> Shareable Reports</span>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 px-6 text-center text-xs text-zinc-400">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">Sightline</span>
        </div>
        Powered by Lighthouse v12, Playwright &amp; Gemini AI
      </footer>
    </div>
  );
}
