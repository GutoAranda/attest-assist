import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import AceitarConvite from "@/pages/AceitarConvite";
import Dashboard from "@/pages/Dashboard";
import NovaSolicitacao from "@/pages/NovaSolicitacao";
import TodasSolicitacoes from "@/pages/TodasSolicitacoes";
import DetalheTicketJuridico from "@/pages/DetalheTicketJuridico";
import Rascunhos from "@/pages/Rascunhos";
import MinhasSolicitacoes from "@/pages/MinhasSolicitacoes";
import DashboardAtendente from "@/pages/DashboardAtendente";
import DetalheTicketAtendente from "@/pages/DetalheTicketAtendente";
import Notificacoes from "@/pages/Notificacoes";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!profile) return <Navigate to="/login" />;
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={profile.role === 'juridico' ? '/dashboard' : '/minhas-solicitacoes'} />;
  }
  return <>{children}</>;
};

const AuthRedirect = () => {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!profile) return <Navigate to="/login" />;
  return <Navigate to={profile.role === 'juridico' ? '/dashboard' : '/minhas-solicitacoes'} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
