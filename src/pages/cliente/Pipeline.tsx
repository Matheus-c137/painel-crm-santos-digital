import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useNegociacoes, useMoverNegociacao, useClientes } from '../../queries';
import { StatusNegociacao, Negociacao, MotivoPerda } from '../../types';
import { STATUS_LISTA, MOTIVOS_LISTA } from '../../lib/constantes';
import { brl, contatoTexto, diffDias } from '../../lib/format';
import { PillStatus } from '../../components/Pills';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { FormLead } from './FormLead';
import { FormVenda } from './FormVenda';
import { useToast } from '../../components/Toast';
import { FiltroPeriodo, PeriodoState, estaNoPeriodo } from '../../components/FiltroPeriodo';

export const Pipeline: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const { data: negociacoes = [], isLoading } = useNegociacoes(clienteId);
  const { data: clientes = [] } = useClientes();
  const moverNegociacao = useMoverNegociacao();
  const { showToast } = useToast();

  const clienteAtual = clientes.find((c) => c.id === clienteId);

  // Filtro de Período
  const [periodo, setPeriodo] = useState<PeriodoState>({ tipo: 'todos' });

  // Modais
  const [modalLeadOpen, setModalLeadOpen] = useState(false);
  const [modalVendaOpen, setModalVendaOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  // Modal para fechar ou não fechar ao soltar no kanban
  const [dropAction, setDropAction] = useState<{
    negociacao: Negociacao;
    novoStatus: StatusNegociacao;
  } | null>(null);

  const [valorFechado, setValorFechado] = useState('');
  const [dataFechamento, setDataFechamento] = useState(new Date().toISOString().slice(0, 10));
  const [motivoPerda, setMotivoPerda] = useState<MotivoPerda>('Preço');

  // Drag and Drop simples via HTML5 Drag API
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: string) => {
    e.preventDefault();
    setDragOverCol(colStatus);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (colStatus: StatusNegociacao) => {
    setDragOverCol(null);
    if (!draggedId || !clienteId) return;

    const neg = negociacoes.find((n) => n.id === draggedId);
    if (!neg || neg.status === colStatus) return;

    if (colStatus === 'Fechou' || colStatus === 'Não fechou') {
      setDropAction({ negociacao: neg, novoStatus: colStatus });
      setValorFechado(neg.valor_orcamento ? String(neg.valor_orcamento) : '');
      return;
    }

    try {
      await moverNegociacao.mutateAsync({
        id: neg.id,
        cliente_id: clienteId,
        novo_status: colStatus,
      });
      showToast(`Movido para ${colStatus}`);
    } catch (err: any) {
      showToast(err.message || 'Erro ao mover negociação.');
    }
  };

  const handleConfirmDropAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropAction || !clienteId) return;

    try {
      if (dropAction.novoStatus === 'Fechou') {
        const val = Number(valorFechado);
        if (!val || val <= 0) {
          showToast('Informe o valor fechado.');
          return;
        }
        await moverNegociacao.mutateAsync({
          id: dropAction.negociacao.id,
          cliente_id: clienteId,
          novo_status: 'Fechou',
          valor_fechado: val,
          data_fechamento: dataFechamento,
        });
        showToast('Venda concluída com sucesso!');
      } else if (dropAction.novoStatus === 'Não fechou') {
        await moverNegociacao.mutateAsync({
          id: dropAction.negociacao.id,
          cliente_id: clienteId,
          novo_status: 'Não fechou',
          motivo_perda: motivoPerda,
        });
        showToast('Negociação arquivada como Não fechou.');
      }
      setDropAction(null);
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar status.');
    }
  };

  // Filtrar negociações pelo período
  const negociacoesFiltradas = useMemo(() => {
    return negociacoes.filter((n) => {
      const dataRef = n.status === 'Fechou' && n.data_fechamento ? n.data_fechamento : n.data_abertura;
      return estaNoPeriodo(dataRef, periodo);
    });
  }, [negociacoes, periodo]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Pipeline</h1>
          <p className="text-muted text-xs mt-1">
            Arraste uma negociação para outra coluna para mudar o status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
          <button
            onClick={() => setModalVendaOpen(true)}
            className="btn"
          >
            <Icon name="money" size={16} /> Registrar venda
          </button>
          <button
            onClick={() => {
              setEditingLeadId(null);
              setModalLeadOpen(true);
            }}
            className="btn btn-primary"
          >
            <Icon name="plus" size={16} /> Novo lead
          </button>
        </div>
      </div>

      <div className="text-xs text-muted mb-4">
        Ao mover para “Fechou” ou “Não fechou”, o painel pede o valor ou o motivo.
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto pb-4">
        {STATUS_LISTA.map((status) => {
          const leadsDaColuna = negociacoesFiltradas.filter((n) => n.status === status);
          const totalValor = leadsDaColuna.reduce(
            (acc, curr) => acc + (status === 'Fechou' ? curr.valor_fechado : curr.valor_orcamento),
            0
          );
          const isOver = dragOverCol === status;

          return (
            <div
              key={status}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(status)}
              className={`bg-line2 rounded-card p-2.5 min-h-[360px] flex flex-col gap-2 transition-all ${
                isOver ? 'ring-2 ring-accent ring-inset' : ''
              }`}
            >
              {/* Header da coluna */}
              <div className="flex items-center justify-between px-1 py-1">
                <PillStatus status={status} />
                <small className="num text-muted text-xs font-semibold">
                  {leadsDaColuna.length}
                  {totalValor > 0 && ` · ${brl(totalValor)}`}
                </small>
              </div>

              {/* Cards da coluna */}
              <div className="flex flex-col gap-2 flex-1">
                {isLoading ? (
                  <div className="text-xs text-muted text-center py-4">Carregando...</div>
                ) : leadsDaColuna.length === 0 ? (
                  <div className="text-[11px] text-muted text-center py-6">
                    Solte um lead aqui
                  </div>
                ) : (
                  leadsDaColuna.map((neg) => {
                    const diasParado = diffDias(neg.ultima_interacao);
                    const parado = neg.status !== 'Fechou' && neg.status !== 'Não fechou' && diasParado >= 3;

                    return (
                      <div
                        key={neg.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, neg.id)}
                        onClick={() => {
                          setEditingLeadId(neg.id);
                          setModalLeadOpen(true);
                        }}
                        className="card p-3 cursor-grab hover:border-accent active:cursor-grabbing transition-colors"
                      >
                        <b className="block text-sm text-ink leading-snug truncate">
                          {neg.contatos?.nome || 'Sem nome'}
                        </b>
                        <span className="text-muted text-[11px] block truncate mb-2">
                          {neg.servico}
                        </span>

                        <div className="flex items-center justify-between text-xs text-muted mt-2">
                          <span className="num font-bold text-ink">
                            {neg.status === 'Fechou'
                              ? brl(neg.valor_fechado)
                              : neg.valor_orcamento
                              ? brl(neg.valor_orcamento)
                              : 'Sem valor'}
                          </span>
                          <span
                            className={
                              parado
                                ? 'text-bad bg-bad-soft px-1.5 py-0.5 rounded text-[10px] font-semibold'
                                : 'text-[11px]'
                            }
                          >
                            {contatoTexto(neg.ultima_interacao)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modais de Ação */}
      {clienteAtual && (
        <>
          <FormLead
            isOpen={modalLeadOpen}
            onClose={() => setModalLeadOpen(false)}
            clienteId={clienteAtual.id}
            servicos={clienteAtual.servicos}
            leadId={editingLeadId}
          />
          <FormVenda
            isOpen={modalVendaOpen}
            onClose={() => setModalVendaOpen(false)}
            clienteId={clienteAtual.id}
            servicos={clienteAtual.servicos}
          />
        </>
      )}

      {/* Modal de Transição de Status (Fechou ou Não fechou) */}
      <Modal
        isOpen={!!dropAction}
        onClose={() => setDropAction(null)}
        title={
          dropAction?.novoStatus === 'Fechou'
            ? 'Confirmar Venda Fechada'
            : 'Motivo da Perda da Negociação'
        }
        subtitle={
          dropAction?.novoStatus === 'Fechou'
            ? `Informe os dados do fechamento para ${dropAction?.negociacao.contatos?.nome}.`
            : `Por qual motivo a negociação de ${dropAction?.negociacao.contatos?.nome} não fechou?`
        }
      >
        <form onSubmit={handleConfirmDropAction} className="space-y-4">
          {dropAction?.novoStatus === 'Fechou' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1" htmlFor="val-fech">
                  Valor Fechado (R$) *
                </label>
                <input
                  id="val-fech"
                  type="number"
                  required
                  min="1"
                  step="10"
                  value={valorFechado}
                  onChange={(e) => setValorFechado(e.target.value)}
                  className="input-field text-sm"
                  placeholder="Ex.: 1500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1" htmlFor="dt-fech">
                  Data do Fechamento *
                </label>
                <input
                  id="dt-fech"
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  value={dataFechamento}
                  onChange={(e) => setDataFechamento(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-muted mb-1" htmlFor="motivo-drop">
                Motivo *
              </label>
              <select
                id="motivo-drop"
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value as MotivoPerda)}
                className="input-field text-sm"
              >
                {MOTIVOS_LISTA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setDropAction(null)}
              className="btn btn-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary"
            >
              Salvar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
