'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
    const [mounted, setMounted] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTheme(saved);
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'theme') {
                const newTheme = e.newValue as 'light' | 'dark';
                if (newTheme === 'light' || newTheme === 'dark') {
                    setTheme(newTheme);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [theme, mounted]);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };

    if (!mounted) {
        return (
            <div className={`flex items-center ${showLabel ? 'gap-3' : ''}`}>
                <div className="w-9 h-9 p-2 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
                {showLabel && <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Theme</span>}
            </div>
        );
    }

    return (
        <div className={`flex items-center ${showLabel ? 'gap-3' : ''}`}>
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="p-2 w-9 h-9 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
                {theme === 'dark' ? (
                    <Moon className="w-5 h-5 text-blue-400" />
                ) : (
                    <Sun className="w-5 h-5 text-amber-500" />
                )}
            </motion.button>
            
            {showLabel && (
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
            )}
        </div>
    );
}