import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";

// Lazy-loaded routes for code splitting (reduces initial bundle size)
const AceitarConvite = lazy(() => import("@/pages/AceitarConvite"));
const AppLayout = lazy(() => import("@/components/layout/AppLayout"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const NovaSolicitacao = lazy(() => import("@/pages/NovaSolicitacao"));
const TodasSolicitacoes = lazy(() => import("@/pages/TodasSolicitacoes"));
const DetalheTicketJuridico = lazy(() => import("@/pages/DetalheTicketJuridico"));
const Rascunhos = lazy(() => import("@/pages/Rascunhos"));
const MinhasSolicitacoes = lazy(() => import("@/pages/MinhasSolicitacoes"));
const DashboardAtendente = lazy(() => import("@/pages/DashboardAtendente"));
const DetalheTicketAtendente = lazy(() => import("@/pages/DetalheTicketAtendente"));
const Notificacoes = lazy(() => import("@/pages/Notificacoes"));
const Admin = lazy(() => import("@/pages/Admin"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Aggressive caching: data stays fresh for 2min, kept in memory for 10min.
// Prevents refetch on remount (when navigating back to a page).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">
    Carregando...
  </div>
);

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!profile) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={profile.role === 'juridico' ? '/dashboard' : '/dashboard-atendente'} replace />;
  }
  return <>{children}</>;
};

const AuthRedirect = () => {
  const { profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === 'juridico' ? '/dashboard' : '/dashboard-atendente'} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/aceitar-convite" element={<AceitarConvite />} />
              <Route path="/" element={<AuthRedirect />} />

              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<ProtectedRoute roles={['juridico']}><Dashboard /></ProtectedRoute>} />
                <Route path="/nova-solicitacao" element={<ProtectedRoute roles={['juridico']}><NovaSolicitacao /></ProtectedRoute>} />
                <Route path="/solicitacoes" element={<ProtectedRoute roles={['juridico']}><TodasSolicitacoes /></ProtectedRoute>} />
                <Route path="/solicitacoes/:id" element={<ProtectedRoute roles={['juridico']}><DetalheTicketJuridico /></ProtectedRoute>} />
                <Route path="/rascunhos" element={<ProtectedRoute roles={['juridico']}><Rascunhos /></ProtectedRoute>} />
                <Route path="/minhas-solicitacoes" element={<ProtectedRoute roles={['atendente']}><MinhasSolicitacoes /></ProtectedRoute>} />
                <Route path="/dashboard-atendente" element={<ProtectedRoute roles={['atendente']}><DashboardAtendente /></ProtectedRoute>} />
                <Route path="/minhas-solicitacoes/:id" element={<ProtectedRoute roles={['atendente']}><DetalheTicketAtendente /></ProtectedRoute>} />
                <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute roles={['juridico']}><Admin /></ProtectedRoute>} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
