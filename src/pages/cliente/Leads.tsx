import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNegociacoes, useClientes } from '../../queries';
import { STATUS_LISTA } from '../../lib/constantes';
import { brl, fdata, digits } from '../../lib/format';
import { PillStatus, PillTipo } from '../../components/Pills';
import { Icon } from '../../components/Icon';
import { FormLead } from './FormLead';
import { FormVenda } from './FormVenda';
import { FiltroPeriodo, PeriodoState, estaNoPeriodo } from '../../components/FiltroPeriodo';

export const Leads: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const { data: negociacoes = [], isLoading } = useNegociacoes(clienteId);
  const { data: clientes = [] } = useClientes();

  const clienteAtual = clientes.find((c) => c.id === clienteId);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos');
  const [periodo, setPeriodo] = useState<PeriodoState>({ tipo: 'todos' });

  // Modais e Gaveta
  const [modalLeadOpen, setModalLeadOpen] = useState(false);
  const [modalVendaOpen, setModalVendaOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Filtragem
  const q = busca.trim().toLowerCase();
  const leadsFiltrados = negociacoes.filter((l) => {
    const matchStatus = filtroStatus === 'Todos' || l.status === filtroStatus;
    if (!matchStatus) return false;
    const matchPeriodo = estaNoPeriodo(l.data_abertura, periodo);
    if (!matchPeriodo) return false;
    if (!q) return true;
    const texto = `${l.contatos?.nome || ''} ${l.contatos?.telefone || ''} ${l.servico} ${l.contatos?.bairro || ''}`.toLowerCase();
    return texto.includes(q);
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Leads e orçamentos</h1>
          <p className="text-muted text-xs mt-1">
            Todas as negociações abertas no período, de leads novos e de clientes que já compraram.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModalVendaOpen(true)} className="btn">
            <Icon name="money" size={16} /> Registrar venda
          </button>
          <button
            onClick={() => {
              setSelectedLeadId(null);
              setModalLeadOpen(true);
            }}
            className="btn btn-primary"
          >
            <Icon name="plus" size={16} /> Novo lead
          </button>
        </div>
      </div>

      <div className="card">
        {/* Barra de busca, chips de status e filtro de período */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Icon name="search" size={16} />
              </span>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, telefone ou serviço"
                className="input-field pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['Todos', ...STATUS_LISTA].map((st) => (
                <button
                  key={st}
                  onClick={() => setFiltroStatus(st)}
                  className={`chip ${filtroStatus === st ? 'active' : ''}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
        </div>

        {/* Tabela de Leads */}
        {isLoading ? (
          <div className="text-center py-8 text-muted text-xs">Carregando negociações...</div>
        ) : !leadsFiltrados.length ? (
          <div className="text-center py-8 text-muted text-xs">Nenhuma negociação encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Serviço</th>
                  <th className="py-2.5 px-3">Origem</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Orçamento</th>
                  <th className="py-2.5 px-3 text-right">Fechado</th>
                  <th className="py-2.5 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line2">
                {leadsFiltrados.map((l) => (
                  <tr key={l.id} className="hover:bg-bg/50 transition-colors">
                    <td className="py-3 px-3 num text-muted text-xs whitespace-nowrap">
                      {fdata(l.data_abertura)}
                    </td>
                    <td className="py-3 px-3">
                      <b className="block text-ink text-sm leading-snug">
                        {l.contatos?.nome || 'Sem nome'}
                      </b>
                      <span className="text-muted text-xs">
                        {l.contatos?.bairro && `${l.contatos.bairro} · `}
                        {l.contatos?.telefone}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs">{l.servico}</td>
                    <td className="py-3 px-3 text-xs text-muted">{l.origem}</td>
                    <td className="py-3 px-3">
                      <PillTipo tipo={l.tipo_cliente} />
                    </td>
                    <td className="py-3 px-3 text-xs text-muted">
                      {l.perfis?.nome || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <PillStatus status={l.status} />
                    </td>
                    <td className="py-3 px-3 text-right num text-xs">
                      {l.valor_orcamento ? brl(l.valor_orcamento) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right num text-xs">
                      {l.valor_fechado ? brl(l.valor_fechado) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      {l.contatos?.telefone && (
                        <a
                          href={`https://wa.me/55${digits(l.contatos.telefone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm"
                          title="Conversar no WhatsApp"
                        >
                          <Icon name="chat" size={14} /> WhatsApp
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setSelectedLeadId(l.id);
                          setModalLeadOpen(true);
                        }}
                        className="btn btn-sm"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {clienteAtual && (
        <>
          <FormLead
            isOpen={modalLeadOpen}
            onClose={() => setModalLeadOpen(false)}
            clienteId={clienteAtual.id}
            servicos={clienteAtual.servicos}
            leadId={selectedLeadId}
          />
          <FormVenda
            isOpen={modalVendaOpen}
            onClose={() => setModalVendaOpen(false)}
            clienteId={clienteAtual.id}
            servicos={clienteAtual.servicos}
          />
        </>
      )}
    </div>
  );
};
