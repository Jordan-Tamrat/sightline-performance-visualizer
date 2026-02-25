'use client';

import React, { useMemo, useState, useRef } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { Network, ZoomIn } from 'lucide-react';
import clsx from 'clsx';

// Simple hook for resize observation
const useResizeObserver = (ref: React.RefObject<HTMLDivElement | null>) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    React.useEffect(() => {
        if (!ref.current) return;

        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setDimensions({ width, height });
            }
        });

        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref]);

    return dimensions;
};

interface NetworkRequest {
    url: string;
    protocol: string;
    startTime: number;
    endTime: number;
    transferSize: number;
    resourceSize: number;
    resourceType: string;
    mimeType: string;
    isOptimized?: boolean;
    isRenderBlocking?: boolean;
}

interface ChartData {
    name: string;
    url: string;
    start: number;
    duration: number;
    size: number;
    fullSize: string;
    impactScore: number;
    impactLevel: 'high' | 'medium' | 'low';
    isOptimizedImage: boolean;
    isRenderBlockingScript: boolean;
    resourceType: string;
}

interface AuditItem {
    url: string;
    startTime?: number;
    endTime?: number;
    networkRequestTime?: number;
    networkEndTime?: number;
    transferSize?: number;
    resourceType?: string;
    protocol?: string;
    resourceSize?: number;
    mimeType?: string;
}

interface NetworkWaterfallProps {
    audits: {
        'network-requests'?: {
            details?: {
                items?: AuditItem[];
            };
        };
        'render-blocking-resources'?: {
            details?: {
                items?: AuditItem[];
            };
        };
        'modern-image-formats'?: {
            details?: {
                items?: AuditItem[];
            };
        };
        'uses-optimized-images'?: {
            details?: {
                items?: AuditItem[];
            };
        };
        'uses-webp-images'?: {
            details?: {
                items?: AuditItem[];
            };
        };
    };
}

const calculateImpactScore = (
    item: NetworkRequest,
    totalDuration: number,
    maxTransferSize: number,
    globalStartTime: number
): number => {
    const duration = item.endTime - item.startTime;
    const normalizedDuration = totalDuration > 0 ? duration / totalDuration : 0;
    const normalizedSize = maxTransferSize > 0 ? item.transferSize / maxTransferSize : 0;
    const normalizedStart = totalDuration > 0 ? (item.startTime - globalStartTime) / totalDuration : 0;
    const earlyWeight = 1 - normalizedStart;
    let impact = (normalizedDuration * 0.5) + (normalizedSize * 0.3) + (earlyWeight * 0.2);
    const multipliers: Record<string, number> = {
        'Script': 1.3,
        'Stylesheet': 1.2,
        'Image': 1.0,
        'Font': 0.8
    };
    const multiplier = multipliers[item.resourceType] || 0.7;
    impact *= multiplier;
    return Math.min(1, Math.max(0, impact));
};

const getImpactLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
};

const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const normalizeUrl = (url: string) => url.split('?')[0];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ChartData }[] }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as ChartData;
        const impactColors = {
            high: 'text-red-500 bg-red-500/10 border-red-500/20',
            medium: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
            low: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
        };

        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-2xl max-w-sm backdrop-blur-md z-50">
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mb-2 truncate max-w-[280px] opacity-80" title={data.url}>
                    {data.url}
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Start</span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">{data.start}ms</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Duration</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{Math.round(data.duration)}ms</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Size</span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">{data.fullSize}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Impact</span>
                        <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-black uppercase border", impactColors[data.impactLevel])}>
                            {data.impactLevel} ({Math.round(data.impactScore * 100)}%)
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Type</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold text-[10px] uppercase tracking-wider">{data.resourceType}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

interface TickProps {
    x: number;
    y: number;
    payload: {
        index: number;
        value: string | number;
    };
}

const CustomYAxisTick = (props: TickProps & { chartData: ChartData[] }) => {
    const { y, payload, chartData } = props;
    const index = payload.index;
    const data = chartData?.[index];
    if (!data) return null;

    return (
        <foreignObject x={0} y={y - 18} width={260} height={35}>
            <div className="flex flex-col justify-center h-full px-4 border-r border-zinc-200 dark:border-zinc-800/30 transition-colors">
                <span className="text-[11px] font-bold truncate block w-full text-zinc-800 dark:text-zinc-100" title={data.url}>
                    {data.name}
                </span>
                <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[8px] text-zinc-400 dark:text-zinc-500 uppercase font-black tracking-widest">{data.resourceType}</span>
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">{data.fullSize}</span>
                </div>
            </div>
        </foreignObject>
    );
};

export default function NetworkWaterfall({ audits }: NetworkWaterfallProps) {
    const [zoom, setZoom] = useState(1);
    const [sortMode, setSortMode] = useState<'start' | 'duration' | 'size' | 'impact'>('start');
    const [filterType, setFilterType] = useState<'All' | 'Script' | 'Stylesheet' | 'Image' | 'Font'>('All');

    // Tracking state for the live marker
    const [markerPos, setMarkerPos] = useState<{ x: number, time: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const headerContainerRef = useRef<HTMLDivElement>(null);
    const headerDimensions = useResizeObserver(headerContainerRef);

    const renderBlockingSet = useMemo(() => {
        const urls = audits['render-blocking-resources']?.details?.items?.map((item) => item.url) || [];
        return new Set(urls.map(normalizeUrl));
    }, [audits]);

    const optimizedImageSet = useMemo(() => {
        const modern = audits['modern-image-formats']?.details?.items?.map((item) => item.url) || [];
        const opt = audits['uses-optimized-images']?.details?.items?.map((item) => item.url) || [];
        const webp = audits['uses-webp-images']?.details?.items?.map((item) => item.url) || [];
        return new Set([...modern, ...opt, ...webp].map(normalizeUrl));
    }, [audits]);

    const globalStats = useMemo(() => {
        if (!audits || !audits['network-requests']?.details?.items) return { startTime: 0, endTime: 0, duration: 0, maxTransferSize: 0 };
        const raw = audits['network-requests'].details.items as AuditItem[];
        const valid = raw.filter((r) => (r.startTime ?? r.networkRequestTime) !== undefined);
        if (valid.length === 0) return { startTime: 0, endTime: 0, duration: 0, maxTransferSize: 0 };
        const start = Math.min(...valid.map((r) => r.startTime ?? r.networkRequestTime!));
        const end = Math.max(...valid.map((r) => r.endTime ?? r.networkEndTime!));
        return {
            startTime: start,
            endTime: end,
            duration: Math.max(1, end - start),
            maxTransferSize: Math.max(...valid.map((r) => r.transferSize ?? 0))
        };
    }, [audits]);

    const chartData = useMemo(() => {
        if (!audits || !audits['network-requests']?.details?.items) return [];

        const rawRequests: NetworkRequest[] = (audits['network-requests']?.details?.items || []).map((item: AuditItem) => ({
            url: item.url,
            protocol: item.protocol || '',
            startTime: item.startTime ?? item.networkRequestTime ?? 0,
            endTime: item.endTime ?? item.networkEndTime ?? 0,
            transferSize: item.transferSize || 0,
            resourceSize: item.resourceSize || 0,
            resourceType: item.resourceType || '',
            mimeType: item.mimeType || '',
        }));

        const validRequests = rawRequests.filter(r => r.startTime !== undefined && r.endTime !== undefined);
        if (validRequests.length === 0) return [];

        const { startTime: globalStartTime, duration: totalDuration, maxTransferSize } = globalStats;

        let transformed: ChartData[] = validRequests.map((item, index) => {
            const start = Math.max(0, item.startTime - globalStartTime);
            const duration = Math.max(1, item.endTime - item.startTime);
            const impactScore = calculateImpactScore(item, totalDuration, maxTransferSize, globalStartTime);

            const isRenderBlockingScript = item.resourceType === 'Script' && renderBlockingSet.has(normalizeUrl(item.url));
            const isOptimizedImage = item.resourceType === 'Image' && optimizedImageSet.has(normalizeUrl(item.url));

            return {
                id: `res-${index}-${item.startTime}`, // Unique ID to prevent stacking
                name: item.url.split('/').pop()?.split('?')[0] || item.url,
                url: item.url,
                start: Math.round(start),
                duration: Math.round(duration),
                size: item.transferSize || 0,
                fullSize: formatSize(item.transferSize || 0),
                impactScore: impactScore,
                impactLevel: getImpactLevel(impactScore),
                isOptimizedImage,
                isRenderBlockingScript,
                resourceType: item.resourceType
            };
        });

        if (filterType !== 'All') {
            transformed = transformed.filter(item => item.resourceType === filterType);
        }

        return transformed.sort((a, b) => {
            if (sortMode === 'start') return a.start - b.start;
            if (sortMode === 'duration') return b.duration - a.duration;
            if (sortMode === 'size') return b.size - a.size;
            return b.impactScore - a.impactScore;
        });
    }, [audits, renderBlockingSet, optimizedImageSet, sortMode, filterType, globalStats]);

    const getBarColor = (data: ChartData) => {
        if (data.isRenderBlockingScript) return '#a855f7';
        if (data.isOptimizedImage) return '#3b82f6';
        if (data.impactLevel === 'high') return '#ef4444';
        if (data.impactLevel === 'medium') return '#f59e0b';
        return '#10b981';
    };

    const handleMouseMoveHandler = (e: React.MouseEvent) => {
        if (!containerRef.current || !globalStats.duration) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;

        const isYAxisHidden = zoom > 10; // Only hide at extreme levels, far beyond the 5x max
        const yAxisWidth = isYAxisHidden ? 0 : 260;
        const marginLeft = 10;
        const marginRight = 100;
        const totalLeftOffset = yAxisWidth + marginLeft;

        const gridWidth = rect.width - totalLeftOffset - marginRight;
        const relativeX = x - totalLeftOffset;

        const displayDuration = Math.max(globalStats.duration, 28000);

        if (relativeX >= 0 && relativeX <= gridWidth) {
            const timeValue = (relativeX / gridWidth) * displayDuration;
            setMarkerPos({ x, time: Math.round(timeValue) });
        } else {
            setMarkerPos(null);
        }
    };

    if (chartData.length === 0) return null;

    const rowHeight = 35;
    const chartHeight = chartData.length * rowHeight;
    const isYAxisHidden = zoom > 10;

    return (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl flex flex-col h-[850px] overflow-hidden">
            {/* Controls Area */}
            {/* Controls Area: Reorganized for better clarity */}
            <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-900 shrink-0 space-y-5">
                {/* Row 1: Branding & Summary */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <Network className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black uppercase tracking-tighter italic text-zinc-900 dark:text-zinc-100">Network Waterfall</h3>
                            <span
                                className="px-2 py-0.5 text-[10px] font-black uppercase bg-indigo-500 text-white rounded-md cursor-help"
                                title="Total requests currently visible. This count reflects the active filter tab selected below."
                            >
                                {chartData.length} Requests
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-900 rounded-lg w-fit">
                        <ZoomIn className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        <input
                            type="range" min="1" max="5" step="0.1"
                            value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-24 accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 w-6">{zoom.toFixed(1)}x</span>
                    </div>
                </div>

                {/* Row 2: Comprehensive Description */}
                <div className="max-w-3xl">
                    <p className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
                        The Network Waterfall provides a visual timeline of all resources loaded by the page.
                        Each bar represents a request, showing when it started relative to the page load and its duration.
                        Use this to identify render-blocking assets, analyze load sequence, and pinpoint critical bottlenecks.
                    </p>
                </div>

                {/* Row 3: Interactive Controls */}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center gap-2 w-fit">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Filter By</span>
                        <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900/50 p-1 border border-zinc-200 dark:border-zinc-900 rounded-lg">
                            {['All', 'Script', 'Stylesheet', 'Image', 'Font', 'Fetch'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type as 'All' | 'Script' | 'Stylesheet' | 'Image' | 'Font')}
                                    className={clsx("px-2.5 py-1 text-[9px] font-black uppercase rounded-md transition-all",
                                        filterType === type ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300")}
                                >
                                    {type === 'Stylesheet' ? 'CSS' : type === 'Script' ? 'JS' : type === 'Image' ? 'Img' : type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-fit">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Sort By</span>
                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-900 rounded-lg divide-x divide-zinc-200 dark:divide-zinc-900">
                            {['start', 'duration', 'impact', 'size'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setSortMode(mode as 'start' | 'duration' | 'size' | 'impact')}
                                    className={clsx("px-3 py-1.5 text-[10px] font-bold uppercase transition-colors",
                                        sortMode === mode ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/5" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300")}
                                >
                                    {mode === 'start' ? 'Time' : mode}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Waterfall Body Container with Sticky Header support */}
            <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar bg-white dark:bg-zinc-950 relative scroll-smooth" onMouseLeave={() => setMarkerPos(null)}>
                <div style={{ width: `${100 * zoom}%`, minWidth: '100%' }}>

                    {/* ENHANCED STICKY HEADER: Resource Label + Time Scale Axis */}
                    <div className="sticky top-0 z-50 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-900 flex">
                        {/* Resource Column Header */}
                        {!isYAxisHidden && (
                            <div className="w-[260px] shrink-0 border-r border-zinc-200 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 px-4 flex items-center h-[45px]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Resource</span>
                            </div>
                        )}

                        {/* Time Scale Axis Header */}
                        {/* Time Scale Axis Header */}
                        <div ref={headerContainerRef} className="flex-1 min-w-0 relative h-[45px] flex items-end overflow-hidden">
                            {headerDimensions.width > 0 && (
                                <BarChart
                                    width={headerDimensions.width}
                                    height={45}
                                    data={chartData.slice(0, 1)}
                                    margin={{ top: 25, right: 100, left: 10, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-900" opacity={0.2} />
                                    <XAxis
                                        dataKey="start"
                                        type="number"
                                        tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold', dy: -6 }}
                                        axisLine={false}
                                        unit="ms"
                                        orientation="top"
                                        opacity={0.8}
                                        domain={[0, Math.max(globalStats.duration, 28000)]}
                                        hide={false}
                                    />
                                    <Bar dataKey="duration" fill="transparent" isAnimationActive={false} />
                                </BarChart>
                            )}

                            {/* MARKER BADGE: Sync with cursor position */}
                            {markerPos && (
                                <div
                                    className="absolute top-0 h-full w-[1px] pointer-events-none z-[60]"
                                    style={{ left: markerPos.x - (isYAxisHidden ? 0 : 260) }}
                                >
                                    <div className="absolute top-[2px] left-1/2 -translate-x-1/2">
                                        <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-sm shadow-[0_4px_12px_rgba(239,68,68,0.4)] whitespace-nowrap border border-red-500/50 flex flex-col items-center">
                                            {markerPos.time}ms
                                            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-red-600 absolute -bottom-[4px]" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MAIN SCROLLABLE CONTENT: Bars and Grid */}
                    <div
                        ref={containerRef}
                        className="relative cursor-crosshair min-h-full"
                        style={{ height: chartHeight + 20 }}
                        onMouseMove={handleMouseMoveHandler}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ top: 0, right: 100, left: 10, bottom: 20 }}
                                barGap={0}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-900" opacity={0.2} />
                                <XAxis
                                    type="number"
                                    domain={[0, Math.max(globalStats.duration, 28000)]}
                                    hide={true}
                                />
                                <YAxis
                                    dataKey="id"
                                    type="category"
                                    width={260}
                                    interval={0}
                                    tick={<CustomYAxisTick chartData={chartData} />}
                                    axisLine={false}
                                    hide={isYAxisHidden}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: 'currentColor', className: 'text-zinc-50 dark:text-zinc-800/10' }}
                                    isAnimationActive={true}
                                />

                                <Bar
                                    dataKey="start"
                                    stackId="a"
                                    fill="transparent"
                                    isAnimationActive={true}
                                    animationDuration={500}
                                    animationEasing="ease-in-out"
                                />
                                <Bar
                                    dataKey="duration"
                                    stackId="a"
                                    radius={[1, 1, 1, 1]}
                                    barSize={6}
                                    isAnimationActive={true}
                                    animationDuration={500}
                                    animationEasing="ease-in-out"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>

                        {/* MARKER LINE: Spans full content height */}
                        {markerPos && (
                            <div
                                className="absolute top-0 bottom-0 w-[1px] bg-red-500/80 z-40 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                style={{ left: markerPos.x }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Legend / Status Bar */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-900 shrink-0 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <div className="w-2.5 h-1.5 rounded-sm bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" /> High Impact
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <div className="w-2.5 h-1.5 rounded-sm bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]" /> Render Blocking
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <div className="w-2.5 h-1.5 rounded-sm bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" /> Optimized Image
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <div className="w-2.5 h-1.5 rounded-sm bg-f59e0b shadow-[0_0_8px_rgba(245,158,11,0.3)]" style={{ backgroundColor: '#f59e0b' }} /> Medium Impact
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <div className="w-2.5 h-1.5 rounded-sm bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" /> Low Impact
                </div>
            </div>
        </div>
    );
}