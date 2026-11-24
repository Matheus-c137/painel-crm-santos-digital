import React, { useState } from 'react';
import { useUsuarios, useClientes } from '../../queries';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../auth/AuthContext';
import { supabase, createSecondaryClient } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { useQueryClient } from '@tanstack/react-query';
import { PAPEL_LABELS } from '../../lib/constantes';
import { Papel } from '../../types';
import { ini } from '../../lib/format';

export const Usuarios: React.FC = () => {
  const { data: usuarios = [], isLoading } = useUsuarios();
  const { data: clientes = [] } = useClientes();
  const { perfil } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel>('admin_cliente');
  const [clienteId, setClienteId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);


  const handleOpenInvite = () => {
    setNome('');
    setEmail('');
    setSenha('');
    setPapel('admin_cliente');
    setClienteId(clientes[0]?.id || '');
    setInviteModalOpen(true);
  };

  const handleToggleSuspender = async (u: any) => {
    const novoStatus = u.status === 'suspenso' ? 'ativo' : 'suspenso';
    try {
      const { error } = await supabase
        .from('perfis')
        .update({ status: novoStatus })
        .eq('id', u.id);

      if (error) throw error;
      showToast(novoStatus === 'suspenso' ? 'Acesso suspenso' : 'Acesso reativado');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar status do usuário.');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      showToast('Preencha nome, e-mail e senha.');
      return;
    }

    if (senha.length < 6) {
      showToast('A senha precisa ter no mínimo 6 caracteres.');
      return;
    }

    if (!clienteId) {
      showToast('Selecione o cliente da empresa.');
      return;
    }

    setCreatingUser(true);
    try {
      // 1. Criar o login via Supabase Auth nativo (garante hash GoTrue idêntico)
      const tempClient = createSecondaryClient();
      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
        options: {
          data: {
            nome,
            papel,
            cliente_id: clienteId,
          },
        },
      });

      if (authErr) throw authErr;

      if (authData.user) {
        // 2. Garantir registro na tabela public.perfis
        await supabase.from('perfis').upsert({
          id: authData.user.id,
          nome,
          email: email.trim().toLowerCase(),
          papel,
          cliente_id: clienteId,
          status: 'ativo',
        });
      }

      showToast(`Login criado com sucesso para ${email}!`);
      setInviteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar login do usuário.');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Usuários e acessos</h1>
          <p className="text-muted text-xs mt-1">
            Cada pessoa entra com a própria conta e tem um papel. Nada de PIN compartilhado.
          </p>
        </div>
        <button onClick={handleOpenInvite} className="btn btn-primary">
          <Icon name="plus" size={16} /> Convidar usuário
        </button>
      </div>

      <div className="card mb-6">
        {isLoading ? (
          <div className="text-center py-8 text-muted text-xs">Carregando usuários...</div>
        ) : !usuarios.length ? (
          <div className="text-center py-8 text-muted text-xs">Nenhum usuário cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="py-2.5 px-3">Usuário</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Papel</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line2">
                {usuarios.map((u) => {
                  const cli = clientes.find((c) => c.id === u.cliente_id);
                  const isEu = u.id === perfil?.id;

                  return (
                    <tr key={u.id} className="hover:bg-bg/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-[30px] h-[30px] rounded-full bg-gold-soft text-gold flex items-center justify-center text-xs font-bold flex-none">
                            {ini(u.nome)}
                          </div>
                          <div>
                            <b className="block text-ink text-sm leading-snug">{u.nome}</b>
                            <span className="text-muted text-xs">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted">
                        {cli ? cli.nome : 'Agência Santos Digital'}
                      </td>
                      <td className="py-3 px-3 text-xs font-medium">
                        {PAPEL_LABELS[u.papel]}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`pill ${
                            u.status === 'ativo'
                              ? 'pill-good'
                              : u.status === 'suspenso'
                              ? 'pill-bad'
                              : 'pill-warn'
                          }`}
                        >
                          {u.status === 'ativo'
                            ? 'Ativo'
                            : u.status === 'suspenso'
                            ? 'Suspenso'
                            : 'Convite pendente'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {isEu ? (
                          <span className="text-muted text-xs">Você</span>
                        ) : (
                          <button
                            onClick={() => handleToggleSuspender(u)}
                            className={`btn btn-sm ${
                              u.status === 'suspenso' ? '' : 'btn-danger'
                            }`}
                          >
                            {u.status === 'suspenso' ? 'Reativar' : 'Suspender'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Matriz de Permissões */}
      <div className="card">
        <h2 className="text-sm font-bold text-ink mb-3">O que cada papel pode fazer</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 px-3">Ação</th>
                <th className="py-2 px-3 text-center">Superadmin</th>
                <th className="py-2 px-3 text-center">Agência</th>
                <th className="py-2 px-3 text-center">Admin Cliente</th>
                <th className="py-2 px-3 text-center">Comercial</th>
                <th className="py-2 px-3 text-center">Visualizador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line2 text-muted">
              <tr>
                <td className="py-2.5 px-3 font-medium text-ink">Ver painel do próprio cliente</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-ink">Cadastrar e editar leads e vendas</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center">—</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-ink">Excluir registros e gerenciar usuários</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-ink">Ver todos os clientes</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-ink">Ver comissões da agência</td>
                <td className="text-center font-bold text-good">✓</td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
                <td className="text-center">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Criar login de cliente"
        subtitle="Crie o e-mail e a senha de acesso para o cliente entrar diretamente no painel dele."
      >
        <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="inv-nome">
              Nome da pessoa *
            </label>
            <input
              id="inv-nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-field text-sm"
              placeholder="Ex.: Paulo Silva"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="inv-email">
              E-mail de acesso *
            </label>
            <input
              id="inv-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field text-sm"
              placeholder="paulo@goodfilm.com.br"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="inv-senha">
              Senha de acesso *
            </label>
            <input
              id="inv-senha"
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="input-field text-sm"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="inv-cli">
              Empresa / Cliente *
            </label>
            <select
              id="inv-cli"
              required
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input-field text-sm"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.segmento})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="inv-papel">
              Papel no painel *
            </label>
            <select
              id="inv-papel"
              value={papel}
              onChange={(e) => setPapel(e.target.value as Papel)}
              className="input-field text-sm"
            >
              <option value="admin_cliente">Admin do cliente (gerencia equipe e leads)</option>
              <option value="comercial">Comercial (cadastra e atende leads)</option>
              <option value="visualizador">Visualizador (apenas leitura)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              className="btn btn-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingUser}
              className="btn btn-sm btn-primary"
            >
              {creatingUser ? 'Criando login...' : 'Criar login'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
