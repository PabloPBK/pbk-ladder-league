begin;

create table public.zz2_contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  sender_name text not null check (char_length(sender_name) between 1 and 100),
  sender_email text not null check (char_length(sender_email) between 1 and 254),
  topic text not null check (char_length(topic) between 1 and 50),
  message text not null check (char_length(message) between 1 and 3000),
  rate_key text not null check (rate_key ~ '^[0-9a-f]{64}$')
);
create index zz2_contact_inquiries_received_idx on public.zz2_contact_inquiries (received_at desc, id desc);
create index zz2_contact_inquiries_rate_idx on public.zz2_contact_inquiries (rate_key, received_at desc);

create table public.zz2_contact_readers (
  user_id uuid primary key references public.staff_users(user_id) on delete cascade
);

alter table public.zz2_contact_inquiries enable row level security;
alter table public.zz2_contact_readers enable row level security;
revoke all on public.zz2_contact_inquiries, public.zz2_contact_readers from public, anon, authenticated, service_role;
grant select on public.zz2_contact_inquiries, public.zz2_contact_readers to service_role;
grant insert on public.zz2_contact_inquiries to service_role;

create function public.submit_zz2_contact_inquiry(
  sender_name text, sender_email text, topic text, message text, rate_key text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(rate_key, 0));
  if (
    select count(*) from public.zz2_contact_inquiries i
    where i.rate_key = submit_zz2_contact_inquiry.rate_key and i.received_at >= now() - interval '1 hour'
  ) >= 6 then
    return false;
  end if;
  insert into public.zz2_contact_inquiries(sender_name, sender_email, topic, message, rate_key)
  values (sender_name, sender_email, topic, message, rate_key);
  return true;
end
$$;
revoke all on function public.submit_zz2_contact_inquiry(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_zz2_contact_inquiry(text, text, text, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
