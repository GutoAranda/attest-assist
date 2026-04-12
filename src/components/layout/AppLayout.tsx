import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  useKeyboardShortcuts();

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={() => setSidebarOpen(o => !o)} />
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={`mt-16 p-4 md:p-6 min-h-[calc(100vh-64px)] transition-all duration-300 ${isMobile ? 'ml-0' : 'ml-64'}`}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
