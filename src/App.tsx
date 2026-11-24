import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { ToastProvider } from './components/Toast';
import { Shell } from './components/Shell';

// Páginas
import { Login } from './pages/auth/Login';
import { Clientes } from './pages/agencia/Clientes';
import { Usuarios } from './pages/agencia/Usuarios';
import { DashboardGeral } from './pages/cliente/DashboardGeral';
import { Pipeline } from './pages/cliente/Pipeline';
import { Leads } from './pages/cliente/Leads';
import { Vendas } from './pages/cliente/Vendas';
import { Equipe } from './pages/cliente/Equipe';
import { FollowUp } from './pages/cliente/FollowUp';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minuto
      retry: 1,
    },
  },
});

// Componente que decide o destino inicial baseado no perfil logado
const RootRedirect: React.FC = () => {
  const { perfil, loading } = useAuth();

  if (loading) return null;

  if (perfil?.papel === 'superadmin' || perfil?.papel === 'agencia') {
    return <Navigate to="/agencia/clientes" replace />;
  }

  if (perfil?.cliente_id) {
    return <Navigate to={`/c/${perfil.cliente_id}/geral`} replace />;
  }

  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Rota pública de login */}
              <Route path="/login" element={<Login />} />

              {/* Rotas autenticadas dentro do Shell */}
              <Route
                element={
                  <RequireAuth>
                    <Shell />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<RootRedirect />} />

                {/* Agência */}
                <Route path="/agencia/clientes" element={<Clientes />} />
                <Route path="/agencia/usuarios" element={<Usuarios />} />

                {/* Cliente */}
                <Route path="/c/:clienteId/geral" element={<DashboardGeral />} />
                <Route path="/c/:clienteId/pipeline" element={<Pipeline />} />
                <Route path="/c/:clienteId/leads" element={<Leads />} />
                <Route path="/c/:clienteId/vendas" element={<Vendas />} />
                <Route path="/c/:clienteId/follow-up" element={<FollowUp />} />
                <Route path="/c/:clienteId/equipe" element={<Equipe />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
