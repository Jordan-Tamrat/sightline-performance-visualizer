'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLandingPage = pathname === '/';
    const isSharePage = pathname.startsWith('/share');
    const hideSidebar = isLandingPage || isSharePage;

    return (
        <div className="flex min-h-screen">
            {!hideSidebar && <Sidebar />}
            <div className={`flex-1 transition-all duration-300 ${!hideSidebar ? 'md:pl-64' : ''}`}>
                {children}
            </div>
        </div>
    );
}
