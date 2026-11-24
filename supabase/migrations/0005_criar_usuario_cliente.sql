-- ==============================================================================
-- 0005_criar_usuario_cliente.sql
-- RPC para Superadmin/Agência criar diretamente o login de um usuário de cliente
-- ==============================================================================

-- 1. Garantir a extensão de criptografia pgcrypto
create extension if not exists "pgcrypto";

-- 2. Recriar a função apontando para extensions.crypt e extensions.gen_salt
create or replace function public.criar_usuario_cliente(
  p_nome text,
  p_email text,
  p_password text,
  p_papel papel,
  p_cliente_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_caller_role papel;
begin
  -- 1. Validar quem está chamando a função
  v_caller_role := eu_papel();
  if v_caller_role not in ('superadmin', 'agencia') then
    raise exception 'Apenas a agência ou o superadmin podem criar logins de clientes.';
  end if;

  -- 2. Validar que o papel atribuído seja de cliente
  if p_papel not in ('admin_cliente', 'comercial', 'visualizador') then
    raise exception 'O usuário criado precisa ter papel de cliente (admin_cliente, comercial ou visualizador).';
  end if;

  -- 3. Validar se o cliente existe
  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente informado não existe.';
  end if;

  -- 4. Criar o usuário diretamente na tabela auth.users com senha criptografada
  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('nome', p_nome, 'papel', p_papel, 'cliente_id', p_cliente_id),
    now(),
    now()
  );

  -- 5. Inserir ou atualizar na tabela public.perfis
  insert into public.perfis (
    id,
    nome,
    email,
    papel,
    cliente_id,
    status
  ) values (
    v_user_id,
    p_nome,
    lower(trim(p_email)),
    p_papel,
    p_cliente_id,
    'ativo'
  )
  on conflict (id) do update set
    nome = excluded.nome,
    email = excluded.email,
    papel = excluded.papel,
    cliente_id = excluded.cliente_id,
    status = 'ativo';

  -- 6. Registrar no log de auditoria
  insert into public.log_atividade (cliente_id, usuario_id, texto)
  values (
    p_cliente_id,
    auth.uid(),
    'criou o login de acesso para <b>' || p_nome || '</b> (' || lower(trim(p_email)) || ') como ' || p_papel
  );

  return v_user_id;
end;
$$;
