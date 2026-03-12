'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History } from 'lucide-react';
import clsx from 'clsx';
import ThemeToggle from './ThemeToggle';

export default function Sidebar() {
    const pathname = usePathname();

    const links = [
        { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
        { href: '/history', label: 'History', icon: <History className="w-5 h-5" /> },
    ];

    return (
        <aside className="w-64 fixed inset-y-0 left-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 hidden md:flex flex-col z-50">
            <div className="p-6">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text mb-8">
                    Sightline
                </h1>
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
    );
}
