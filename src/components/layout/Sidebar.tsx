import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutDashboard, PlusCircle, List, FileText, Bell, FolderOpen, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
    { icon: FolderOpen, label: 'Minhas Solicitações', path: '/minhas-solicitacoes' },
    { icon: Bell, label: 'Notificações', path: '/notificacoes' },
  ];

  let menuItems: MenuItem[] = [];
  if (profile?.role === 'juridico') {
    menuItems = [...juridicoItems];
    if (profile.is_admin) {
      menuItems = [...menuItems, ...adminItems];
    }
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

  return (
    <aside className={cn(
      "fixed left-0 top-16 h-[calc(100vh-64px)] bg-card border-r transition-all duration-300 z-40 flex flex-col",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="p-2">
        <Button variant="ghost" size="icon" className="w-full flex justify-center" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 py-2">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          const btn = (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-3 mx-2 px-3 py-2 rounded-lg transition-colors text-sm",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
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
          return btn;
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
