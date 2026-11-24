-- ==============================================================================
-- 0002_funcoes_triggers.sql
-- Funções de segurança, triggers de integridade de regras de negócio e logs
-- ==============================================================================

-- 1. Funções de auxílio de identidade e permissão (SECURITY DEFINER)
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

-- 2. Trigger para atualizar updated_at automaticamente
create or replace function set_updated_at()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_clientes_updated_at
  before update on clientes
  for each row execute function set_updated_at();

create trigger trg_perfis_updated_at
  before update on perfis
  for each row execute function set_updated_at();

create trigger trg_contatos_updated_at
  before update on contatos
  for each row execute function set_updated_at();

create trigger trg_negociacoes_updated_at
  before update on negociacoes
  for each row execute function set_updated_at();

-- 3. Cálculo do tipo de cliente e validações estritas de status
-- Novo: nenhuma compra anterior
-- Recorrente: comprou há até 180 dias
-- Reativação: comprou há mais de 180 dias
create or replace function trg_negociacao_regras_fn()
returns trigger as $$
declare
  ultima_compra_data date;
  dias_diff integer;
  hoje date := (now() at time zone 'America/Fortaleza')::date;
  cli_ativo boolean;
begin
  -- Checar se cliente está ativo no INSERT
  if tg_op = 'INSERT' then
    select ativo into cli_ativo from clientes where id = new.cliente_id;
    if cli_ativo is false then
      raise exception 'Não é permitido cadastrar negociação para um cliente pausado.';
    end if;
  end if;

  -- Regras estritas de status
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
    -- Novo, Orçamento, Negociando
    new.valor_fechado := 0;
    new.data_fechamento := null;
    new.motivo_perda := null;
  end if;

  -- Calcular tipo_cliente
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

create trigger trg_negociacoes_regras
  before insert or update on negociacoes
  for each row execute function trg_negociacao_regras_fn();

-- 4. Triggers de Log de Atividade
create or replace function trg_log_negociacao_fn()
returns trigger as $$
declare
  contato_nome text;
begin
  select nome into contato_nome from contatos where id = new.contato_id;
  contato_nome := coalesce(contato_nome, 'Contato');

  if tg_op = 'INSERT' then
    if new.status = 'Fechou' then
      insert into log_atividade (cliente_id, usuario_id, texto)
      values (new.cliente_id, auth.uid(), 'registrou a venda direta de <b>' || contato_nome || '</b> (R$ ' || to_char(new.valor_fechado, 'FM999G999G990D00') || ')');
    else
      insert into log_atividade (cliente_id, usuario_id, texto)
      values (new.cliente_id, auth.uid(), 'cadastrou o lead <b>' || contato_nome || '</b>');
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status <> new.status then
      if new.status = 'Fechou' then
        insert into log_atividade (cliente_id, usuario_id, texto)
        values (new.cliente_id, auth.uid(), 'fechou a venda de <b>' || contato_nome || '</b> (R$ ' || to_char(new.valor_fechado, 'FM999G999G990D00') || ')');
      else
        insert into log_atividade (cliente_id, usuario_id, texto)
        values (new.cliente_id, auth.uid(), 'moveu <b>' || contato_nome || '</b> para ' || new.status);
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_log_negociacao
  after insert or update on negociacoes
  for each row execute function trg_log_negociacao_fn();

create or replace function trg_log_cliente_fn()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into log_atividade (cliente_id, usuario_id, texto)
    values (new.id, auth.uid(), 'criou o cliente <b>' || new.nome || '</b>');
  elsif tg_op = 'UPDATE' then
    if old.ativo <> new.ativo then
      insert into log_atividade (cliente_id, usuario_id, texto)
      values (new.id, auth.uid(), case when new.ativo then 'reativou o cliente <b>' else 'pausou o cliente <b>' end || new.nome || '</b>');
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_log_cliente
  after insert or update on clientes
  for each row execute function trg_log_cliente_fn();

-- 5. RPCs atômicas (Security Invoker para honrar RLS e garantir transação única)

-- 5.1 Salvar Negociação (Lead ou Edição) com deduplicação de contato
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
  v_digitos text;
  v_hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  v_digitos := regexp_replace(p_telefone, '\D', '', 'g');

  -- Upsert no contato pelo cliente + dígitos
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
      cliente_id,
      contato_id,
      servico,
      origem,
      responsavel_id,
      status,
      valor_orcamento,
      valor_fechado,
      data_fechamento,
      motivo_perda,
      observacoes,
      data_abertura,
      ultima_interacao
    ) values (
      p_cliente_id,
      v_contato_id,
      p_servico,
      p_origem,
      p_responsavel_id,
      p_status,
      coalesce(p_valor_orcamento, 0),
      coalesce(p_valor_fechado, 0),
      p_data_fechamento,
      p_motivo_perda,
      coalesce(p_observacoes, ''),
      v_hoje,
      v_hoje
    ) returning id into v_negociacao_id;

    insert into historico_negociacao (negociacao_id, data, texto, criado_por)
    values (v_negociacao_id, v_hoje, case when p_status = 'Fechou' then 'Venda registrada' else 'Lead cadastrado' end, auth.uid());
  end if;

  return v_negociacao_id;
end;
$$;

-- 5.2 Registrar Venda Direta
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

  -- Upsert contato
  insert into contatos (cliente_id, nome, telefone, bairro)
  values (p_cliente_id, p_nome, p_telefone, coalesce(p_bairro, ''))
  on conflict (cliente_id, telefone_digitos)
  do update set
    nome = excluded.nome,
    bairro = case when excluded.bairro <> '' then excluded.bairro else contatos.bairro end,
    atualizado_em = now()
  returning id into v_contato_id;

  insert into negociacoes (
    cliente_id,
    contato_id,
    servico,
    origem,
    responsavel_id,
    status,
    valor_orcamento,
    valor_fechado,
    data_fechamento,
    data_abertura,
    ultima_interacao,
    observacoes
  ) values (
    p_cliente_id,
    v_contato_id,
    p_servico,
    p_origem,
    p_responsavel_id,
    'Fechou',
    0,
    p_valor,
    p_data,
    p_data,
    p_data,
    coalesce(p_observacoes, '')
  ) returning id into v_negociacao_id;

  insert into historico_negociacao (negociacao_id, data, texto, criado_por)
  values (v_negociacao_id, p_data, 'Venda direta registrada', auth.uid());

  return v_negociacao_id;
end;
$$;

-- 5.3 Mover negociação (Kanban Drag and Drop)
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

-- 5.4 Registrar Contato ou Anotação
create or replace function registrar_contato_lead(
  p_negociacao_id uuid,
  p_texto text default 'Contato registrado'
)
returns void
language plpgsql
security invoker
as $$
declare
  v_hoje date := (now() at time zone 'America/Fortaleza')::date;
  v_cli uuid;
  v_nome text;
begin
  update negociacoes set
    ultima_interacao = v_hoje
  where id = p_negociacao_id
  returning cliente_id into v_cli;

  insert into historico_negociacao (negociacao_id, data, texto, criado_por)
  values (p_negociacao_id, v_hoje, p_texto, auth.uid());

  select c.nome into v_nome
    from contatos c
    join negociacoes n on n.contato_id = c.id
   where n.id = p_negociacao_id;

  insert into log_atividade (cliente_id, usuario_id, texto)
  values (v_cli, auth.uid(), 'registrou contato com <b>' || coalesce(v_nome, 'cliente') || '</b>');
end;
$$;
