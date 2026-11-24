import React, { useState, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';
import { useClientes, useNegociacoes } from '../queries';
import { ini, diffDias } from '../lib/format';
import { PAPEL_LABELS } from '../lib/constantes';

export const Shell: React.FC = () => {
  const { perfil, signOut } = useAuth();
  const { data: clientes = [] } = useClientes();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAgenciaOuSuper = perfil?.papel === 'superadmin' || perfil?.papel === 'agencia';

  // Obter cliente ativo se estiver numa rota /c/:clienteId
  const matchCliente = location.pathname.match(/\/c\/([a-f0-9-]+)/);
  const clienteIdUrl = matchCliente ? matchCliente[1] : null;
  const clienteAtual = clientes.find((c) => c.id === (clienteIdUrl || perfil?.cliente_id));

  const { data: negociacoes = [] } = useNegociacoes(clienteAtual?.id);
  const followUpCount = useMemo(() => {
    return negociacoes.filter((n) => {
      if (n.status === 'Fechou' || n.status === 'Não fechou') return false;
      return diffDias(n.ultima_interacao) >= 3;
    }).length;
  }, [negociacoes]);

  const handleClienteSelect = (cid: string) => {
    if (!cid) {
      navigate('/agencia/clientes');
    } else {
      navigate(`/c/${cid}/pipeline`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:grid md:grid-cols-[248px_minmax(0,1fr)] bg-bg text-ink">
      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 bottom-0 z-40 w-[248px] bg-side-bg text-side-ink flex flex-col gap-1 p-4 h-screen overflow-y-auto transition-transform ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 pb-4 border-b border-white/10 mb-2">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#E9C98A] to-[#B8893B] text-[#2A0A13] flex items-center justify-center font-extrabold text-sm flex-none">
            S
          </div>
          <div className="min-w-0">
            <b className="block text-sm leading-tight truncate">Santos Digital</b>
            <small className="text-side-muted text-[11px]">Painel de Leads</small>
          </div>
        </div>

        {/* Menu da Agência (Superadmin e Agência) */}
        {isAgenciaOuSuper && (
          <>
            <div className="text-[10.5px] uppercase tracking-wider text-side-muted font-semibold px-2 py-1 mt-1">
              Agência
            </div>

            <NavLink
              to="/agencia/clientes"
              className={({ isActive }) =>
                `flex items-center gap-2.5 w-full p-2 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive ? 'bg-side-active text-white font-semibold' : 'hover:bg-side-hover opacity-80 hover:opacity-100'
                }`
              }
            >
              <Icon name="building" size={18} />
              <span>Clientes</span>
            </NavLink>

            <NavLink
              to="/agencia/usuarios"
              className={({ isActive }) =>
                `flex items-center gap-2.5 w-full p-2 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive ? 'bg-side-active text-white font-semibold' : 'hover:bg-side-hover opacity-80 hover:opacity-100'
                }`
              }
            >
              <Icon name="shield" size={18} />
              <span>Usuários e acessos</span>
            </NavLink>

            <div className="text-[10.5px] uppercase tracking-wider text-side-muted font-semibold px-2 py-1 mt-3">
              Painel do Cliente
            </div>

            <select
              value={clienteIdUrl || ''}
              onChange={(e) => handleClienteSelect(e.target.value)}
              className="w-full bg-side-hover border border-white/15 text-side-ink rounded-[10px] p-2 text-xs mb-2 focus:outline-none"
            >
              <option value="">Escolher cliente…</option>
              {clientes
                .filter((c) => c.ativo)
                .map((c) => (
                  <option key={c.id} value={c.id} className="text-ink">
                    {c.nome}
                  </option>
                ))}
            </select>
          </>
        )}

        {/* Menu do Cliente (ou selecionado pela agência) */}
        {clienteAtual && (
          <div className="flex flex-col gap-1">
            {!isAgenciaOuSuper && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-[12px] bg-side-hover mb-2">
                <div className="w-[30px] h-[30px] rounded-full bg-[#E9C98A]/20 text-[#E9C98A] flex items-center justify-center text-xs font-bold flex-none">
                  {ini(clienteAtual.nome)}
                </div>
                <div className="min-w-0">
                  <b className="block text-xs leading-tight truncate">{clienteAtual.nome}</b>
                  <small className="text-side-muted text-[10px] truncate block">{clienteAtual.segmento}</small>
                </div>
              </div>
            )}

            <NavLink
              to={`/c/${clienteAtual.id}/geral`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 w-full p-2 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive ? 'bg-side-active text-white font-semibold' : 'hover:bg-side-hover opacity-80 hover:opacity-100'
                }`
              }
            >
              <Icon name="dash" size={18} />
              <span>Visão geral</span>
            </NavLink>

            <NavLink
              to={`/c/${clienteAtual.id}/pipeline`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 w-full p-2 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive ? 'bg-side-active text-white font-semibold' : 'hover:bg-side-hover opacity-80 hover:opacity-100'
                }`
              }
            >
              <Icon name="kanban" size={18} />
              <span>Pipeline</span>
            </NavLink>

            <NavLink
              to={`/c/${clienteAtual.id}/leads`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 w-full p-2 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive ? 'bg-side-active text-white font-semibold' : 'hover:bg-side-hover opacity-80 hover:opacity-100'
                }`
              }
            >
              <Icon name="list" size={18} />
              <span>Leads e orçamentos</span>
            </NavLink>

            <NavLink
              to={`/c/${clienteAtual.id}/vendas`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 w-full p-2 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive ? 'bg-side-active text-white font-semibold' : 'hover:bg-side-hover opacity-80 hover:opacity-100'
                }`
              }
            >
              <Icon name="money" size={18} />
              <span>Vendas</span>
            </NavLink>

            <NavLink
              to={`/c/${clienteAtual.id}/follow-up`}
              className={({ isActive }) =>
                `flex items-center justify-between w-full p-2 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive ? 'bg-side-active text-white font-semibold' : 'hover:bg-side-hover opacity-80 hover:opacity-100'
                }`
              }
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name="phone" size={18} />
                <span className="truncate">Follow-up</span>
              </div>
              {followUpCount > 0 && (
                <span className="bg-[#B8893B] text-[#2A0A13] text-[11px] font-extrabold px-1.5 py-0.5 rounded-full flex-none">
                  {followUpCount}
                </span>
              )}
            </NavLink>

            {!isAgenciaOuSuper && (
              <NavLink
                to={`/c/${clienteAtual.id}/equipe`}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 w-full p-2 rounded-[10px] text-sm font-medium transition-colors ${
                    isActive ? 'bg-side-active text-white font-semibold' : 'hover:bg-side-hover opacity-80 hover:opacity-100'
                  }`
                }
              >
                <Icon name="users" size={18} />
                <span>Minha equipe</span>
              </NavLink>
            )}
          </div>
        )}

        {/* Footer do Usuário */}
        <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-[30px] h-[30px] rounded-full bg-[#E9C98A]/20 text-[#E9C98A] flex items-center justify-center text-xs font-bold flex-none">
              {ini(perfil?.nome || 'U')}
            </div>
            <div className="min-w-0">
              <b className="block text-xs leading-tight truncate">{perfil?.nome}</b>
              <small className="text-side-muted text-[10px] block truncate">
                {perfil?.papel ? PAPEL_LABELS[perfil.papel] : ''}
              </small>
            </div>
          </div>
          <button
            onClick={signOut}
            title="Sair do painel"
            className="text-side-muted hover:text-white p-1 rounded-lg"
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      {/* Backdrop Mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-6 py-3 border-b border-line bg-surface">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden border border-line bg-surface rounded-[10px] p-1.5"
            aria-label="Abrir menu"
          >
            <Icon name="dash" size={18} />
          </button>

          <div className="text-xs text-muted font-medium truncate flex-1">
            {clienteAtual ? (
              <>
                <span className="text-ink font-semibold">{clienteAtual.nome}</span> / Painel
              </>
            ) : (
              'Santos Digital / Agência'
            )}
          </div>
        </header>

        <main className="p-6 md:p-8 max-w-[1280px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
