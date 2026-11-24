import React, { useState } from 'react';
import { useClientes } from '../../queries';
import { brl } from '../../lib/format';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

export const Clientes: React.FC = () => {
  const { data: clientes = [], isLoading } = useClientes();
  const { perfil } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState('');
  const [servicosStr, setServicosStr] = useState('');
  const [investimento, setInvestimento] = useState('0');
  const [meta, setMeta] = useState('0');
  const [comissao, setComissao] = useState('1');
  const [saving, setSaving] = useState(false);

  const isSuperadmin = perfil?.papel === 'superadmin';

  const handleOpenCreate = () => {
    setEditingId(null);
    setNome('');
    setSegmento('');
    setServicosStr('');
    setInvestimento('0');
    setMeta('0');
    setComissao('1');
    setModalOpen(true);
  };

  const handleOpenEdit = (c: any) => {
    setEditingId(c.id);
    setNome(c.nome);
    setSegmento(c.segmento);
    setServicosStr(c.servicos.join(', '));
    setInvestimento(String(c.investimento_mensal || 0));
    setMeta(String(c.meta_mensal || 0));
    setComissao(String(c.percentual_comissao ?? 1));
    setModalOpen(true);
  };

  const handleToggleAtivo = async (c: any) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ ativo: !c.ativo })
        .eq('id', c.id);

      if (error) throw error;
      showToast(c.ativo ? 'Cliente pausado' : 'Cliente reativado');
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar status.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      showToast('Informe o nome da empresa.');
      return;
    }
    const servicos = servicosStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (!servicos.length) {
      showToast('Informe ao menos um serviço.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from('clientes')
          .update({
            nome,
            segmento: segmento || 'Sem segmento',
            servicos,
            investimento_mensal: Number(investimento) || 0,
            meta_mensal: Number(meta) || 0,
          })
          .eq('id', editingId);

        if (error) throw error;

        // Se superadmin, atualizar comissão se tabela permitir
        if (isSuperadmin) {
          await supabase
            .from('comissao_config')
            .upsert({
              cliente_id: editingId,
              percentual: Number(comissao) || 1,
            });
        }
        showToast('Cliente atualizado');
      } else {
        // Criar
        const { data, error } = await supabase
          .from('clientes')
          .insert({
            nome,
            segmento: segmento || 'Sem segmento',
            servicos,
            investimento_mensal: Number(investimento) || 0,
            meta_mensal: Number(meta) || 0,
            ativo: true,
          })
          .select()
          .single();

        if (error) throw error;

        if (isSuperadmin && data) {
          await supabase.from('comissao_config').insert({
            cliente_id: data.id,
            percentual: Number(comissao) || 1,
          });
        }
        showToast('Cliente criado');
      }

      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Clientes</h1>
          <p className="text-muted text-xs mt-1">
            Crie, edite e pause os painéis dos seus clientes.
          </p>
        </div>
        {isSuperadmin && (
          <button onClick={handleOpenCreate} className="btn btn-primary">
            <Icon name="plus" size={16} /> Novo cliente
          </button>
        )}
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-8 text-muted text-xs">Carregando clientes...</div>
        ) : !clientes.length ? (
          <div className="text-center py-8 text-muted text-xs">Nenhum cliente cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Status</th>
                  {isSuperadmin && <th className="py-2.5 px-3 text-right">Comissão</th>}
                  <th className="py-2.5 px-3 text-right">Meta mensal</th>
                  <th className="py-2.5 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line2">
                {clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-bg/50 transition-colors">
                    <td className="py-3 px-3">
                      <b className="block text-ink text-sm leading-snug">{c.nome}</b>
                      <span className="text-muted text-xs">{c.segmento}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`pill ${c.ativo ? 'pill-good' : 'pill-n'}`}>
                        {c.ativo ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                    {isSuperadmin && (
                      <td className="py-3 px-3 text-right num text-xs">
                        {c.percentual_comissao != null
                          ? `${String(c.percentual_comissao).replace('.', ',')}%`
                          : '—'}
                      </td>
                    )}
                    <td className="py-3 px-3 text-right num text-xs">
                      {c.meta_mensal ? brl(c.meta_mensal) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <Link to={`/c/${c.id}/pipeline`} className="btn btn-sm">
                        Abrir painel
                      </Link>
                      {isSuperadmin && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="btn btn-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleAtivo(c)}
                            className={`btn btn-sm ${c.ativo ? 'btn-danger' : ''}`}
                          >
                            {c.ativo ? 'Pausar' : 'Reativar'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar cliente' : 'Novo cliente'}
        subtitle={
          editingId
            ? 'Altere as informações do cliente.'
            : 'Cria um painel novo e vazio, pronto para receber usuários e leads.'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="nome">
              Nome da empresa *
            </label>
            <input
              id="nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-field text-sm"
              placeholder="Ex.: Studio Santos"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="segmento">
              Segmento
            </label>
            <input
              id="segmento"
              type="text"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              className="input-field text-sm"
              placeholder="Ex.: Películas e estética automotiva"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1" htmlFor="servicos">
              Serviços (separados por vírgula) *
            </label>
            <input
              id="servicos"
              type="text"
              required
              value={servicosStr}
              onChange={(e) => setServicosStr(e.target.value)}
              className="input-field text-sm"
              placeholder="Ex.: Película térmica, PPF, Polimento"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1" htmlFor="investimento">
                Investimento mensal (R$)
              </label>
              <input
                id="investimento"
                type="number"
                min="0"
                value={investimento}
                onChange={(e) => setInvestimento(e.target.value)}
                className="input-field text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1" htmlFor="meta">
                Meta mensal de faturamento (R$)
              </label>
              <input
                id="meta"
                type="number"
                min="0"
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>

          {isSuperadmin && (
            <div>
              <label className="block text-xs font-semibold text-muted mb-1" htmlFor="comissao">
                Sua comissão sobre o faturamento (%)
              </label>
              <input
                id="comissao"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          )}

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
              disabled={saving}
              className="btn btn-sm btn-primary"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar cliente'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
