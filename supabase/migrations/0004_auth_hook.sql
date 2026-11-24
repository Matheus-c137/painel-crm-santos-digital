-- ==============================================================================
-- 0004_auth_hook.sql
-- Trigger para vincular novos usuários em auth.users à tabela perfis
-- ==============================================================================

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
    id,
    nome,
    email,
    papel,
    cliente_id,
    status
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

-- Remove se já existir
drop trigger if exists on_auth_user_created on auth.users;

-- Cria trigger em auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
