import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import PDVPage from "@/pages/PDVPage";
import MovimentosPage from "@/pages/MovimentosPage";
import FechamentoPage from "@/pages/FechamentoPage";
import ProdutosPage from "@/pages/ProdutosPage";
import RelatoriosPage from "@/pages/RelatoriosPage";
import SPRPage from "@/pages/SPRPage";
import UsuariosPage from "@/pages/UsuariosPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

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
            <Route path="/" element={<ProtectedRoute><LayoutWrapper><DashboardPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/pdv" element={<ProtectedRoute><LayoutWrapper><PDVPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/movimentos" element={<ProtectedRoute><LayoutWrapper><MovimentosPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/fechamento" element={<ProtectedRoute><LayoutWrapper><FechamentoPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/produtos" element={<ProtectedRoute adminOnly><LayoutWrapper><ProdutosPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><LayoutWrapper><RelatoriosPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/spr" element={<ProtectedRoute><LayoutWrapper><SPRPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute adminOnly><LayoutWrapper><UsuariosPage /></LayoutWrapper></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
