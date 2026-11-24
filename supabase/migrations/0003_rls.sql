-- ==============================================================================
-- 0003_rls.sql
-- Habilitação de RLS e políticas de acesso por tabela e papel
-- ==============================================================================

-- 1. Habilitar RLS em todas as tabelas
alter table clientes enable row level security;
alter table comissao_config enable row level security;
alter table perfis enable row level security;
alter table contatos enable row level security;
alter table negociacoes enable row level security;
alter table historico_negociacao enable row level security;
alter table faturamento_mensal enable row level security;
alter table comissao_recebimento enable row level security;
alter table log_atividade enable row level security;

-- ==============================================================================
-- 2. Políticas: comissao_config (EXCLUSIVA SUPERADMIN - Ninguém mais lê/escreve)
-- ==============================================================================
create policy "superadmin_tudo_comissao_config"
  on comissao_config
  for all
  to authenticated
  using (eh_superadmin())
  with check (eh_superadmin());

-- ==============================================================================
-- 3. Políticas: comissao_recebimento (EXCLUSIVA SUPERADMIN)
-- ==============================================================================
create policy "superadmin_tudo_comissao_recebimento"
  on comissao_recebimento
  for all
  to authenticated
  using (eh_superadmin())
  with check (eh_superadmin());

-- ==============================================================================
-- 4. Políticas: clientes
-- Leitura: superadmin e agencia veem todos; usuarios de cliente veem o seu
-- Escrita: superadmin cria, edita, pausa/reativa
-- ==============================================================================
create policy "clientes_select"
  on clientes
  for select
  to authenticated
  using (pode_acessar_cliente(id));

create policy "clientes_insert_superadmin"
  on clientes
  for insert
  to authenticated
  with check (eh_superadmin());

create policy "clientes_update_superadmin"
  on clientes
  for update
  to authenticated
  using (eh_superadmin())
  with check (eh_superadmin());

-- ==============================================================================
-- 5. Políticas: perfis
-- Leitura: superadmin e agencia veem todos; admin_cliente, comercial, visualizador veem do mesmo cliente
-- Atualização: usuário pode atualizar seu próprio perfil básico; superadmin/agencia/admin gerenciam seus escopos
-- ==============================================================================
create policy "perfis_select"
  on perfis
  for select
  to authenticated
  using (
    eu_papel() in ('superadmin', 'agencia')
    or (cliente_id is not null and cliente_id = eu_cliente())
    or id = auth.uid()
  );

create policy "perfis_update"
  on perfis
  for update
  to authenticated
  using (
    eh_superadmin()
    or (eu_papel() = 'agencia' and papel in ('admin_cliente', 'comercial', 'visualizador'))
    or (eu_papel() = 'admin_cliente' and cliente_id = eu_cliente() and papel in ('comercial', 'visualizador'))
    or id = auth.uid()
  );

-- Prevenir elevação de privilégios via trigger em perfis
create or replace function trg_perfis_protecao_fn()
returns trigger as $$
begin
  -- Se não for superadmin, não pode alterar papel para superadmin nem agencia
  if not eh_superadmin() then
    if new.papel in ('superadmin', 'agencia') and old.papel not in ('superadmin', 'agencia') then
      raise exception 'Apenas superadmin pode conceder papéis de agência/superadmin.';
    end if;
    if old.id = auth.uid() and old.papel <> new.papel then
      raise exception 'Não é permitido alterar o próprio papel.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_perfis_protecao
  before update on perfis
  for each row execute function trg_perfis_protecao_fn();

-- ==============================================================================
-- 6. Políticas: contatos
-- ==============================================================================
create policy "contatos_select"
  on contatos
  for select
  to authenticated
  using (pode_acessar_cliente(cliente_id));

create policy "contatos_insert"
  on contatos
  for insert
  to authenticated
  with check (
    pode_acessar_cliente(cliente_id)
    and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
    and exists (select 1 from clientes c where c.id = cliente_id and c.ativo = true)
  );

create policy "contatos_update"
  on contatos
  for update
  to authenticated
  using (
    pode_acessar_cliente(cliente_id)
    and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
  );

create policy "contatos_delete"
  on contatos
  for delete
  to authenticated
  using (
    pode_acessar_cliente(cliente_id)
    and eu_papel() in ('superadmin', 'agencia', 'admin_cliente')
  );

-- ==============================================================================
-- 7. Políticas: negociacoes
-- ==============================================================================
create policy "negociacoes_select"
  on negociacoes
  for select
  to authenticated
  using (pode_acessar_cliente(cliente_id));

create policy "negociacoes_insert"
  on negociacoes
  for insert
  to authenticated
  with check (
    pode_acessar_cliente(cliente_id)
    and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
    and exists (select 1 from clientes c where c.id = cliente_id and c.ativo = true)
  );

create policy "negociacoes_update"
  on negociacoes
  for update
  to authenticated
  using (
    pode_acessar_cliente(cliente_id)
    and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
  );

create policy "negociacoes_delete"
  on negociacoes
  for delete
  to authenticated
  using (
    pode_acessar_cliente(cliente_id)
    and eu_papel() in ('superadmin', 'agencia', 'admin_cliente')
  );

-- ==============================================================================
-- 8. Políticas: historico_negociacao
-- ==============================================================================
create policy "historico_select"
  on historico_negociacao
  for select
  to authenticated
  using (
    exists (
      select 1 from negociacoes n
      where n.id = negociacao_id
      and pode_acessar_cliente(n.cliente_id)
    )
  );

create policy "historico_insert"
  on historico_negociacao
  for insert
  to authenticated
  with check (
    exists (
      select 1 from negociacoes n
      where n.id = negociacao_id
      and pode_acessar_cliente(n.cliente_id)
      and eu_papel() in ('superadmin', 'agencia', 'admin_cliente', 'comercial')
    )
  );

-- ==============================================================================
-- 9. Políticas: faturamento_mensal
-- ==============================================================================
create policy "faturamento_select"
  on faturamento_mensal
  for select
  to authenticated
  using (pode_acessar_cliente(cliente_id));

create policy "faturamento_insert_update"
  on faturamento_mensal
  for all
  to authenticated
  using (
    pode_acessar_cliente(cliente_id)
    and eu_papel() in ('superadmin', 'agencia', 'admin_cliente')
  )
  with check (
    pode_acessar_cliente(cliente_id)
    and eu_papel() in ('superadmin', 'agencia', 'admin_cliente')
  );

-- ==============================================================================
-- 10. Políticas: log_atividade
-- ==============================================================================
create policy "log_atividade_select"
  on log_atividade
  for select
  to authenticated
  using (
    (cliente_id is not null and pode_acessar_cliente(cliente_id))
    or (cliente_id is null and eu_papel() in ('superadmin', 'agencia'))
  );
