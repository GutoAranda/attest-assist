import { Outlet, useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SIDEBAR_KEY = 'lots-sidebar-collapsed';

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  useKeyboardShortcuts();

  const toggleCollapse = () => {
    setSidebarCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const onExpire = async () => {
    await signOut();
    toast.error('Sessão expirada por inatividade');
    navigate('/login');
  };

  const { warning, secondsLeft, continueSession } = useSessionTimeout(onExpire, !!user);

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={() => setSidebarOpen(o => !o)} />
      <Sidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      <main className={`mt-16 p-4 md:p-6 min-h-[calc(100vh-64px)] transition-all duration-300 print:m-0 print:p-0 ${isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-16 print:ml-0' : 'ml-64 print:ml-0'}`}>
        <Outlet />
      </main>

      <Dialog open={warning} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sessão prestes a expirar</DialogTitle>
            <DialogDescription>
              Sua sessão vai expirar em <strong>{secondsLeft}</strong> segundo{secondsLeft === 1 ? '' : 's'} por inatividade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={continueSession}>Continuar conectado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;
