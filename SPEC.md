# Painel de Leads, Vendas e Comissão — Especificação

Produto da Agência Santos Digital. Cada cliente da agência recebe um painel onde a equipe dele cadastra leads, orçamentos e vendas. A agência acompanha todos os clientes, vê a própria comissão (1% do faturamento total da empresa) e atua como superadmin.

Referência visual e de comportamento: `referencia/painel-leads.html` (protótipo com dados inventados). Quando este documento e o protótipo divergirem, vale este documento.

## Stack
React + Vite + TypeScript, Tailwind, React Router, TanStack Query, Supabase (Auth, Postgres, RLS), deploy na Vercel. Interface em português do Brasil.

## Visual
- Marca: vinho `#5A1526` (escuro: `#D9708B`) e dourado `#B8893B` (escuro: `#D4A857`). Menu lateral vinho escuro, conteúdo claro, cartões com borda fina e cantos de 14px.
- Fonte: Plus Jakarta Sans. Números tabulares.
- Tema claro e escuro automático (prefers-color-scheme).
- Estilo: minimalista, muito espaço em branco, hierarquia clara (referências: Apple, Stripe, Linear).
- Gráficos em SVG simples: sparkline, área com média de 3 dias, rosca por origem, anel de meta, barras horizontais.

## Papéis
| Papel | Escopo |
|---|---|
| superadmin | Tudo. Único que vê comissões. É o Matheus. |
| agencia | Vê todos os clientes. Não vê comissões. |
| admin_cliente | Gerencia o painel e os usuários do próprio cliente. |
| comercial | Cadastra e edita leads e vendas do próprio cliente. |
| visualizador | Só leitura no próprio cliente. |

Permissões por ação:
- Ver painel do próprio cliente: todos.
- Cadastrar e editar leads e vendas: superadmin, agencia, admin_cliente, comercial.
- Excluir registros e gerenciar usuários do cliente: superadmin, agencia, admin_cliente.
- Informar faturamento total do mês: superadmin, agencia, admin_cliente.
- Ver todos os clientes: superadmin, agencia.
- Ver comissões, criar/editar/pausar clientes: somente superadmin.
- Ver histórico de atividade: superadmin, agencia, admin_cliente.

## Regras que valem no banco (RLS), não só na tela
1. Usuário de cliente só lê e escreve dados do próprio `cliente_id`.
2. A tabela de comissões e o campo `percentual_comissao` são legíveis somente por superadmin. O cliente não pode obtê-los por nenhuma consulta. Guardar o percentual em tabela separada, com política própria, e não na tabela `clientes`.
3. Cliente pausado não aceita novos registros.
4. Login individual por e-mail e senha. Convite por e-mail. Usuário pode ser suspenso.
5. Toda ação relevante grava em `log_atividade`.

## Modelo de dados
- `clientes`: id, nome, segmento, ativo, servicos (lista), investimento_mensal, meta_mensal.
- `comissao_config` (só superadmin): cliente_id, percentual (padrão 1).
- `perfis`: user_id, nome, papel, cliente_id (nulo para agência), status (ativo, suspenso, convite pendente), ultimo_acesso.
- `contatos`: id, cliente_id, nome, telefone, telefone_digitos (só dígitos), bairro. Único por (cliente_id, telefone_digitos).
- `negociacoes`: id, cliente_id, contato_id, data_abertura, ultima_interacao, servico, origem, responsavel_id, status, valor_orcamento, valor_fechado, data_fechamento, motivo_perda, observacoes, tipo_cliente (calculado).
- `historico_negociacao`: negociacao_id, data, texto.
- `faturamento_mensal`: cliente_id, mes (AAAA-MM), total_informado, informado_por, informado_em.
- `comissao_recebimento` (só superadmin): cliente_id, mes, recebida, recebida_em.
- `log_atividade`: id, cliente_id, usuario_id, texto, criado_em.

Status: Novo, Orçamento, Negociando, Fechou, Não fechou.
Origens: Google Ads, Google Maps, Site, Meta Ads, Instagram, Indicação, Ligação, Cliente antigo.
Motivos de perda: Preço, Só pesquisando, Sem resposta, Fechou com outro, Serviço que não fazemos, Adiou a decisão.

## Regras de negócio
- **Contato único por telefone** dentro do cliente. Ao digitar um telefone em lead ou venda, buscar o contato; se existir, preencher nome e bairro e mostrar compras, total gasto e última compra.
- **Tipo da venda/negociação** (campo calculado na hora do fechamento ou abertura, pela data de referência):
  - Novo: nenhuma compra anterior.
  - Recorrente: última compra anterior há até 180 dias.
  - Reativação: última compra anterior há mais de 180 dias.
- **Situação do contato** (calculada): Lead (sem compra, com negociação aberta), Perdido (sem compra e sem aberta), Ativo (1 compra, até 90 dias), Recorrente (2+ compras, até 90 dias), Em risco (91 a 180 dias), Inativo (mais de 180 dias).
- **Receita conta pela data de fechamento**, não pela data do lead.
- **Registrar venda direta**: cria negociação já com status Fechou, sem orçamento (cliente que volta e compra, balcão). Campos obrigatórios: cliente, telefone, serviço, valor, data (até hoje), origem.
- **Mudança de status**:
  - Para Fechou: exige valor fechado e data de fechamento (padrão hoje).
  - Para Não fechou: exige motivo.
  - Sair de Fechou: zera valor fechado e data de fechamento.
- **Faturamento considerado do mês** = maior valor entre (soma das vendas registradas no mês) e (total informado pela empresa no mês).
- **Comissão do mês** = faturamento considerado × percentual do cliente.
- Lead parado = em aberto (Novo, Orçamento, Negociando) sem interação há 3 dias ou mais.
- Qualidade dos dados = % de negociações sem problemas. Problemas: venda sem valor, perdido sem motivo, sem responsável.
- Saúde do cliente (0 a 100): parte de 100, desconta leads parados, qualidade dos dados e dias sem lead novo. Faixas: 80+ Saudável, 60+ Atenção, abaixo Crítico.
- Taxa de recompra = vendas de Recorrente + Reativação ÷ total de vendas do período.
- Ticket médio = faturamento ÷ vendas com valor.
- Custo por lead novo e por venda nova usam o investimento mensal informado e consideram só clientes novos. Não há rastreio de anúncios.

## Telas
**Agência (superadmin e agencia)**
- Carteira: KPIs agregados (comissão do mês só para superadmin), cartões por cliente com saúde, leads, vendas, faturamento e recompra, e lista de pontos de atenção.
- Clientes: tabela com criar, editar (inclui % de comissão, só superadmin), pausar e reativar, abrir painel.
- Comissões (só superadmin): seletor de mês, tabela por cliente (registrado, informado, considerado, comissão, situação), marcar como recebida, histórico de meses.
- Usuários e acessos: lista, convidar, suspender, reenviar convite, matriz de permissões.
- Atividade: linha do tempo com filtro por cliente.

**Painel do cliente (também acessível pela agência)**
- Visão geral: faturamento, vendas, ticket médio, novos leads, orçamentos, recompra; gráfico de leads e vendas por dia; anel da meta do mês; faturamento por tipo de cliente; clientes para reativar; funil; origens; leads que precisam de contato. Para a agência, faixa extra com investimento, comissão e qualidade dos dados.
- Pipeline: quadro com 5 colunas e arrastar e soltar. Mover para Fechou ou Não fechou abre o formulário pedindo valor ou motivo.
- Leads e orçamentos: tabela com busca e filtro por status, gaveta de detalhe com histórico, WhatsApp, registrar contato e anotações.
- Vendas: KPIs e tabela das vendas do período com tipo de cliente.
- Contatos: base única com situação, compras, total e ticket; filtros; ações Registrar venda e Nova negociação.
- Follow-up: abertos sem contato há 3+ dias e em dia, com botão de WhatsApp.
- Faturamento: por mês, registrado vs informado, botão "Informar total"; por tipo de cliente; melhores clientes.
- Origens e equipe: conversão por origem, desempenho por responsável, motivos de perda.
- Minha equipe: usuários do cliente e convite.

## Fases de entrega
1. Schema SQL com RLS, login, clientes e usuários (convite), leads, pipeline, registrar venda.
2. Contatos, tipo de cliente automático, reativação, follow-up.
3. Faturamento mensal e comissões.
4. Visão geral com gráficos, origens e equipe, atividade.
5. Polimento: tema escuro, responsivo, estados vazios.

Ao fim de cada fase, parar e mostrar como testar. Testar sempre com dois logins: superadmin e usuário de cliente.
