-- handle_new_user() нужна только триггеру на auth.users, вызывать её через API незачем
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Роль, под которой Supabase Auth создаёт пользователей. Через публичный API эта роль недоступна.
grant execute on function public.handle_new_user() to supabase_auth_admin;
