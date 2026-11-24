import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshPerfil } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg('E-mail ou senha inválidos.');
        return;
      }

      if (data.user) {
        await refreshPerfil();
        navigate('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm card">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#E9C98A] to-[#B8893B] text-[#2A0A13] flex items-center justify-center font-extrabold text-sm shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-base font-bold text-ink leading-tight">Santos Digital</h1>
            <p className="text-muted text-xs">Painel de Leads e Vendas</p>
          </div>
        </div>

        <h2 className="text-lg font-bold mb-1 text-ink">Entrar no painel</h2>
        <p className="text-muted text-xs mb-5">
          Cada usuário acessa com sua credencial individual.
        </p>

        {errorMsg && (
          <div className="bg-bad-soft text-bad p-2.5 rounded-[10px] text-xs font-semibold mb-4">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field text-sm"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary justify-center mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
