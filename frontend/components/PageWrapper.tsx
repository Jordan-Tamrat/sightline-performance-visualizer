'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLandingPage = pathname === '/';

    return (
        <div className="flex min-h-screen">
            {!isLandingPage && <Sidebar />}
            <div className={`flex-1 transition-all duration-300 ${!isLandingPage ? 'md:pl-64' : ''}`}>
                {children}
            </div>
        </div>
    );
}
