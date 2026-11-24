import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useNegociacoes, useClientes, useUsuarios, useRegistrarInteracao } from '../../queries';
import { Icon } from '../../components/Icon';
import { brl, diffDias, contatoTexto, digits, fdata } from '../../lib/format';
import { FormLead } from './FormLead';
import { useToast } from '../../components/Toast';
import { FiltroPeriodo, PeriodoState, estaNoPeriodo } from '../../components/FiltroPeriodo';

export const FollowUp: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'parados';

  const { data: clientes = [] } = useClientes();
  const clienteAtual = clientes.find((c) => c.id === clienteId);
  const { data: negociacoes = [], isLoading } = useNegociacoes(clienteId);
  const { data: usuarios = [] } = useUsuarios(clienteId);

  const registrarInteracao = useRegistrarInteracao();
  const { showToast } = useToast();

  const [busca, setBusca] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos');
  const [filtroDias, setFiltroDias] = useState<string>('3'); // '3', '7', '15', 'todos'
  const [periodo, setPeriodo] = useState<PeriodoState>({ tipo: 'todos' });
  const [modalLeadOpen, setModalLeadOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  // 1. Leads parados (Novo, Orçamento, Negociando)
  const leadsParados = useMemo(() => {
    return negociacoes.filter((n) => {
      if (n.status === 'Fechou' || n.status === 'Não fechou') return false;
      if (!estaNoPeriodo(n.data_abertura, periodo)) return false;
      const d = diffDias(n.ultima_interacao);
      if (filtroDias === '3' && d < 3) return false;
      if (filtroDias === '7' && d < 7) return false;
      if (filtroDias === '15' && d < 15) return false;
      return true;
    });
  }, [negociacoes, filtroDias, periodo]);

  // 2. Clientes para reativação (compras fechadas há mais de 90 dias e sem lead em aberto)
  const clientesReativacao = useMemo(() => {
    const contatosMap: Record<
      string,
      {
        contatoId: string;
        nome: string;
        tel: string;
        bairro: string;
        ltv: number;
        compras: number;
        ultima: string;
        temAberto: boolean;
      }
    > = {};

    negociacoes.forEach((n) => {
      const tel = n.contatos?.telefone;
      if (!tel) return;

      if (!contatosMap[tel]) {
        contatosMap[tel] = {
          contatoId: n.contatos?.id || '',
          nome: n.contatos?.nome || 'Sem nome',
          tel,
          bairro: n.contatos?.bairro || '',
          ltv: 0,
          compras: 0,
          ultima: '',
          temAberto: false,
        };
      }

      if (n.status === 'Fechou' && n.data_fechamento) {
        contatosMap[tel].ltv += n.valor_fechado || 0;
        contatosMap[tel].compras++;
        if (!contatosMap[tel].ultima || n.data_fechamento > contatosMap[tel].ultima) {
          contatosMap[tel].ultima = n.data_fechamento;
        }
      } else if (n.status !== 'Não fechou') {
        contatosMap[tel].temAberto = true;
      }
    });

    return Object.values(contatosMap)
      .filter((c) => c.compras > 0 && !c.temAberto && diffDias(c.ultima) >= 90)
      .sort((a, b) => b.ltv - a.ltv);
  }, [negociacoes]);

  // 3. Orçamentos pendentes
  const orcamentosPendentes = useMemo(() => {
    return negociacoes.filter(
      (n) => n.status === 'Orçamento' && (n.valor_orcamento || 0) > 0 && estaNoPeriodo(n.data_abertura, periodo)
    );
  }, [negociacoes, periodo]);

  // Filtros de busca e responsável
  const leadsFiltrados = useMemo(() => {
    return leadsParados.filter((n) => {
      if (filtroResponsavel !== 'todos' && n.responsavel_id !== filtroResponsavel) {
        return false;
      }
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      const nome = (n.contatos?.nome || '').toLowerCase();
      const tel = digits(n.contatos?.telefone || '');
      const servico = (n.servico || '').toLowerCase();
      return nome.includes(b) || tel.includes(b) || servico.includes(b);
    });
  }, [leadsParados, busca, filtroResponsavel]);

  const reativacaoFiltrada = useMemo(() => {
    return clientesReativacao.filter((c) => {
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      const nome = c.nome.toLowerCase();
      const tel = digits(c.tel);
      const bairro = c.bairro.toLowerCase();
      return nome.includes(b) || tel.includes(b) || bairro.includes(b);
    });
  }, [clientesReativacao, busca]);

  const orcamentosFiltrados = useMemo(() => {
    return orcamentosPendentes.filter((n) => {
      if (filtroResponsavel !== 'todos' && n.responsavel_id !== filtroResponsavel) {
        return false;
      }
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      const nome = (n.contatos?.nome || '').toLowerCase();
      const tel = digits(n.contatos?.telefone || '');
      const servico = (n.servico || '').toLowerCase();
      return nome.includes(b) || tel.includes(b) || servico.includes(b);
    });
  }, [orcamentosPendentes, busca, filtroResponsavel]);

  // KPIs
  const totalParados = leadsParados.length;
  const valorTotalParados = leadsParados.reduce(
    (acc, cur) => acc + (cur.valor_orcamento || 0),
    0
  );
  const criticos7d = leadsParados.filter((n) => diffDias(n.ultima_interacao) >= 7).length;
  const totalReativar = clientesReativacao.length;
  const ltvTotalReativar = clientesReativacao.reduce((acc, cur) => acc + cur.ltv, 0);

  const handleMarcarContatoHoje = async (negociacaoId: string) => {
    if (!clienteId) return;
    try {
      await registrarInteracao.mutateAsync({
        id: negociacaoId,
        cliente_id: clienteId,
      });
      showToast('Contato registrado com sucesso para hoje!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar contato.');
    }
  };

  const gerarLinkWhatsapp = (nome: string, telefone: string, servico?: string) => {
    const limpo = digits(telefone);
    const ddi = limpo.startsWith('55') ? limpo : `55${limpo}`;
    const emp = clienteAtual?.nome || 'Nossa Empresa';
    const s = servico ? ` referente ao serviço de ${servico}` : '';
    const msg = `Olá ${nome}! Tudo bem? Aqui é da ${emp}. Passando para saber se você conseguiu avaliar nossa proposta${s}! Posso te ajudar com alguma dúvida?`;
    return `https://api.whatsapp.com/send?phone=${ddi}&text=${encodeURIComponent(msg)}`;
  };

  const gerarLinkWhatsappReativacao = (nome: string, telefone: string) => {
    const limpo = digits(telefone);
    const ddi = limpo.startsWith('55') ? limpo : `55${limpo}`;
    const emp = clienteAtual?.nome || 'Nossa Empresa';
    const msg = `Olá ${nome}! Tudo bem? Aqui é da equipe da ${emp}. Faz um tempinho desde seu último serviço com a gente. Estamos com condições especiais este mês e gostaríamos de saber se você está precisando de película ou manutenção!`;
    return `https://api.whatsapp.com/send?phone=${ddi}&text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="flex-1 p-6 md:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">Follow-up & Reativação</h1>
            <span className="bg-[#B8893B]/20 text-[#E9C98A] border border-[#B8893B]/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {totalParados + totalReativar} ações recomendadas
            </span>
          </div>
          <p className="text-muted text-xs mt-1">
            Recupere leads em andamento e reative clientes da base para gerar receita imediata.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingLeadId(null);
            setModalLeadOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8E2841] to-[#5A1526] hover:brightness-110 text-white rounded-[10px] text-xs font-semibold shadow-sm transition-all"
        >
          <Icon name="plus" size={16} />
          <span>Novo Lead</span>
        </button>
      </div>

      {/* Cards de Métricas de Alerta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs mb-2">
            <span>Precisam de contato</span>
            <div className="w-6 h-6 rounded-md bg-[#B8893B]/15 text-[#E9C98A] flex items-center justify-center">
              <Icon name="phone" size={14} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-ink num">{totalParados}</div>
            <div className="text-[11px] text-muted mt-1">
              {brl(valorTotalParados)} em aberto
            </div>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs mb-2">
            <span>Urgência crítica (&gt; 7 dias)</span>
            <div className="w-6 h-6 rounded-md bg-bad-soft text-bad flex items-center justify-center">
              <Icon name="bell" size={14} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-bad num">{criticos7d}</div>
            <div className="text-[11px] text-muted mt-1">Esfriando sem resposta</div>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs mb-2">
            <span>Orçamentos pendentes</span>
            <div className="w-6 h-6 rounded-md bg-primary-soft text-primary flex items-center justify-center">
              <Icon name="money" size={14} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-ink num">
              {orcamentosPendentes.length}
            </div>
            <div className="text-[11px] text-muted mt-1">Proposta enviada</div>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs mb-2">
            <span>Base para reativação</span>
            <div className="w-6 h-6 rounded-md bg-good-soft text-good flex items-center justify-center">
              <Icon name="users" size={14} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-ink num">{totalReativar}</div>
            <div className="text-[11px] text-muted mt-1">
              LTV histórico: {brl(ltvTotalReativar)}
            </div>
          </div>
        </div>
      </div>

      {/* Abas e Barra de Filtros */}
      <div className="bg-surface border border-line rounded-[16px] overflow-hidden">
        {/* Topo das Abas */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-line">
          {/* Navegação entre Abas */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-hover rounded-[12px] border border-line">
            <button
              onClick={() => setSearchParams({ tab: 'parados' })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[9px] text-xs font-semibold transition-all ${
                activeTab === 'parados'
                  ? 'bg-primary text-white shadow'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>Leads Precisando de Atenção</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/25">
                {leadsParados.length}
              </span>
            </button>

            <button
              onClick={() => setSearchParams({ tab: 'reativar' })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[9px] text-xs font-semibold transition-all ${
                activeTab === 'reativar'
                  ? 'bg-primary text-white shadow'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>Clientes para Reativar</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/25">
                {clientesReativacao.length}
              </span>
            </button>

            <button
              onClick={() => setSearchParams({ tab: 'orcamentos' })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[9px] text-xs font-semibold transition-all ${
                activeTab === 'orcamentos'
                  ? 'bg-primary text-white shadow'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>Orçamentos em Aberto</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/25">
                {orcamentosPendentes.length}
              </span>
            </button>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px]">
              <Icon
                name="search"
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, fone..."
                className="w-full pl-8 pr-3 py-1.5 bg-surface-hover border border-line rounded-[10px] text-xs text-ink placeholder:text-muted focus:outline-none focus:border-primary/50"
              />
            </div>

            {activeTab === 'parados' && (
              <select
                value={filtroDias}
                onChange={(e) => setFiltroDias(e.target.value)}
                className="bg-surface-hover border border-line text-ink rounded-[10px] px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="3">Sem contato há 3+ dias</option>
                <option value="7">Sem contato há 7+ dias (Crítico)</option>
                <option value="15">Sem contato há 15+ dias</option>
                <option value="todos">Todos os leads abertos</option>
              </select>
            )}

            {activeTab !== 'reativar' && (
              <FiltroPeriodo value={periodo} onChange={setPeriodo} />
            )}

            {activeTab !== 'reativar' && (
              <select
                value={filtroResponsavel}
                onChange={(e) => setFiltroResponsavel(e.target.value)}
                className="bg-surface-hover border border-line text-ink rounded-[10px] px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="todos">Todos os responsáveis</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Conteúdo da Aba 1: Leads Parados */}
        {activeTab === 'parados' && (
          <div className="divide-y divide-line">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted">Carregando leads...</div>
            ) : leadsFiltrados.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-good-soft text-good mx-auto flex items-center justify-center mb-3">
                  <Icon name="checkCircle" size={24} />
                </div>
                <h4 className="text-sm font-semibold text-ink">Tudo em dia!</h4>
                <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                  Nenhum lead parado precisando de contato no momento com os filtros selecionados.
                </p>
              </div>
            ) : (
              leadsFiltrados.map((neg) => {
                const diasSemContato = diffDias(neg.ultima_interacao);
                const ehCritico = diasSemContato >= 7;
                const tel = neg.contatos?.telefone || '';
                const nome = neg.contatos?.nome || 'Sem nome';

                return (
                  <div
                    key={neg.id}
                    className="p-4 hover:bg-surface-hover/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-[12px] flex flex-col items-center justify-center flex-none font-bold text-[11px] ${
                          ehCritico
                            ? 'bg-bad-soft text-bad border border-bad/30'
                            : 'bg-[#B8893B]/15 text-[#E9C98A] border border-[#B8893B]/25'
                        }`}
                        title={`Último contato: ${contatoTexto(neg.ultima_interacao)}`}
                      >
                        <span className="text-[9px] uppercase leading-none">Dias</span>
                        <span className="text-sm font-extrabold leading-tight">
                          {diasSemContato}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <b className="text-sm text-ink truncate">{nome}</b>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              neg.status === 'Novo'
                                ? 'bg-blue-500/15 text-blue-400'
                                : neg.status === 'Orçamento'
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-purple-500/15 text-purple-400'
                            }`}
                          >
                            {neg.status}
                          </span>
                          <span className="text-[11px] text-muted">· {neg.origem}</span>
                        </div>

                        <div className="text-xs text-muted flex flex-wrap items-center gap-3 mt-1">
                          <span>Serviço: <strong className="text-ink font-medium">{neg.servico}</strong></span>
                          {tel && <span>Telefone: <strong className="text-ink font-medium">{tel}</strong></span>}
                          {neg.perfis?.nome && <span>Resp.: <strong className="text-ink font-medium">{neg.perfis.nome}</strong></span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end md:self-center">
                      <div className="text-right mr-2 hidden sm:block">
                        <div className="text-xs font-bold text-ink num">
                          {neg.valor_orcamento ? brl(neg.valor_orcamento) : 'Sem valor'}
                        </div>
                        <div className="text-[10px] text-muted">
                          Última interação: {fdata(neg.ultima_interacao)}
                        </div>
                      </div>

                      {tel && (
                        <a
                          href={gerarLinkWhatsapp(nome, tel, neg.servico)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 rounded-[10px] text-xs font-semibold transition-all"
                          title="Enviar mensagem via WhatsApp"
                        >
                          <Icon name="whatsapp" size={14} />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <button
                        onClick={() => handleMarcarContatoHoje(neg.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover hover:bg-white/10 text-ink border border-line rounded-[10px] text-xs font-semibold transition-all"
                        title="Marcar que entrou em contato hoje"
                      >
                        <Icon name="checkCircle" size={14} className="text-good" />
                        <span>Falei hoje</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingLeadId(neg.id);
                          setModalLeadOpen(true);
                        }}
                        className="px-3 py-1.5 bg-primary-soft hover:bg-primary/20 text-primary border border-primary/30 rounded-[10px] text-xs font-semibold transition-all"
                        title="Abrir detalhes e negociar"
                      >
                        Abrir
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Conteúdo da Aba 2: Reativação */}
        {activeTab === 'reativar' && (
          <div className="divide-y divide-line">
            {reativacaoFiltrada.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted">
                Nenhum cliente para reativar no momento.
              </div>
            ) : (
              reativacaoFiltrada.map((cli) => {
                const diasUltima = diffDias(cli.ultima);

                return (
                  <div
                    key={cli.tel}
                    className="p-4 hover:bg-surface-hover/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-[12px] bg-good-soft border border-good/30 text-good flex flex-col items-center justify-center flex-none font-bold text-[11px]">
                        <span className="text-[9px] uppercase leading-none">Fechou</span>
                        <span className="text-sm font-extrabold leading-tight">
                          {cli.compras}x
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <b className="text-sm text-ink truncate">{cli.nome}</b>
                          {cli.bairro && (
                            <span className="text-[11px] text-muted">· {cli.bairro}</span>
                          )}
                        </div>

                        <div className="text-xs text-muted flex flex-wrap items-center gap-3 mt-1">
                          <span>Histórico: <strong className="text-ink font-semibold">{brl(cli.ltv)}</strong> em {cli.compras} compra(s)</span>
                          <span>Última compra: <strong className="text-bad font-medium">há {diasUltima} dias</strong> ({fdata(cli.ultima)})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end md:self-center">
                      <a
                        href={gerarLinkWhatsappReativacao(cli.nome, cli.tel)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 rounded-[10px] text-xs font-semibold transition-all"
                      >
                        <Icon name="whatsapp" size={14} />
                        <span>Ofertar Reativação</span>
                      </a>

                      <button
                        onClick={() => {
                          setEditingLeadId(null);
                          setModalLeadOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:brightness-110 text-white rounded-[10px] text-xs font-semibold transition-all"
                      >
                        <Icon name="plus" size={14} />
                        <span>Novo Lead</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Conteúdo da Aba 3: Orçamentos em Aberto */}
        {activeTab === 'orcamentos' && (
          <div className="divide-y divide-line">
            {orcamentosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted">
                Nenhum orçamento pendente encontrado.
              </div>
            ) : (
              orcamentosFiltrados.map((neg) => {
                const diasSemContato = diffDias(neg.ultima_interacao);
                const tel = neg.contatos?.telefone || '';
                const nome = neg.contatos?.nome || 'Sem nome';

                return (
                  <div
                    key={neg.id}
                    className="p-4 hover:bg-surface-hover/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <b className="text-sm text-ink truncate">{nome}</b>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400">
                          {brl(neg.valor_orcamento)}
                        </span>
                        <span className="text-[11px] text-muted">· {neg.origem}</span>
                      </div>

                      <div className="text-xs text-muted flex flex-wrap items-center gap-3 mt-1">
                        <span>Serviço: <strong className="text-ink font-medium">{neg.servico}</strong></span>
                        <span>Sem resposta há: <strong className="text-bad font-medium">{diasSemContato} dias</strong></span>
                        {neg.perfis?.nome && <span>Resp.: <strong className="text-ink font-medium">{neg.perfis.nome}</strong></span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end md:self-center">
                      {tel && (
                        <a
                          href={gerarLinkWhatsapp(nome, tel, neg.servico)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 rounded-[10px] text-xs font-semibold transition-all"
                        >
                          <Icon name="whatsapp" size={14} />
                          <span>Negociar Proposta</span>
                        </a>
                      )}

                      <button
                        onClick={() => handleMarcarContatoHoje(neg.id)}
                        className="px-3 py-1.5 bg-surface-hover hover:bg-white/10 text-ink border border-line rounded-[10px] text-xs font-semibold transition-all"
                      >
                        Falei hoje
                      </button>

                      <button
                        onClick={() => {
                          setEditingLeadId(neg.id);
                          setModalLeadOpen(true);
                        }}
                        className="px-3 py-1.5 bg-primary-soft hover:bg-primary/20 text-primary border border-primary/30 rounded-[10px] text-xs font-semibold transition-all"
                      >
                        Editar / Fechar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal de Lead */}
      {clienteAtual && (
        <FormLead
          isOpen={modalLeadOpen}
          onClose={() => {
            setModalLeadOpen(false);
            setEditingLeadId(null);
          }}
          clienteId={clienteAtual.id}
          servicos={clienteAtual.servicos}
          leadId={editingLeadId}
        />
      )}
    </div>
  );
};
