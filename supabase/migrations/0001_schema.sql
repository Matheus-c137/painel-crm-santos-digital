-- ==============================================================================
-- 0001_schema.sql
-- Painel de Leads, Vendas e Comissão - Santos Digital
-- ==============================================================================

-- 1. Extensões
create extension if not exists "uuid-ossp";

-- 2. Enums
create type papel as enum (
  'superadmin',
  'agencia',
  'admin_cliente',
  'comercial',
  'visualizador'
);

create type status_perfil as enum (
  'ativo',
  'suspenso',
  'convite_pendente'
);

create type status_negociacao as enum (
  'Novo',
  'Orçamento',
  'Negociando',
  'Fechou',
  'Não fechou'
);

create type origem as enum (
  'Google Ads',
  'Google Maps',
  'Site',
  'Meta Ads',
  'Instagram',
  'Indicação',
  'Ligação',
  'Cliente antigo'
);

create type motivo_perda as enum (
  'Preço',
  'Só pesquisando',
  'Sem resposta',
  'Fechou com outro',
  'Serviço que não fazemos',
  'Adiou a decisão'
);

create type tipo_cliente as enum (
  'Novo',
  'Recorrente',
  'Reativação'
);

-- 3. Tabela Clientes
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text not null default 'Sem segmento',
  ativo boolean not null default true,
  servicos text[] not null default '{}',
  investimento_mensal numeric(12,2) not null default 0,
  meta_mensal numeric(12,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4. Tabela Comissão Config (Exclusiva do superadmin, isolada de clientes)
create table if not exists comissao_config (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  percentual numeric(5,2) not null default 1.00 check (percentual >= 0 and percentual <= 100),
  atualizado_em timestamptz not null default now()
);

-- 5. Tabela Perfis (usuários vinculados ao auth.users)
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  papel papel not null default 'comercial',
  cliente_id uuid references clientes(id) on delete cascade,
  status status_perfil not null default 'ativo',
  ultimo_acesso timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint check_papel_cliente check (
    (papel in ('superadmin', 'agencia') and cliente_id is null) or
    (papel in ('admin_cliente', 'comercial', 'visualizador') and cliente_id is not null)
  )
);

-- 6. Tabela Contatos (deduplicação por cliente + dígitos do telefone)
create table if not exists contatos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nome text not null,
  telefone text not null,
  telefone_digitos text generated always as (regexp_replace(telefone, '\D', '', 'g')) stored,
  bairro text default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint unq_contato_cliente_tel unique (cliente_id, telefone_digitos)
);

-- 7. Tabela Negociações (leads e vendas)
create table if not exists negociacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  contato_id uuid not null references contatos(id) on delete cascade,
  data_abertura date not null default (now() at time zone 'America/Fortaleza')::date,
  ultima_interacao date not null default (now() at time zone 'America/Fortaleza')::date,
  servico text not null,
  origem origem not null default 'Google Ads',
  responsavel_id uuid references perfis(id) on delete set null,
  status status_negociacao not null default 'Novo',
  valor_orcamento numeric(12,2) not null default 0,
  valor_fechado numeric(12,2) not null default 0,
  data_fechamento date,
  motivo_perda motivo_perda,
  observacoes text default '',
  tipo_cliente tipo_cliente not null default 'Novo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 8. Tabela Histórico Negociação
create table if not exists historico_negociacao (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  data date not null default (now() at time zone 'America/Fortaleza')::date,
  texto text not null,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- 9. Tabela Faturamento Mensal (para fase 3, já estruturada)
create table if not exists faturamento_mensal (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'), -- AAAA-MM
  total_informado numeric(12,2) not null default 0,
  informado_por uuid references perfis(id) on delete set null,
  informado_em timestamptz not null default now(),
  constraint unq_faturamento_cliente_mes unique (cliente_id, mes)
);

-- 10. Tabela Comissao Recebimento (só superadmin, fase 3)
create table if not exists comissao_recebimento (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  recebida boolean not null default false,
  recebida_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint unq_comissao_recebimento_cliente_mes unique (cliente_id, mes)
);

-- 11. Tabela Log Atividade
create table if not exists log_atividade (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  usuario_id uuid references perfis(id) on delete set null,
  texto text not null,
  criado_em timestamptz not null default now()
);

-- Índices essenciais
create index if not exists idx_perfis_cliente on perfis(cliente_id);
create index if not exists idx_perfis_papel on perfis(papel);
create index if not exists idx_contatos_cliente_tel on contatos(cliente_id, telefone_digitos);
create index if not exists idx_negociacoes_cliente_status on negociacoes(cliente_id, status);
create index if not exists idx_negociacoes_contato on negociacoes(contato_id);
create index if not exists idx_negociacoes_fechamento on negociacoes(data_fechamento);
create index if not exists idx_historico_negociacao on historico_negociacao(negociacao_id);
create index if not exists idx_log_atividade_cliente on log_atividade(cliente_id, criado_em desc);
