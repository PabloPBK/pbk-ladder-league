begin;

create table public.league_revenue_admins (
  user_id uuid primary key references public.staff_users(user_id) on delete cascade
);

alter table public.league_revenue_admins enable row level security;
revoke all on table public.league_revenue_admins from public, anon, authenticated, service_role;
grant select on table public.league_revenue_admins to service_role;

insert into public.league_revenue_admins (user_id)
select user_id
from public.staff_users
where user_id = 'e010b6b8-144f-4b27-8c98-4b4a2900b360';

notify pgrst, 'reload schema';

commit;
