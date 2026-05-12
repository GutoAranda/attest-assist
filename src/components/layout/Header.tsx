import { Bell, LogOut, Search, Sun, Moon, X, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useIsMobile } from '@/hooks/use-mobile';

const formatRelativeTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} minuto${diffMin > 1 ? 's' : ''}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 30) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('pt-BR');
};

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header = ({ onToggleSidebar }: HeaderProps) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { dark, toggle: toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notifications-count'],
    queryFn: async () => {
      if (!profile) return 0;
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false);
      return count || 0;
    },
    enabled: !!profile,
    refetchInterval: 30000,
  });

  const { data: recentNotifications = [] } = useQuery({
    queryKey: ['recent-notifications'],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!profile,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 3) { setSearchResults([]); return; }
      const { data } = await supabase
        .from('solicitations')
        .select('id, ticket_id, employee_name, operations(name)')
        .or(`ticket_id.ilike.%${searchQuery}%,process_number.ilike.%${searchQuery}%,employee_name.ilike.%${searchQuery}%`)
        .neq('status', 'rascunho')
        .limit(5);
      setSearchResults(data || []);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navigateToTicket = (id: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(profile?.role === 'juridico' ? `/solicitacoes/${id}` : `/minhas-solicitacoes/${id}`);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-primary z-50 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={onToggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-baseline gap-1 cursor-pointer" onClick={() => navigate(profile?.role === 'juridico' ? '/dashboard' : '/minhas-solicitacoes')}>
          <span className="text-accent font-bold text-xl tracking-wider">LOTS</span>
          <span className="text-primary-foreground/70 font-light text-sm">DocFlow</span>
        </div>
        {!isMobile && <span className="text-primary-foreground/30 ml-2">|</span>}
        {!isMobile && <span className="text-primary-foreground/60 text-sm ml-2">Solicitações Jurídicas</span>}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Global Search */}
        <div ref={searchRef} className="relative">
          {isMobile && !searchOpen ? (
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setSearchOpen(true)}>
              <Search className="h-5 w-5" />
            </Button>
          ) : (
            <div className={`flex items-center ${isMobile ? 'absolute right-0 top-0 bg-primary px-2 w-[280px]' : ''}`}>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary-foreground/50" />
                <Input
                  data-global-search
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
                  placeholder="Buscar tickets... (Ctrl+K)"
                  className="pl-8 w-48 md:w-64 h-9 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus:bg-primary-foreground/20"
                />
                {isMobile && (
                  <Button variant="ghost" size="icon" className="absolute right-0 top-0 text-primary-foreground" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full mt-1 right-0 w-72 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                  {searchResults.map((s: any) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-4 py-3 hover:bg-accent text-sm border-b last:border-0"
                      onClick={() => navigateToTicket(s.id)}
                    >
                      <span className="font-semibold text-primary">{s.ticket_id}</span>
                      <span className="text-muted-foreground ml-2">{(s.operations as any)?.name}</span>
                      <p className="text-xs text-muted-foreground">{s.employee_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={toggleTheme}>
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-primary-foreground/10">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-danger text-primary-foreground text-xs flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b">
              <h4 className="font-semibold text-sm">Notificações</h4>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma notificação</p>
              ) : (
                recentNotifications.map((n: any) => (
                  <div key={n.id} className={`p-3 border-b text-sm cursor-pointer hover:bg-accent ${!n.read ? 'bg-info/5' : ''}`}
                    onClick={() => {
                      if (n.solicitation_id) {
                        navigate(profile?.role === 'juridico' ? `/solicitacoes/${n.solicitation_id}` : `/minhas-solicitacoes/${n.solicitation_id}`);
                      }
                    }}>
                    <p className="text-foreground">{n.message}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => navigate('/notificacoes')}>
                Ver todas
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {!isMobile && <span className="text-primary-foreground text-sm">{profile?.name}</span>}

        <Button variant="ghost" size="sm" className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 gap-1" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {!isMobile && 'Sair'}
        </Button>
      </div>
    </header>
  );
};

export default Header;
