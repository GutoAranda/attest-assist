import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardView from '@/components/dashboard/DashboardView';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardAtendente = () => {
  const { profile } = useAuth();
  const { data: scope, isLoading } = useQuery({
    queryKey: ['my-scope', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('user_group_assignments').select('operation_id, area_id').eq('user_id', profile.id);
      return data || [];
    },
    enabled: !!profile,
  });
  if (isLoading || !profile) return <Skeleton className="h-96 w-full" />;
  return <DashboardView mode="atendente" scope={scope || []} profileId={profile.id} />;
};

export default DashboardAtendente;
