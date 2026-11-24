-- ==============================================================================
-- seed_superadmin.sql
-- Promove um usuário cadastrado via Supabase Auth a Superadmin
-- ==============================================================================

-- Substitua 'SEU_EMAIL_AQUI' pelo e-mail com o qual você se cadastrou
do $$
declare
  v_user_id uuid;
  v_email text := 'matheus@santosdigital.com.br'; -- altere se necessário
begin
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is not null then
    update public.perfis
       set papel = 'superadmin',
           cliente_id = null,
           status = 'ativo',
           nome = 'Matheus Santos'
     where id = v_user_id;

    raise notice 'Usuário % promovido a superadmin com sucesso!', v_email;
  else
    raise notice 'Usuário com e-mail % ainda não existe no auth.users.', v_email;
  end if;
end $$;
