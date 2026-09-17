-- Repair profiles for existing Auth users and allow checkout to self-heal missing rows.
-- Run this once in the Supabase SQL Editor.

insert into public.profiles (id, full_name, avatar_url)
select
  id,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can create own profile'
  ) then
    create policy "Users can create own profile"
      on public.profiles
      for insert
      with check (auth.uid() = id);
  end if;
end
$$;
