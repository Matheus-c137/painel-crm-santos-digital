import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useNegociacoes, useClientes } from '../../queries';
import { brl, fdata, pct } from '../../lib/format';
import { PillTipo } from '../../components/Pills';
import { Icon } from '../../components/Icon';
import { FormVenda } from './FormVenda';
import { FiltroPeriodo, PeriodoState, estaNoPeriodo } from '../../components/FiltroPeriodo';

export const Vendas: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const { data: negociacoes = [], isLoading } = useNegociacoes(clienteId);
  const { data: clientes = [] } = useClientes();

  const clienteAtual = clientes.find((c) => c.id === clienteId);
  const [modalVendaOpen, setModalVendaOpen] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoState>({ tipo: 'mes' });

  // Filtrar apenas status Fechou ordenadas por data de fechamento decrescente no período
  const vendas = useMemo(() => {
    return negociacoes
      .filter((n) => n.status === 'Fechou' && n.data_fechamento && estaNoPeriodo(n.data_fechamento, periodo))
      .sort((a, b) => (b.data_fechamento || '').localeCompare(a.data_fechamento || ''));
  }, [negociacoes, periodo]);

  const totalVendas = vendas.length;
  const faturamentoTotal = vendas.reduce((acc, v) => acc + (v.valor_fechado || 0), 0);
  const ticketMedio = totalVendas ? faturamentoTotal / totalVendas : 0;
  const vendasRecompra = vendas.filter((v) => v.tipo_cliente !== 'Novo').length;
  const taxaRecompra = totalVendas ? vendasRecompra / totalVendas : 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Vendas</h1>
          <p className="text-muted text-xs mt-1">
            Tudo o que foi fechado no período, venha de lead novo, cliente recorrente ou reativado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
          <button
            onClick={() => setModalVendaOpen(true)}
            className="btn btn-primary"
          >
            <Icon name="money" size={16} /> Registrar venda
          </button>
        </div>
      </div>

      {/* KPIs da página de vendas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <span className="text-muted text-xs font-medium">Vendas fechadas</span>
          <b className="text-2xl font-extrabold text-ink num mt-1 block">
            {totalVendas}
          </b>
        </div>

        <div className="card p-4">
          <span className="text-muted text-xs font-medium">Faturamento total</span>
          <b className="text-2xl font-extrabold text-ink num mt-1 block">
            {brl(faturamentoTotal)}
          </b>
        </div>

        <div className="card p-4">
          <span className="text-muted text-xs font-medium">Ticket médio</span>
          <b className="text-2xl font-extrabold text-ink num mt-1 block">
            {brl(ticketMedio)}
          </b>
        </div>

        <div className="card p-4">
          <span className="text-muted text-xs font-medium">Taxa de recompra</span>
          <b className="text-2xl font-extrabold text-ink num mt-1 block">
            {pct(taxaRecompra)}
          </b>
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8 text-muted text-xs">Carregando vendas...</div>
        ) : !vendas.length ? (
          <div className="text-center py-8 text-muted text-xs">Nenhuma venda registrada ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Serviço</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Origem</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line2">
                {vendas.map((v) => (
                  <tr key={v.id} className="hover:bg-bg/50 transition-colors">
                    <td className="py-3 px-3 num text-muted text-xs whitespace-nowrap">
                      {fdata(v.data_fechamento)}
                    </td>
                    <td className="py-3 px-3">
                      <b className="block text-ink text-sm leading-snug">
                        {v.contatos?.nome || 'Sem nome'}
                      </b>
                      <span className="text-muted text-xs">{v.contatos?.telefone}</span>
                    </td>
                    <td className="py-3 px-3 text-xs">{v.servico}</td>
                    <td className="py-3 px-3">
                      <PillTipo tipo={v.tipo_cliente} />
                    </td>
                    <td className="py-3 px-3 text-xs text-muted">{v.origem}</td>
                    <td className="py-3 px-3 text-xs text-muted">
                      {v.perfis?.nome || '—'}
                    </td>
                    <td className="py-3 px-3 text-right num text-xs font-bold text-ink">
                      {brl(v.valor_fechado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {clienteAtual && (
        <FormVenda
          isOpen={modalVendaOpen}
          onClose={() => setModalVendaOpen(false)}
          clienteId={clienteAtual.id}
          servicos={clienteAtual.servicos}
        />
      )}
    </div>
  );
};
