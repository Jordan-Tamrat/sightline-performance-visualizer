'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Network, ArrowDownUp, ZoomIn, ZoomOut } from 'lucide-react';
import clsx from 'clsx';
import { useMemo, useState, useRef, useEffect } from 'react';

interface NetworkRequest {
    url: string;
    protocol: string;
    startTime: number;
    endTime: number;
    transferSize: number;
    resourceSize: number;
    resourceType: string;
    mimeType: string;
}

interface NetworkWaterfallProps {
    audits: any;
}

export default function NetworkWaterfall({ audits }: NetworkWaterfallProps) {
    const [filter, setFilter] = useState<string>('All');
    const [sortBy, setSortBy] = useState<'startTime' | 'duration' | 'size'>('startTime');
    const [zoom, setZoom] = useState<number>(1);
    const [mouseX, setMouseX] = useState<number | null>(null);
    const [scrollX, setScrollX] = useState<number>(0);
    const [baseWidth, setBaseWidth] = useState<number>(800);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setBaseWidth(containerRef.current.clientWidth - 260);
            }
        };
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const { items, globalStartTime, totalDuration } = useMemo(() => {
        if (!audits || !audits['network-requests']?.details?.items) {
            return { items: [], globalStartTime: 0, totalDuration: 0 };
        }

        let rawItems: NetworkRequest[] = [...audits['network-requests'].details.items].map((item: any) => ({
            ...item,
            startTime: item.startTime ?? item.networkRequestTime,
            endTime: item.endTime ?? item.networkEndTime,
        }));

        rawItems = rawItems.filter(item => item.startTime !== undefined && item.endTime !== undefined);
        if (rawItems.length === 0) return { items: [], globalStartTime: 0, totalDuration: 0 };

        const minTime = Math.min(...rawItems.map(item => item.startTime));
        const maxTime = Math.max(...rawItems.map(item => item.endTime));

        return { items: rawItems, globalStartTime: minTime, totalDuration: maxTime - minTime };
    }, [audits]);

    const processedItems = useMemo(() => {
        const filtered = filter === 'All'
            ? items
            : items.filter(item => {
                if (filter === 'JS') return item.resourceType === 'Script';
                if (filter === 'CSS') return item.resourceType === 'Stylesheet';
                if (filter === 'Img') return item.resourceType === 'Image';
                if (filter === 'Font') return item.resourceType === 'Font';
                return true;
            });

        return [...filtered].sort((a, b) => {
            if (sortBy === 'startTime') return a.startTime - b.startTime;
            if (sortBy === 'duration') return (b.endTime - b.startTime) - (a.endTime - a.startTime);
            if (sortBy === 'size') return b.transferSize - a.transferSize;
            return 0;
        });
    }, [items, filter, sortBy]);

    if (!items || items.length === 0) return null;

    const formatSize = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const generateTicks = () => {
        const containerWidth = 800 * zoom;
        const numTicks = Math.max(5, Math.floor(containerWidth / 100));
        const tickInterval = totalDuration / numTicks;
        return Array.from({ length: numTicks + 1 }).map((_, i) => ({
            timeMs: i * tickInterval,
            leftPct: (i * tickInterval / totalDuration) * 100,
        }));
    };

    const ticks = generateTicks();

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col h-[700px]">

            {/* Header: Title + Request Count */}
            <div className="flex items-center gap-3 mb-1 shrink-0">
                <Network className="w-5 h-5 text-indigo-500" />
                <h3 className="text-xl font-semibold">Network Waterfall</h3>
                <span className="group relative px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full cursor-default">
                    {processedItems.length} requests
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] bg-zinc-900 text-zinc-100 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-[100]">
                        This shows how many files are currently visible. Use the <b>All, JS, CSS, Img, Font</b> filters below to update this count.
                    </span>
                </span>
            </div>
            <p className="text-sm text-zinc-500 mb-4 leading-relaxed max-w-4xl">
                This timeline maps every file the browser requested to load this page laid out in the exact order and time they happened. It helps you spot bottlenecks, slow servers, and large assets that delay the page.
            </p>

            {/* Toolbar: Zoom, Sort, Filter */}
            <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
                {/* Zoom Control */}
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                    <ZoomOut className="w-4 h-4 text-zinc-500" />
                    <input
                        type="range"
                        min="1" max="10" step="0.5"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-28 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <ZoomIn className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-500 ml-1">{zoom}x</span>
                </div>

                {/* Sort Control */}
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                    <ArrowDownUp className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs text-zinc-500">Sort by:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-transparent text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none border-none cursor-pointer"
                    >
                        <option value="startTime">Start Time</option>
                        <option value="duration">Duration</option>
                        <option value="size">File Size</option>
                    </select>
                </div>

                {/* Type Filters */}
                <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg">
                    {['All', 'JS', 'CSS', 'Img', 'Font'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={clsx(
                                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                                filter === f
                                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Waterfall Area */}
            <div className="flex-1 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden relative">

                {/* Fixed Header Row */}
                <div className="flex bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 z-20 shrink-0">
                    <div className="w-[260px] shrink-0 p-3 text-xs font-semibold text-zinc-500 border-r border-zinc-200 dark:border-zinc-800">
                        Resource
                    </div>
                    <div className="flex-1 relative overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div
                            className="absolute inset-y-0"
                            style={{
                                width: `${baseWidth * zoom}px`,
                                transform: `translateX(-${scrollX}px)`
                            }}
                        >
                            {/* Header-fixed Vertical Marker Mirror */}
                            {mouseX !== null && (() => {
                                const totalWidth = baseWidth * zoom;
                                return (
                                    <div
                                        className="absolute top-0 bottom-0 w-px bg-red-500/80 z-30 pointer-events-none"
                                        style={{ left: `${mouseX}px` }}
                                    >
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap transform-gpu">
                                            {Math.round((mouseX / totalWidth) * totalDuration)}ms
                                        </div>
                                    </div>
                                );
                            })()}
                            {ticks.map((tick, i) => (
                                <div
                                    key={i}
                                    className="absolute top-0 bottom-0 border-l border-zinc-200 dark:border-zinc-700"
                                    style={{ left: `${tick.leftPct}%` }}
                                >
                                    <span className="absolute left-1 top-2 text-[10px] text-zinc-400 font-mono">
                                        {Math.round(tick.timeMs)}ms
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Scrollable Body */}
                <div
                    className="flex-1 overflow-auto custom-scrollbar"
                    ref={containerRef}
                    onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
                >
                    {/* Inner content — vertical marker + rows */}
                    <div
                        className="flex flex-col relative"
                        style={{ width: `calc(260px + (100% - 260px) * ${zoom})`, minWidth: '100%' }}
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left - 260;
                            setMouseX(Math.max(0, x));
                        }}
                        onMouseLeave={() => setMouseX(null)}
                    >
                        {/* Background grid + Vertical Marker */}
                        <div
                            className="absolute top-0 bottom-0 z-0 pointer-events-none"
                            style={{ left: '260px', right: 0 }}
                        >
                            <div className="relative w-full h-full">
                                {/* Vertical Tracking Marker */}
                                {mouseX !== null && (() => {
                                    const totalWidth = baseWidth * zoom;
                                    const currentTime = (mouseX / totalWidth) * totalDuration;
                                    return (
                                        <div
                                            className="absolute top-0 bottom-0 w-px bg-red-500/60 z-30 pointer-events-none"
                                            style={{ left: `${mouseX}px` }}
                                        >
                                            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-zinc-900 shadow-sm" />
                                            <div
                                                className="absolute -top-7 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap border border-red-400"
                                                style={{ transform: 'translateX(-50%)' }}
                                            >
                                                {Math.round(currentTime)}ms
                                            </div>
                                        </div>
                                    );
                                })()}
                                {ticks.map((tick, i) => (
                                    <div
                                        key={`bg-${i}`}
                                        className="absolute top-0 bottom-0 border-l border-zinc-100 dark:border-zinc-800/50"
                                        style={{ left: `${tick.leftPct}%` }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Rows */}
                        <AnimatePresence>
                            {processedItems.map((item, index) => {
                                const relativeStart = item.startTime - globalStartTime;
                                const relativeEnd = item.endTime - globalStartTime;
                                const itemDuration = Math.max(relativeEnd - relativeStart, 1);
                                const leftPct = (relativeStart / totalDuration) * 100;
                                const widthPct = Math.max((itemDuration / totalDuration) * 100, 0.2);

                                let filename = 'unknown';
                                try {
                                    const urlObj = new URL(item.url);
                                    filename = urlObj.pathname.split('/').pop() || urlObj.hostname;
                                    if (!filename) filename = urlObj.hostname;
                                } catch {
                                    filename = item.url.substring(0, 30);
                                }

                                return (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        key={`${item.url}-${index}`}
                                        onMouseEnter={() => setHoveredItem(item.url)}
                                        onMouseLeave={() => setHoveredItem(null)}
                                        className={clsx(
                                            "flex border-b border-zinc-100 dark:border-zinc-800/30 z-10 group transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20",
                                            hoveredItem === item.url && "relative z-[60]"
                                        )}
                                    >
                                        {/* Left Panel: Fixed width */}
                                        <div className="w-[260px] shrink-0 p-2 flex flex-col justify-center border-r border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 sticky left-0 z-20 backdrop-blur-sm">
                                            <span className="text-[11px] font-mono truncate text-zinc-700 dark:text-zinc-300" title={item.url}>{filename}</span>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] text-zinc-400 uppercase">{item.resourceType}</span>
                                                <span className="text-[10px] text-zinc-500 font-medium">{formatSize(item.transferSize)}</span>
                                            </div>
                                        </div>

                                        {/* Right Panel: Timeline Bar */}
                                        <div className="flex-1 relative py-2">
                                            <div className="absolute inset-0">
                                                {/* Single solid bar */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm bg-indigo-500 dark:bg-indigo-400 cursor-crosshair shadow-md ring-1 ring-white/10"
                                                    style={{
                                                        left: `${leftPct}%`,
                                                        width: `${widthPct}%`,
                                                        minWidth: '2px',
                                                    }}
                                                />

                                                {/* Duration label on hover */}
                                                <span
                                                    className="absolute top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 pointer-events-none"
                                                    style={{ left: `calc(${leftPct + widthPct}%)` }}
                                                >
                                                    {Math.round(itemDuration)}ms
                                                </span>
                                            </div>

                                            {/* Tooltip — smart anchoring */}
                                            <AnimatePresence>
                                                {hoveredItem === item.url && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        className={clsx(
                                                            "absolute z-[100] bg-zinc-900 text-zinc-100 p-3 rounded-lg shadow-2xl text-xs w-64 border border-zinc-700 pointer-events-none",
                                                            index > processedItems.length / 2 ? "bottom-full mb-1" : "top-full mt-1"
                                                        )}
                                                        style={{
                                                            left: `${leftPct}%`,
                                                            transform: leftPct > 70 ? 'translateX(-100%)' : 'none'
                                                        }}
                                                    >
                                                        <div className="font-mono text-[10px] text-zinc-400 mb-2 truncate break-all pb-1">{item.url}</div>
                                                        <div className="space-y-1.5">
                                                            <div className="flex justify-between items-center"><span className="text-zinc-500">Starts at</span> <span className="font-mono text-indigo-400">{Math.round(item.startTime)}ms</span></div>
                                                            <div className="flex justify-between items-center"><span className="text-zinc-500">Duration</span> <span className="font-mono text-emerald-400">{Math.round(itemDuration)}ms</span></div>
                                                            <div className="flex justify-between items-center"><span className="text-zinc-500">Network Size</span> <span className="font-mono text-amber-400">{formatSize(item.transferSize)}</span></div>
                                                            <div className="flex justify-between items-center"><span className="text-zinc-500">Content Type</span> <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-zinc-300">{item.resourceType}</span></div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}