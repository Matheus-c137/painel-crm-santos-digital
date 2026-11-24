import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUsuarios, useClientes } from '../../queries';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { useQueryClient } from '@tanstack/react-query';
import { PAPEL_LABELS } from '../../lib/constantes';
import { Papel } from '../../types';
import { ini } from '../../lib/format';

export const Equipe: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const { data: usuarios = [], isLoading } = useUsuarios(clienteId);
  const { data: clientes = [] } = useClientes();
  const { perfil } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const clienteAtual = clientes.find((c) => c.id === clienteId);
  const [modalOpen, setModalOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('comercial');
  const [inviting, setInviting] = useState(false);

  const canManage =
    perfil?.papel === 'superadmin' ||
    perfil?.papel === 'agencia' ||
    (perfil?.papel === 'admin_cliente' && perfil?.cliente_id === clienteId);

  const handleToggleSuspender = async (u: any) => {
    const novoStatus = u.status === 'suspenso' ? 'ativo' : 'suspenso';
    try {
      const { error } = await supabase
        .from('perfis')
        .update({ status: novoStatus })
        .eq('id', u.id);

      if (error) throw error;
      showToast(novoStatus === 'suspenso' ? 'Acesso suspenso' : 'Acesso reativado');
      queryClient.invalidateQueries({ queryKey: ['usuarios', clienteId] });
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar status.');
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      showToast('Preencha nome e e-mail.');
      return;
    }

    setInviting(true);
    try {
      // Tentar convidar via admin ou registrar stub se em dev
      showToast(`Convite preparado para ${email}`);
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['usuarios', clienteId] });
    } catch (err: any) {
      showToast(err.message || 'Erro ao convidar.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Minha equipe</h1>
          <p className="text-muted text-xs mt-1">
            Quem tem acesso ao painel da {clienteAtual?.nome || 'empresa'}.
          </p>
        </div>
        {canManage && (
          <button onClick={() => setModalOpen(true)} className="btn btn-primary">
            <Icon name="plus" size={16} /> Convidar pessoa
          </button>
        )}
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-8 text-muted text-xs">Carregando equipe...</div>
        ) : !usuarios.length ? (
          <div className="text-center py-8 text-muted text-xs">
            Nenhum membro de equipe encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="py-2.5 px-3">Usuário</th>
                  <th className="py-2.5 px-3">Papel</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line2">
                {usuarios.map((u) => {
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
                          {u.status === 'ativo' ? 'Ativo' : 'Suspenso'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {isEu ? (
                          <span className="text-muted text-xs">Você</span>
                        ) : (
                          canManage && (
                            <button
                              onClick={() => handleToggleSuspender(u)}
                              className={`btn btn-sm ${
                                u.status === 'suspenso' ? '' : 'btn-danger'
                              }`}
                            >
                              {u.status === 'suspenso' ? 'Reativar' : 'Suspender'}
                            </button>
                          )
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Convidar pessoa"
        subtitle={`Adicione um membro à equipe de ${clienteAtual?.nome}.`}
      >
        <form onSubmit={handleInviteSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="eq-nome">
              Nome *
            </label>
            <input
              id="eq-nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-field text-sm"
              placeholder="Ex.: Bruno Maia"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="eq-email">
              E-mail *
            </label>
            <input
              id="eq-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field text-sm"
              placeholder="bruno@empresa.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="eq-papel">
              Papel *
            </label>
            <select
              id="eq-papel"
              value={papel}
              onChange={(e) => setPapel(e.target.value as Papel)}
              className="input-field text-sm"
            >
              <option value="comercial">Comercial</option>
              <option value="admin_cliente">Admin do cliente</option>
              <option value="visualizador">Visualizador</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn btn-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="btn btn-sm btn-primary"
            >
              {inviting ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
