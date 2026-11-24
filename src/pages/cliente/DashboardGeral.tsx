import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNegociacoes, useClientes } from '../../queries';
import { brl, pct, fdata, diffDias, contatoTexto } from '../../lib/format';
import { PillStatus } from '../../components/Pills';
import { Icon } from '../../components/Icon';
import { FormLead } from './FormLead';
import { FormVenda } from './FormVenda';
import { FiltroPeriodo, PeriodoState, estaNoPeriodo } from '../../components/FiltroPeriodo';

export const DashboardGeral: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const { data: negociacoes = [] } = useNegociacoes(clienteId);
  const { data: clientes = [] } = useClientes();

  const clienteAtual = clientes.find((c) => c.id === clienteId);

  const [periodo, setPeriodo] = useState<PeriodoState>({ tipo: 'mes' });

  const dias = useMemo(() => {
    if (periodo.tipo === 'hoje') return 1;
    if (periodo.tipo === 'semana') return 7;
    if (periodo.tipo === 'mes') return 30;
    if (periodo.tipo === 'personalizado' && periodo.dataInicio && periodo.dataFim) {
      const diff =
        Math.round(
          (new Date(periodo.dataFim + 'T12:00:00').getTime() -
            new Date(periodo.dataInicio + 'T12:00:00').getTime()) /
            864e5
        ) + 1;
      return Math.max(1, diff);
    }
    return 30;
  }, [periodo]);
  const [modalLeadOpen, setModalLeadOpen] = useState(false);
  const [modalVendaOpen, setModalVendaOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  // Média móvel ponderada (3 dias) para suavizar curvas
  const ma = (arr: number[], k = 3) =>
    arr.map((_, i) => {
      const slice = arr.slice(Math.max(0, i - k + 1), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

  // Cálculo de variação percentual (Delta)
  const calcDelta = (cur: number, prev: number) => {
    if (!isFinite(cur) || !isFinite(prev) || (prev === 0 && cur === 0)) {
      return <span className="dl n">—</span>;
    }
    if (prev === 0) return <span className="dl good">novo</span>;
    const p = Math.round(((cur - prev) / prev) * 100);
    if (p === 0) return <span className="dl n">0%</span>;
    return (
      <span className={`dl ${p > 0 ? 'good' : 'bad'}`}>
        {p > 0 ? '▲' : '▼'} {Math.abs(p)}%
      </span>
    );
  };

  // Separação dinâmica dos dados entre o período atual e período anterior
  const metricas = useMemo(() => {
    const leadsCur = negociacoes.filter((l) => estaNoPeriodo(l.data_abertura, periodo));

    const leadsPrev = negociacoes.filter((l) => {
      const d = diffDias(l.data_abertura);
      return d >= dias && d < 2 * dias;
    });

    const vendasCur = negociacoes.filter((l) => {
      if (l.status !== 'Fechou' || !l.data_fechamento) return false;
      return estaNoPeriodo(l.data_fechamento, periodo);
    });

    const vendasPrev = negociacoes.filter((l) => {
      if (l.status !== 'Fechou' || !l.data_fechamento) return false;
      const d = diffDias(l.data_fechamento);
      return d >= dias && d < 2 * dias;
    });

    // Faturamento e vendas
    const fatCur = vendasCur.reduce((acc, v) => acc + (v.valor_fechado || 0), 0);
    const fatPrev = vendasPrev.reduce((acc, v) => acc + (v.valor_fechado || 0), 0);

    const vTotCur = vendasCur.length;
    const vTotPrev = vendasPrev.length;

    const ticketCur = vTotCur ? fatCur / vTotCur : 0;
    const ticketPrev = vTotPrev ? fatPrev / vTotPrev : 0;

    const nLeadsCur = leadsCur.length;
    const nLeadsPrev = leadsPrev.length;

    const orcCur = leadsCur.filter((l) => l.valor_orcamento > 0).length;
    const orcPrev = leadsPrev.filter((l) => l.valor_orcamento > 0).length;

    // Faturamento por tipo de cliente
    const porTipo = {
      Novo: { n: 0, fat: 0 },
      Recorrente: { n: 0, fat: 0 },
      Reativação: { n: 0, fat: 0 },
    };

    vendasCur.forEach((v) => {
      const t = v.tipo_cliente || 'Novo';
      if (porTipo[t]) {
        porTipo[t].n++;
        porTipo[t].fat += v.valor_fechado || 0;
      }
    });

    const recompraCount = porTipo.Recorrente.n + porTipo.Reativação.n;
    const taxaRecompra = vTotCur ? recompraCount / vTotCur : 0;

    // Baldes diários para o gráfico de área e sparklines
    const bucketLength = Math.max(2, Math.min(60, dias));
    const bucketLeads = Array.from({ length: bucketLength }, () => 0);
    leadsCur.forEach((l) => {
      const d = diffDias(l.data_abertura);
      if (d >= 0 && d < bucketLength) {
        bucketLeads[bucketLength - 1 - d]++;
      }
    });

    const bucketVendas = Array.from({ length: bucketLength }, () => 0);
    const bucketFaturamento = Array.from({ length: bucketLength }, () => 0);
    vendasCur.forEach((v) => {
      const d = diffDias(v.data_fechamento!);
      if (d >= 0 && d < bucketLength) {
        bucketVendas[bucketLength - 1 - d]++;
        bucketFaturamento[bucketLength - 1 - d] += v.valor_fechado || 0;
      }
    });

    const bucketOrcamentos = Array.from({ length: bucketLength }, () => 0);
    leadsCur.forEach((l) => {
      if (l.valor_orcamento > 0) {
        const d = diffDias(l.data_abertura);
        if (d >= 0 && d < bucketLength) {
          bucketOrcamentos[bucketLength - 1 - d]++;
        }
      }
    });

    // De onde vêm os leads
    const origensMap: Record<string, number> = {};
    leadsCur.forEach((l) => {
      origensMap[l.origem] = (origensMap[l.origem] || 0) + 1;
    });
    const topOrigens = Object.entries(origensMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // Clientes para reativar (contatos antigos com compras e sem negociação aberta)
    const contatosMap: Record<
      string,
      { nome: string; tel: string; ltv: number; compras: number; ultima: string }
    > = {};
    negociacoes.forEach((n) => {
      if (n.status === 'Fechou' && n.data_fechamento && n.contatos?.telefone) {
        const tel = n.contatos.telefone;
        if (!contatosMap[tel]) {
          contatosMap[tel] = {
            nome: n.contatos.nome,
            tel,
            ltv: 0,
            compras: 0,
            ultima: n.data_fechamento,
          };
        }
        contatosMap[tel].ltv += n.valor_fechado || 0;
        contatosMap[tel].compras++;
        if (n.data_fechamento > contatosMap[tel].ultima) {
          contatosMap[tel].ultima = n.data_fechamento;
        }
      }
    });

    const paraReativar = Object.values(contatosMap)
      .filter((c) => diffDias(c.ultima) >= 90)
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, 5);

    // Precisa de contato (leads abertos parados há >= 3 dias)
    const parados = leadsCur
      .filter((n) => n.status !== 'Fechou' && n.status !== 'Não fechou' && diffDias(n.ultima_interacao) >= 3)
      .sort((a, b) => a.ultima_interacao.localeCompare(b.ultima_interacao))
      .slice(0, 5);

    // Meta
    const meta = clienteAtual?.meta_mensal || 0;
    const metaFrac = meta ? Math.min(1, fatCur / meta) : 0;
    const metaPct = Math.round(metaFrac * 100);

    return {
      fatCur,
      fatPrev,
      vTotCur,
      vTotPrev,
      ticketCur,
      ticketPrev,
      nLeadsCur,
      nLeadsPrev,
      orcCur,
      orcPrev,
      porTipo,
      taxaRecompra,
      bucketLeads,
      bucketVendas,
      bucketFaturamento,
      bucketOrcamentos,
      topOrigens,
      paraReativar,
      parados,
      meta,
      metaFrac,
      metaPct,
    };
  }, [negociacoes, dias, clienteAtual]);

  // Labels dinâmicos do gráfico de área
  const labelsArea = useMemo(() => {
    const hoje = new Date();
    const sub = (n: number) => {
      const d = new Date(hoje.getTime() - n * 864e5);
      return fdata(d.toISOString().slice(0, 10));
    };
    return [
      sub(dias - 1),
      sub(Math.floor((2 * (dias - 1)) / 3)),
      sub(Math.floor((dias - 1) / 3)),
      sub(0),
    ];
  }, [dias]);

  // SVG Sparkline
  const renderSparkline = (pts: number[], color: string) => {
    const smoothed = ma(pts);
    const w = 84;
    const h = 30;
    const mx = Math.max(...smoothed, 1);
    const n = smoothed.length;
    if (n < 2) return null;
    const x = (i: number) => 2 + (i * (w - 4)) / (n - 1);
    const y = (a: number) => h - 3 - (a / mx) * (h - 8);
    const points = smoothed.map((a, i) => `${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(' ');

    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-none">
        <polygon points={`${x(0)},${h - 2} ${points} ${x(n - 1)},${h - 2}`} fill={color} opacity="0.12" />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  // SVG Area Chart com dados diários reais
  const renderAreaChart = () => {
    const sLeads = ma(metricas.bucketLeads);
    const sVendas = ma(metricas.bucketVendas);
    const w = 700;
    const h = 240;
    const p = { l: 32, r: 10, t: 12, b: 26 };
    const iw = w - p.l - p.r;
    const ih = h - p.t - p.b;
    const n = Math.max(2, metricas.bucketLeads.length);
    const maxVal = Math.max(...sLeads, ...sVendas, 1);
    const top = Math.max(2, Math.ceil(maxVal / 2) * 2);

    const x = (i: number) => p.l + (n < 2 ? 0 : (i * iw) / (n - 1));
    const y = (v: number) => p.t + ih - (v / top) * ih;

    const ptsL = sLeads.map((a, i) => `${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(' ');
    const ptsV = sVendas.map((a, i) => `${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(' ');

    return (
      <svg className="chart w-full" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Gráfico de leads e vendas por dia">
        <g className="grid">
          {[0, 0.5, 1].map((f) => {
            const yy = p.t + ih - f * ih;
            return (
              <React.Fragment key={f}>
                <line x1={p.l} x2={w - p.r} y1={yy} y2={yy} />
                <text x={p.l - 8} y={yy + 4} textAnchor="end">
                  {(top * f).toFixed(0)}
                </text>
              </React.Fragment>
            );
          })}
        </g>
        {/* Curva de Leads (Vinho) */}
        <polygon points={`${x(0)},${p.t + ih} ${ptsL} ${x(n - 1)},${p.t + ih}`} fill="var(--accent)" opacity="0.13" />
        <polyline points={ptsL} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(sLeads[n - 1])} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        {/* Curva de Vendas (Dourado) */}
        <polyline points={ptsV} fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(sVendas[n - 1])} r="4" fill="var(--gold)" stroke="var(--surface)" strokeWidth="2" />
        {/* Eixo horizontal de datas */}
        {[0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1].map((idx, i) => (
          <text key={idx} x={x(idx)} y={h - 6} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}>
            {labelsArea[i]}
          </text>
        ))}
      </svg>
    );
  };

  // SVG Ring (Anel da Meta)
  const renderRing = (frac: number, label: string) => {
    const r = 54;
    const C = 2 * Math.PI * r;
    const f = Math.max(0, Math.min(1, frac));
    return (
      <svg className="ring" width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Progresso da meta">
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--line2)" strokeWidth="14" />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(f * C).toFixed(1)} ${C.toFixed(1)}`}
          transform="rotate(-90 75 75)"
        />
        <text className="big" x="75" y="82" textAnchor="middle">
          {label}
        </text>
      </svg>
    );
  };

  // SVG Donut (Rosca de Origens)
  const renderDonut = (parts: [string, number][], total: number) => {
    const r = 52;
    const C = 2 * Math.PI * r;
    let acc = 0;

    return (
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Distribuição por origem" className="flex-none">
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line2)" strokeWidth="18" />
          {parts.map((p, i) => {
            const len = total ? (p[1] / total) * C : 0;
            const circle = (
              <circle
                key={p[0]}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={`var(--c${(i % 6) + 1})`}
                strokeWidth="18"
                strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
                strokeDashoffset={(-acc).toFixed(2)}
              />
            );
            acc += len;
            return circle;
          })}
        </g>
        <text x="70" y="68" textAnchor="middle" style={{ fill: 'var(--ink)', fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font)' }}>
          {total}
        </text>
        <text x="70" y="86" textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: '11px', fontFamily: 'var(--font)' }}>
          leads
        </text>
      </svg>
    );
  };

  return (
    <div>
      {/* Header com alternador de período real */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {clienteAtual?.nome || 'Painel de Vendas'}
          </h1>
          <p className="text-muted text-xs mt-1">
            Seu painel de vendas e leads · {clienteAtual?.segmento}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} permitirTodos={false} />
          <button onClick={() => setModalVendaOpen(true)} className="btn">
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

      {/* Grid de KPIs dinâmicos com deltas reais */}
      <div className="kpis">
        <div className="kpi">
          <span className="l">Faturamento</span>
          <div className="row">
            <b className="num">{brl(metricas.fatCur)}</b>
            {renderSparkline(metricas.bucketFaturamento, 'var(--accent)')}
          </div>
          <div>{calcDelta(metricas.fatCur, metricas.fatPrev)}</div>
        </div>

        <div className="kpi">
          <span className="l">Vendas</span>
          <div className="row">
            <b className="num">{metricas.vTotCur}</b>
            {renderSparkline(metricas.bucketVendas, 'var(--accent)')}
          </div>
          <div>{calcDelta(metricas.vTotCur, metricas.vTotPrev)}</div>
        </div>

        <div className="kpi">
          <span className="l">Ticket médio</span>
          <div className="row">
            <b className="num">{brl(metricas.ticketCur)}</b>
          </div>
          <div>{calcDelta(metricas.ticketCur, metricas.ticketPrev)}</div>
        </div>

        <div className="kpi">
          <span className="l">Novos leads</span>
          <div className="row">
            <b className="num">{metricas.nLeadsCur}</b>
            {renderSparkline(metricas.bucketLeads, 'var(--accent)')}
          </div>
          <div>{calcDelta(metricas.nLeadsCur, metricas.nLeadsPrev)}</div>
        </div>

        <div className="kpi">
          <span className="l">Orçamentos</span>
          <div className="row">
            <b className="num">{metricas.orcCur}</b>
            {renderSparkline(metricas.bucketOrcamentos, 'var(--accent)')}
          </div>
          <div>{calcDelta(metricas.orcCur, metricas.orcPrev)}</div>
        </div>
      </div>

      {/* Taxa de Recompra */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="kpi">
          <span className="l">Taxa de recompra</span>
          <b className="num text-2xl">{pct(metricas.taxaRecompra)}</b>
          <span className="text-muted text-xs">vendas de clientes que já compraram</span>
        </div>
      </div>

      {/* Gráficos: Área e Meta */}
      <div className="g21">
        <div className="card">
          <div className="hd">
            <h2 className="text-sm font-bold text-ink">Leads e vendas por dia</h2>
            <div className="text-muted text-xs">
              <span className="text-accent">●</span> Leads &nbsp;
              <span className="text-gold">●</span> Vendas &nbsp;· média de 3 dias
            </div>
          </div>
          {renderAreaChart()}
        </div>

        <div className="card text-center flex flex-col justify-between">
          <div className="hd justify-center">
            <h2 className="text-sm font-bold text-ink">Meta de faturamento</h2>
          </div>
          <div className="grid place-items-center">
            {renderRing(metricas.metaFrac, `${metricas.metaPct}%`)}
          </div>
          <div className="mt-3">
            <b className="num text-lg">{brl(metricas.fatCur)}</b>
            <div className="text-muted text-xs">
              de {metricas.meta ? brl(metricas.meta) : 'R$ 0'} em faturamento total
            </div>
          </div>
        </div>
      </div>

      {/* Faturamento por tipo de cliente + Clientes para reativar */}
      <div className="g2">
        <div className="card">
          <div className="hd">
            <h2 className="text-sm font-bold text-ink">Faturamento por tipo de cliente</h2>
            <small>{dias} dias</small>
          </div>
          {metricas.fatCur > 0 ? (
            <>
              <div className="stack" role="img" aria-label="Faturamento por tipo de cliente">
                <i
                  style={{
                    width: `${(metricas.porTipo.Novo.fat / metricas.fatCur) * 100}%`,
                    background: 'var(--c3)',
                  }}
                />
                <i
                  style={{
                    width: `${(metricas.porTipo.Recorrente.fat / metricas.fatCur) * 100}%`,
                    background: 'var(--accent)',
                  }}
                />
                <i
                  style={{
                    width: `${(metricas.porTipo.Reativação.fat / metricas.fatCur) * 100}%`,
                    background: 'var(--gold)',
                  }}
                />
              </div>
              <div className="lg2">
                <div className="r">
                  <i style={{ background: 'var(--c3)' }} />
                  <span>
                    Cliente novo{' '}
                    <span className="muted xs">· {metricas.porTipo.Novo.n} venda(s)</span>
                  </span>
                  <b className="num">{brl(metricas.porTipo.Novo.fat)}</b>
                  <span className="muted num text-right">
                    {pct(metricas.porTipo.Novo.fat / metricas.fatCur)}
                  </span>
                </div>
                <div className="r">
                  <i style={{ background: 'var(--accent)' }} />
                  <span>
                    Recorrente{' '}
                    <span className="muted xs">· {metricas.porTipo.Recorrente.n} venda(s)</span>
                  </span>
                  <b className="num">{brl(metricas.porTipo.Recorrente.fat)}</b>
                  <span className="muted num text-right">
                    {pct(metricas.porTipo.Recorrente.fat / metricas.fatCur)}
                  </span>
                </div>
                <div className="r">
                  <i style={{ background: 'var(--gold)' }} />
                  <span>
                    Reativado{' '}
                    <span className="muted xs">· {metricas.porTipo.Reativação.n} venda(s)</span>
                  </span>
                  <b className="num">{brl(metricas.porTipo.Reativação.fat)}</b>
                  <span className="muted num text-right">
                    {pct(metricas.porTipo.Reativação.fat / metricas.fatCur)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty">Sem vendas registradas no período.</div>
          )}
        </div>

        <div className="card">
          <div className="hd">
            <h2 className="text-sm font-bold text-ink">Clientes para reativar</h2>
            <button
              onClick={() => navigate(`/c/${clienteAtual?.id}/follow-up?tab=reativar`)}
              className="btn sm"
            >
              Ver contatos
            </button>
          </div>
          {metricas.paraReativar.length > 0 ? (
            <ul className="alerts">
              {metricas.paraReativar.map((c) => (
                <li key={c.tel}>
                  <span className="dot w" />
                  <span className="flex-1 text-xs">
                    <b className="inline">{c.nome}</b>{' '}
                    <span className="text-muted">
                      · {brl(c.ltv)} em {c.compras} compra(s) · última {contatoTexto(c.ultima)}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      setEditingLeadId(null);
                      setModalLeadOpen(true);
                    }}
                    className="btn sm"
                  >
                    Reativar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">Nenhum cliente antigo parado para reativar.</div>
          )}
        </div>
      </div>

      {/* Funil de Negociações + De onde vêm os leads */}
      <div className="g2">
        <div className="card">
          <div className="hd">
            <h2 className="text-sm font-bold text-ink">Funil das negociações</h2>
            <small>abertas nos últimos {dias} dias</small>
          </div>
          <div className="fun">
            <div className="st">
              <span className="muted text-xs">Leads</span>
              <div className="bar2" style={{ width: '100%' }}>
                <span className="num">{metricas.nLeadsCur}</span>
                <small></small>
              </div>
            </div>
            <div className="st">
              <span className="muted text-xs">Com orçamento</span>
              <div
                className="bar2"
                style={{
                  width: `${Math.max(
                    18,
                    metricas.nLeadsCur ? (metricas.orcCur / metricas.nLeadsCur) * 100 : 0
                  )}%`,
                }}
              >
                <span className="num">{metricas.orcCur}</span>
                <small>
                  {metricas.nLeadsCur
                    ? pct(metricas.orcCur / metricas.nLeadsCur)
                    : '0%'}{' '}
                  dos leads
                </small>
              </div>
            </div>
            <div className="st">
              <span className="muted text-xs">Fechados</span>
              <div
                className="bar2"
                style={{
                  width: `${Math.max(
                    18,
                    metricas.nLeadsCur ? (metricas.vTotCur / metricas.nLeadsCur) * 100 : 0
                  )}%`,
                }}
              >
                <span className="num">{metricas.vTotCur}</span>
                <small>
                  {metricas.orcCur
                    ? pct(metricas.vTotCur / metricas.orcCur)
                    : '0%'}{' '}
                  dos orçamentos
                </small>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="hd">
            <h2 className="text-sm font-bold text-ink">De onde vêm os leads</h2>
            <small>{dias} dias</small>
          </div>
          {metricas.topOrigens.length > 0 ? (
            <div className="donutwrap">
              {renderDonut(metricas.topOrigens, metricas.nLeadsCur)}
              <div className="legend">
                {metricas.topOrigens.map(([origemNome, qtd], i) => (
                  <div key={origemNome}>
                    <i style={{ background: `var(--c${(i % 6) + 1})` }} />
                    <span className="text-xs">{origemNome}</span>
                    <b className="num text-xs">{qtd}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty">Sem leads cadastrados no período.</div>
          )}
        </div>
      </div>

      {/* Precisa de contato */}
      <div className="card mt-4">
        <div className="hd">
          <h2 className="text-sm font-bold text-ink">Precisa de contato</h2>
          <button
            onClick={() => navigate(`/c/${clienteAtual?.id}/follow-up`)}
            className="btn sm"
          >
            Ver todos
          </button>
        </div>
        {metricas.parados.length > 0 ? (
          <ul className="alerts">
            {metricas.parados.map((l) => (
              <li key={l.id}>
                <span className="dot b" />
                <span className="flex-1 text-xs">
                  <b className="inline">{l.contatos?.nome}</b> · {l.servico} ·{' '}
                  <PillStatus status={l.status} />{' '}
                  <span className="text-muted">
                    · último contato {contatoTexto(l.ultima_interacao)}
                  </span>
                </span>
                <button
                  onClick={() => {
                    setEditingLeadId(l.id);
                    setModalLeadOpen(true);
                  }}
                  className="btn sm"
                >
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">Todos os leads em aberto estão em dia.</div>
        )}
      </div>

      {/* Modais */}
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
    </div>
  );
};
