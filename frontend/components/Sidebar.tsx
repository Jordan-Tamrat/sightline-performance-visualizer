'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History } from 'lucide-react';
import clsx from 'clsx';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

    const links = [
        { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
        { href: '/history', label: 'History', icon: <History className="w-5 h-5" /> },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            <div 
                className={clsx(
                    "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity md:hidden",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            <aside className={clsx(
                "fixed inset-y-0 left-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-300 ease-in-out z-50 flex flex-col w-64 md:translate-x-0 shadow-2xl md:shadow-none",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-8">
                        <Link href="/" className="group flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text cursor-pointer hover:opacity-80 transition-opacity">
                                Sightline
                            </h1>
                        </Link>
                        <button 
                            onClick={onClose}
                            className="p-2 md:hidden hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                <nav className="space-y-2">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={clsx(
                                "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors",
                                pathname === link.href || (pathname.startsWith('/results') && link.label === 'Dashboard')
                                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                            )}
                        >
                            {link.icon}
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </div>
            <div className="mt-auto p-6 border-t border-zinc-200 dark:border-zinc-800">
                <ThemeToggle showLabel={true} />
            </div>
        </aside>
        </>
    );
}
