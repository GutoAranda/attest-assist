import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutDashboard, PlusCircle, List, FileText, Bell, FolderOpen, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar = ({ mobileOpen, onClose, collapsed = false, onToggleCollapse }: SidebarProps) => {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const juridicoItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: PlusCircle, label: 'Nova Solicitação', path: '/nova-solicitacao' },
    { icon: List, label: 'Todas as Solicitações', path: '/solicitacoes' },
    { icon: FileText, label: 'Rascunhos', path: '/rascunhos' },
    { icon: Bell, label: 'Notificações', path: '/notificacoes' },
  ];

  const adminItems: MenuItem[] = [
    { icon: Settings, label: 'Administração', path: '/admin' },
  ];

  const atendenteItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard-atendente' },
    { icon: FolderOpen, label: 'Minhas Solicitações', path: '/minhas-solicitacoes' },
    { icon: Bell, label: 'Notificações', path: '/notificacoes' },
  ];

  let menuItems: MenuItem[] = [];
  if (profile?.role === 'juridico') {
    menuItems = [...juridicoItems];
    if (profile.is_admin) menuItems = [...menuItems, ...adminItems];
  } else {
    menuItems = atendenteItems;
  }

  const isActive = (path: string) => {
    if (path === '/solicitacoes') {
      return location.pathname === '/solicitacoes' || (location.pathname.startsWith('/solicitacoes/') && profile?.role === 'juridico');
    }
    if (path === '/minhas-solicitacoes') {
      return location.pathname === '/minhas-solicitacoes' || location.pathname.startsWith('/minhas-solicitacoes/');
    }
    return location.pathname === path;
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile && onClose) onClose();
  };

  if (isMobile) {
    if (!mobileOpen) return null;
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
        <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-card border-r z-50 flex flex-col animate-in slide-in-from-left">
          <div className="p-2 flex justify-end">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <nav className="flex-1 py-2">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  "flex items-center gap-3 mx-2 px-3 py-2 rounded-lg transition-colors text-sm w-[calc(100%-16px)]",
                  isActive(item.path) ? "bg-accent-brand text-primary" : "text-muted-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
      </>
    );
  }

  const sidebarWidth = collapsed ? 'w-16' : 'w-64';

  return (
    <aside className={cn("fixed left-0 top-16 h-[calc(100vh-64px)] bg-card border-r transition-all duration-300 z-40 flex flex-col", sidebarWidth)}>
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          const btn = (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "flex items-center gap-3 mx-2 px-3 py-2 rounded-lg transition-colors text-sm",
                collapsed ? "justify-center w-[calc(100%-16px)]" : "w-[calc(100%-16px)]",
                isActive(item.path) ? "bg-accent-brand text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.path}>{btn}</div>;
        })}
      </nav>
      <div className="p-2 border-t">
        <Button variant="ghost" size="icon" className="w-full" onClick={onToggleCollapse}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
