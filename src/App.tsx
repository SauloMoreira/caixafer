import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import ProfilePage from "@/pages/ProfilePage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import DashboardPage from "@/pages/DashboardPage";
import PDVPage from "@/pages/PDVPage";
import MovimentosPage from "@/pages/MovimentosPage";
import FechamentoPage from "@/pages/FechamentoPage";
import ProdutosPage from "@/pages/ProdutosPage";
import CategoriasPage from "@/pages/CategoriasPage";
import CategoriasMovimentacaoPage from "@/pages/CategoriasMovimentacaoPage";
import RelatoriosPage from "@/pages/RelatoriosPage";
import SPRPage from "@/pages/SPRPage";
import UsuariosPage from "@/pages/UsuariosPage";
import MeuSPRPage from "@/pages/MeuSPRPage";
import NotificacoesPage from "@/pages/NotificacoesPage";
import NotFound from "@/pages/NotFound";
import SegurancaPage from "@/pages/SegurancaPage";
import InsightsPage from "@/pages/InsightsPage";
import InteligenciaPage from "@/pages/InteligenciaPage";
import EstoquePage from "@/pages/EstoquePage";
import MfaSetupPage from "@/pages/MfaSetupPage";
import MfaVerifyPage from "@/pages/MfaVerifyPage";
import HistoricoTransferenciasPage from "@/pages/HistoricoTransferenciasPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - prevent aggressive refetching
      refetchOnWindowFocus: false, // prevent flicker on tab switch
      retry: 1,
    },
  },
});

function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/mfa-setup" element={<MfaSetupPage />} />
            <Route path="/mfa-verify" element={<MfaVerifyPage />} />
            <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'cash_coordinator', 'volunteer']}><LayoutWrapper><DashboardPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/pdv" element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'cash_coordinator']}><LayoutWrapper><PDVPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/movimentos" element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'cash_coordinator']}><LayoutWrapper><MovimentosPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/fechamento" element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'cash_coordinator']}><LayoutWrapper><FechamentoPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/produtos" element={<ProtectedRoute allowedRoles={['admin', 'cash_coordinator']}><LayoutWrapper><ProdutosPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/categorias" element={<ProtectedRoute allowedRoles={['admin', 'cash_coordinator']}><LayoutWrapper><CategoriasPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/categorias-movimentacao" element={<ProtectedRoute adminOnly><LayoutWrapper><CategoriasMovimentacaoPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'cash_coordinator']}><LayoutWrapper><RelatoriosPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/spr" element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'cash_coordinator']}><LayoutWrapper><SPRPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute adminOnly><LayoutWrapper><UsuariosPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/seguranca" element={<ProtectedRoute adminOnly><LayoutWrapper><SegurancaPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/historico-transferencias" element={<ProtectedRoute adminOnly><LayoutWrapper><HistoricoTransferenciasPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute allowedRoles={['admin', 'cash_coordinator']}><LayoutWrapper><InsightsPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/estoque" element={<ProtectedRoute allowedRoles={['admin', 'cash_coordinator']}><LayoutWrapper><EstoquePage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/inteligencia" element={<ProtectedRoute allowedRoles={['admin', 'cash_coordinator']}><LayoutWrapper><InteligenciaPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/notificacoes" element={<ProtectedRoute allowedRoles={['admin', 'cash_coordinator']}><LayoutWrapper><NotificacoesPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/meu-consumo" element={<ProtectedRoute allowedRoles={['volunteer']}><LayoutWrapper><MeuSPRPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
