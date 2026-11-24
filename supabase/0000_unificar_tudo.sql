-- ==============================================================================
-- 0000_unificar_tudo.sql
-- Script completo pronto para colar no SQL Editor do Supabase Dashboard
-- ==============================================================================

-- 1. Extensões
create extension if not exists "uuid-ossp";

-- 2. Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'papel') then
    create type papel as enum ('superadmin', 'agencia', 'admin_cliente', 'comercial', 'visualizador');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_perfil') then
    create type status_perfil as enum ('ativo', 'suspenso', 'convite_pendente');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_negociacao') then
    create type status_negociacao as enum ('Novo', 'Orçamento', 'Negociando', 'Fechou', 'Não fechou');
  end if;
  if not exists (select 1 from pg_type where typname = 'origem') then
    create type origem as enum ('Google Ads', 'Google Maps', 'Site', 'Meta Ads', 'Instagram', 'Indicação', 'Ligação', 'Cliente antigo');
  end if;
  if not exists (select 1 from pg_type where typname = 'motivo_perda') then
    create type motivo_perda as enum ('Preço', 'Só pesquisando', 'Sem resposta', 'Fechou com outro', 'Serviço que não fazemos', 'Adiou a decisão');
  end if;
  if not exists (select 1 from pg_type where typname = 'tipo_cliente') then
    create type tipo_cliente as enum ('Novo', 'Recorrente', 'Reativação');
  end if;
end $$;

-- 3. Tabelas
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

create table if not exists comissao_config (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  percentual numeric(5,2) not null default 1.00 check (percentual >= 0 and percentual <= 100),
  atualizado_em timestamptz not null default now()
);

create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  papel papel not null default 'comercial',
  cliente_id uuid references clientes(id) on delete cascade,
  status status_perfil not null default 'ativo',
  ultimo_acesso timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

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

create table if not exists historico_negociacao (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  data date not null default (now() at time zone 'America/Fortaleza')::date,
  texto text not null,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists faturamento_mensal (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  total_informado numeric(12,2) not null default 0,
  informado_por uuid references perfis(id) on delete set null,
  informado_em timestamptz not null default now(),
  constraint unq_faturamento_cliente_mes unique (cliente_id, mes)
);

create table if not exists comissao_recebimento (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  recebida boolean not null default false,
  recebida_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint unq_comissao_recebimento_cliente_mes unique (cliente_id, mes)
);

create table if not exists log_atividade (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  usuario_id uuid references perfis(id) on delete set null,
  texto text not null,
  criado_em timestamptz not null default now()
);

-- Índices
create index if not exists idx_perfis_cliente on perfis(cliente_id);
create index if not exists idx_contatos_cliente_tel on contatos(cliente_id, telefone_digitos);
create index if not exists idx_negociacoes_cliente_status on negociacoes(cliente_id, status);
create index if not exists idx_negociacoes_contato on negociacoes(contato_id);
create index if not exists idx_negociacoes_fechamento on negociacoes(data_fechamento);

-- 4. Funções e Triggers
create or replace function eu_papel()
returns papel
language sql
security definer
stable
as $$
  select papel from perfis where id = auth.uid() and status = 'ativo';
$$;

create or replace function eu_cliente()
returns uuid
language sql
security definer
stable
as $$
  select cliente_id from perfis where id = auth.uid() and status = 'ativo';
$$;

create or replace function eh_superadmin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(eu_papel() = 'superadmin', false);
$$;

create or replace function pode_acessar_cliente(cid uuid)
returns boolean
language sql
security definer
stable
as $$
  select case
    when eu_papel() in ('superadmin', 'agencia') then true
    when eu_papel() in ('admin_cliente', 'comercial', 'visualizador') and eu_cliente() = cid then true
    else false
  end;
$$;

create or replace function trg_negociacao_regras_fn()
returns trigger as $$
declare
  ultima_compra_data date;
  dias_diff integer;
  hoje date := (now() at time zone 'America/Fortaleza')::date;
  cli_ativo boolean;
begin
  if tg_op = 'INSERT' then
    select ativo into cli_ativo from clientes where id = new.cliente_id;
    if cli_ativo is false then
      raise exception 'Não é permitido cadastrar negociação para um cliente pausado.';
    end if;
  end if;

  if new.status = 'Fechou' then
    if new.valor_fechado is null or new.valor_fechado <= 0 then
      raise exception 'Venda com status Fechou exige valor fechado maior que zero.';
    end if;
    if new.data_fechamento is null then
      new.data_fechamento := hoje;
    elsif new.data_fechamento > hoje then
      raise exception 'Data de fechamento não pode ser no futuro.';
    end if;
    new.motivo_perda := null;
  elsif new.status = 'Não fechou' then
    if new.motivo_perda is null then
      raise exception 'Negociação com status Não fechou exige motivo da perda.';
    end if;
    new.valor_fechado := 0;
    new.data_fechamento := null;
  else
    new.valor_fechado := 0;
    new.data_fechamento := null;
    new.motivo_perda := null;
  end if;

  select max(n.data_fechamento)
    into ultima_compra_data
    from negociacoes n
   where n.contato_id = new.contato_id
     and n.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     and n.status = 'Fechou'
     and n.data_fechamento is not null
     and n.data_fechamento < coalesce(new.data_fechamento, new.data_abertura);

  if ultima_compra_data is null then
    new.tipo_cliente := 'Novo';
  else
    dias_diff := coalesce(new.data_fechamento, new.data_abertura) - ultima_compra_data;
    if dias_diff > 180 then
      new.tipo_cliente := 'Reativação';
    else
      new.tipo_cliente := 'Recorrente';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_negociacoes_regras on negociacoes;
create trigger trg_negociacoes_regras
  before insert or update on negociacoes
  for each row execute function trg_negociacao_regras_fn();

-- RPCs
create or replace function salvar_negociacao(
  p_id uuid,
  p_cliente_id uuid,
  p_nome text,
  p_telefone text,
  p_bairro text,
  p_servico text,
  p_origem origem,
  p_responsavel_id uuid,
  p_status status_negociacao,
  p_valor_orcamento numeric,
  p_valor_fechado numeric,
  p_data_fechamento date,
  p_motivo_perda motivo_perda,
  p_observacoes text
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_contato_id uuid;
  v_negociacao_id uuid;
  v_hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  insert into contatos (cliente_id, nome, telefone, bairro)
  values (p_cliente_id, p_nome, p_telefone, coalesce(p_bairro, ''))
  on conflict (cliente_id, telefone_digitos)
  do update set
    nome = excluded.nome,
    bairro = case when excluded.bairro <> '' then excluded.bairro else contatos.bairro end,
    atualizado_em = now()
  returning id into v_contato_id;

  if p_id is not null then
    update negociacoes set
      contato_id = v_contato_id,
      servico = p_servico,
      origem = p_origem,
      responsavel_id = p_responsavel_id,
      status = p_status,
      valor_orcamento = coalesce(p_valor_orcamento, 0),
      valor_fechado = coalesce(p_valor_fechado, 0),
      data_fechamento = p_data_fechamento,
      motivo_perda = p_motivo_perda,
      observacoes = coalesce(p_observacoes, ''),
      ultima_interacao = v_hoje
    where id = p_id and cliente_id = p_cliente_id
    returning id into v_negociacao_id;

    insert into historico_negociacao (negociacao_id, data, texto, criado_por)
    values (v_negociacao_id, v_hoje, 'Negociação atualizada', auth.uid());
  else
    insert into negociacoes (
      cliente_id, contato_id, servico, origem, responsavel_id,
      status, valor_orcamento, valor_fechado, data_fechamento,
      motivo_perda, observacoes, data_abertura, ultima_interacao
    ) values (
      p_cliente_id, v_contato_id, p_servico, p_origem, p_responsavel_id,
      p_status, coalesce(p_valor_orcamento, 0), coalesce(p_valor_fechado, 0),
      p_data_fechamento, p_motivo_perda, coalesce(p_observacoes, ''),
      v_hoje, v_hoje
    ) returning id into v_negociacao_id;

    insert into historico_negociacao (negociacao_id, data, texto, criado_por)
    values (v_negociacao_id, v_hoje, case when p_status = 'Fechou' then 'Venda registrada' else 'Lead cadastrado' end, auth.uid());
  end if;

  return v_negociacao_id;
end;
$$;

create or replace function registrar_venda_direta(
  p_cliente_id uuid,
  p_nome text,
  p_telefone text,
  p_bairro text,
  p_servico text,
  p_origem origem,
  p_responsavel_id uuid,
  p_valor numeric,
  p_data date,
  p_observacoes text
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_contato_id uuid;
  v_negociacao_id uuid;
  v_hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  if p_data > v_hoje then
    raise exception 'Data da venda não pode ser no futuro.';
  end if;

  insert into contatos (cliente_id, nome, telefone, bairro)
  values (p_cliente_id, p_nome, p_telefone, coalesce(p_bairro, ''))
  on conflict (cliente_id, telefone_digitos)
  do update set
    nome = excluded.nome,
    bairro = case when excluded.bairro <> '' then excluded.bairro else contatos.bairro end,
    atualizado_em = now()
  returning id into v_contato_id;

  insert into negociacoes (
    cliente_id, contato_id, servico, origem, responsavel_id,
    status, valor_orcamento, valor_fechado, data_fechamento,
    data_abertura, ultima_interacao, observacoes
  ) values (
    p_cliente_id, v_contato_id, p_servico, p_origem, p_responsavel_id,
    'Fechou', 0, p_valor, p_data, p_data, p_data, coalesce(p_observacoes, '')
  ) returning id into v_negociacao_id;

  insert into historico_negociacao (negociacao_id, data, texto, criado_por)
  values (v_negociacao_id, p_data, 'Venda direta registrada', auth.uid());

  return v_negociacao_id;
end;
$$;

create or replace function mover_negociacao(
  p_id uuid,
  p_novo_status status_negociacao,
  p_valor_fechado numeric default null,
  p_data_fechamento date default null,
  p_motivo_perda motivo_perda default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  update negociacoes set
    status = p_novo_status,
    valor_fechado = case when p_novo_status = 'Fechou' then coalesce(p_valor_fechado, valor_fechado) else 0 end,
    data_fechamento = case when p_novo_status = 'Fechou' then coalesce(p_data_fechamento, v_hoje) else null end,
    motivo_perda = case when p_novo_status = 'Não fechou' then p_motivo_perda else null end,
    ultima_interacao = v_hoje
  where id = p_id;

  insert into historico_negociacao (negociacao_id, data, texto, criado_por)
  values (p_id, v_hoje, 'Status alterado para ' || p_novo_status, auth.uid());
end;
$$;

-- Trigger Auth Hook
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_papel text;
  raw_cliente_id text;
  raw_nome text;
begin
  raw_papel := new.raw_user_meta_data->>'papel';
  raw_cliente_id := new.raw_user_meta_data->>'cliente_id';
  raw_nome := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));

  insert into public.perfis (
    id, nome, email, papel, cliente_id, status
  ) values (
    new.id,
    raw_nome,
    new.email,
    coalesce(raw_papel::public.papel, 'comercial'::public.papel),
    case when raw_cliente_id is not null and raw_cliente_id <> '' then raw_cliente_id::uuid else null end,
    'ativo'
  )
  on conflict (id) do update set
    nome = excluded.nome,
    email = excluded.email;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. RLS e Políticas
alter table clientes enable row level security;
alter table comissao_config enable row level security;
alter table perfis enable row level security;
alter table contatos enable row level security;
alter table negociacoes enable row level security;
alter table historico_negociacao enable row level security;
alter table faturamento_mensal enable row level security;
alter table comissao_recebimento enable row level security;
alter table log_atividade enable row level security;

-- comissao_config (só superadmin)
drop policy if exists "superadmin_tudo_comissao_config" on comissao_config;
create policy "superadmin_tudo_comissao_config" on comissao_config for all to authenticated using (eh_superadmin()) with check (eh_superadmin());

-- clientes
drop policy if exists "clientes_select" on clientes;
create policy "clientes_select" on clientes for select to authenticated using (pode_acessar_cliente(id));
drop policy if exists "clientes_insert_superadmin" on clientes;
create policy "clientes_insert_superadmin" on clientes for insert to authenticated with check (eh_superadmin());
drop policy if exists "clientes_update_superadmin" on clientes;
create policy "clientes_update_superadmin" on clientes for update to authenticated using (eh_superadmin()) with check (eh_superadmin());

-- perfis
drop policy if exists "perfis_select" on perfis;
create policy "perfis_select" on perfis for select to authenticated using (
  eu_papel() in ('superadmin', 'agencia')
  or (cliente_id is not null and cliente_id = eu_cliente())
  or id = auth.uid()
);
drop policy if exists "perfis_update" on perfis;
create policy "perfis_update" on perfis for update to authenticated using (
  eh_superadmin()
  or (eu_papel() = 'agencia' and papel in ('admin_cliente', 'comercial', 'visualizador'))
  or (eu_papel() = 'admin_cliente' and cliente_id = eu_cliente() and papel in ('comercial', 'visualizador'))
  or id = auth.uid()
);

-- contatos
drop policy if exists "contatos_select" on contatos;
create policy "contatos_select" on contatos for select to authenticated using (pode_acessar_cliente(cliente_id));
drop policy if exists "contatos_insert" on contatos;
create policy "contatos_insert" on contatos for insert to authenticated with check (
  pode_acessar_cliente(cliente_id) and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
);
drop policy if exists "contatos_update" on contatos;
create policy "contatos_update" on contatos for update to authenticated using (
  pode_acessar_cliente(cliente_id) and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
);
drop policy if exists "contatos_delete" on contatos;
create policy "contatos_delete" on contatos for delete to authenticated using (
  pode_acessar_cliente(cliente_id) and eu_papel() in ('superadmin', 'agencia', 'admin_cliente')
);

-- negociacoes
drop policy if exists "negociacoes_select" on negociacoes;
create policy "negociacoes_select" on negociacoes for select to authenticated using (pode_acessar_cliente(cliente_id));
drop policy if exists "negociacoes_insert" on negociacoes;
create policy "negociacoes_insert" on negociacoes for insert to authenticated with check (
  pode_acessar_cliente(cliente_id) and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
);
drop policy if exists "negociacoes_update" on negociacoes;
create policy "negociacoes_update" on negociacoes for update to authenticated using (
  pode_acessar_cliente(cliente_id) and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
);
drop policy if exists "negociacoes_delete" on negociacoes;
create policy "negociacoes_delete" on negociacoes for delete to authenticated using (
  pode_acessar_cliente(cliente_id) and eu_papel() in ('superadmin', 'agencia', 'admin_cliente')
);

-- historico_negociacao
drop policy if exists "historico_select" on historico_negociacao;
create policy "historico_select" on historico_negociacao for select to authenticated using (
  exists (select 1 from negociacoes n where n.id = negociacao_id and pode_acessar_cliente(n.cliente_id))
);
drop policy if exists "historico_insert" on historico_negociacao;
create policy "historico_insert" on historico_negociacao for insert to authenticated with check (
  exists (select 1 from negociacoes n where n.id = negociacao_id and pode_acessar_cliente(n.cliente_id) and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial'))
);
