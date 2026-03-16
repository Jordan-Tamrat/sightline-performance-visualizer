'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // Close mobile menu on route change
    useEffect(() => {
        if (isMobileMenuOpen) {
            const timer = setTimeout(() => setIsMobileMenuOpen(false), 0);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const isLandingPage = pathname === '/';
    const isSharePage = pathname.startsWith('/share');
    const hideSidebar = isLandingPage || isSharePage;

    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            {!hideSidebar && (
                <>
                    {/* Mobile Header */}
                    <header className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40">
                        <Link href="/">
                            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text cursor-pointer">
                                Sightline
                            </h1>
                        </Link>
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </header>
                    
                    <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
                </>
            )}
            <div className={`flex-1 transition-all duration-300 w-full ${!hideSidebar ? 'md:pl-64' : ''}`}>
                {children}
            </div>
        </div>
    );
}
