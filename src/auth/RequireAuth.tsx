import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, perfil, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted">
        Carregando painel...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (perfil?.status === 'suspenso') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="card max-w-md text-center">
          <h2 className="text-bad font-bold text-lg mb-2">Acesso Suspenso</h2>
          <p className="text-muted text-sm mb-4">
            Seu acesso ao painel foi suspenso. Entre em contato com o administrador da sua empresa ou com a Santos Digital.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
