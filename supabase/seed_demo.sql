-- ==============================================================================
-- seed_demo.sql
-- Clientes de demonstração baseados no protótipo (Goodfilm e Studio Shark)
-- ==============================================================================

do $$
declare
  v_goodfilm_id uuid;
  v_shark_id uuid;
  v_contato_ana uuid;
  v_contato_carlos uuid;
begin
  -- 1. Inserir Goodfilm
  insert into clientes (nome, segmento, ativo, servicos, investimento_mensal, meta_mensal)
  values (
    'Goodfilm',
    'Películas arquitetônicas',
    true,
    array['Película térmica', 'Película de privacidade', 'Película inteligente', 'PPF residencial', 'Película de segurança'],
    3800.00,
    32000.00
  )
  returning id into v_goodfilm_id;

  -- Comissão de 1% (exclusivo superadmin)
  insert into comissao_config (cliente_id, percentual)
  values (v_goodfilm_id, 1.00);

  -- 2. Inserir Studio Shark
  insert into clientes (nome, segmento, ativo, servicos, investimento_mensal, meta_mensal)
  values (
    'Studio Shark',
    'Películas automotivas e residenciais',
    true,
    array['Película automotiva', 'Película residencial', 'PPF'],
    1350.00,
    9000.00
  )
  returning id into v_shark_id;

  insert into comissao_config (cliente_id, percentual)
  values (v_shark_id, 1.00);

  -- 3. Contatos de teste para Goodfilm
  insert into contatos (cliente_id, nome, telefone, bairro)
  values (v_goodfilm_id, 'Ana Cavalcante', '(85) 98877-6655', 'Aldeota')
  returning id into v_contato_ana;

  insert into contatos (cliente_id, nome, telefone, bairro)
  values (v_goodfilm_id, 'Carlos Gomes', '(85) 99122-3344', 'Meireles')
  returning id into v_contato_carlos;

  -- 4. Leads de teste para o Pipeline da Goodfilm
  insert into negociacoes (
    cliente_id, contato_id, servico, origem, status,
    valor_orcamento, valor_fechado, data_abertura, ultima_interacao
  ) values
  (v_goodfilm_id, v_contato_ana, 'Película térmica', 'Google Ads', 'Novo', 1400.00, 0, current_date, current_date),
  (v_goodfilm_id, v_contato_carlos, 'Película de privacidade', 'Instagram', 'Orçamento', 2350.00, 0, current_date - 1, current_date - 1);

  insert into historico_negociacao (negociacao_id, data, texto)
  select id, current_date, 'Lead cadastrado no sistema' from negociacoes where cliente_id = v_goodfilm_id;

  raise notice 'Dados de demonstração inseridos com sucesso!';
end $$;
