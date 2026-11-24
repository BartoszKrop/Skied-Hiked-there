-- Znajomi (prośby i akceptacja), zaproszenia do wyjazdów, powiadomienia, konta prywatne.
-- Uruchom raz w Supabase: SQL Editor -> New query -> wklej całość -> Run.
-- Wymaga wcześniejszych plików: trips.sql, trips2.sql (shared_trips, my_username, join_trip).
-- Bezpieczne do ponownego uruchomienia.

---------------------------------------------------------------- znajomi
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_uid uuid not null references auth.users(id) on delete cascade,
  from_name text not null,
  to_name text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_name, to_name)
);
alter table public.friend_requests enable row level security;
drop policy if exists fr_select on public.friend_requests;
create policy fr_select on public.friend_requests for select to authenticated
  using (from_uid = auth.uid() or lower(to_name) = lower(coalesce(public.my_username(), '')));

---------------------------------------------------------------- zaproszenia do wyjazdów
create table if not exists public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.shared_trips(id) on delete cascade,
  trip_name text not null default '',
  from_name text not null,
  to_name text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (trip_id, to_name)
);
alter table public.trip_invites enable row level security;
drop policy if exists ti_select on public.trip_invites;
create policy ti_select on public.trip_invites for select to authenticated
  using (lower(to_name) = lower(coalesce(public.my_username(), '')) or lower(from_name) = lower(coalesce(public.my_username(), '')));

---------------------------------------------------------------- powiadomienia
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  ref text,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists n_select on public.notifications;
create policy n_select on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists n_update on public.notifications;
create policy n_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists n_delete on public.notifications;
create policy n_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- Powiadomienia na żywo (jeśli publikacja realtime istnieje)
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; end $$;

-- wewnętrzne: dodaj powiadomienie (jeśli jest już nieprzeczytane takie samo, tylko je odśwież)
create or replace function public._notify(uid uuid, k text, r text, t text) returns void
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if uid is null then return; end if;
  select id into nid from public.notifications where user_id = uid and kind = k and ref is not distinct from r and not read order by created_at desc limit 1;
  if nid is not null then update public.notifications set text = t, created_at = now() where id = nid;
  else insert into public.notifications (user_id, kind, ref, text) values (uid, k, r, t); end if;
end $$;
revoke all on function public._notify(uuid, text, text, text) from public, anon, authenticated;

create or replace function public._uid_of(uname text) returns uuid
language sql security definer set search_path = public as $$
  select user_id from public.profiles where lower(username) = lower(uname) limit 1
$$;
revoke all on function public._uid_of(text) from public, anon, authenticated;

create or replace function public._is_friend(a text, b text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.friend_requests where status = 'accepted'
    and ((lower(from_name) = lower(a) and lower(to_name) = lower(b)) or (lower(from_name) = lower(b) and lower(to_name) = lower(a))))
$$;
revoke all on function public._is_friend(text, text) from public, anon, authenticated;

---------------------------------------------------------------- RPC: znajomi
create or replace function public.find_users(q text) returns table (username text, is_public boolean)
language sql security definer set search_path = public as $$
  select p.username, coalesce(p.is_public, true) from public.profiles p
  where length(trim(q)) >= 2 and p.username is not null and p.username <> ''
    and lower(p.username) like lower(trim(q)) || '%' and lower(p.username) <> lower(coalesce(public.my_username(), ''))
  order by p.username limit 10
$$;
grant execute on function public.find_users(text) to authenticated;

create or replace function public.send_friend_request(uname text) returns text
language plpgsql security definer set search_path = public as $$
declare me text := public.my_username(); u text := lower(trim(uname)); tgt uuid := public._uid_of(u); rid uuid;
begin
  if me is null or me = '' then raise exception 'set username first'; end if;
  if tgt is null then raise exception 'user not found'; end if;
  if u = lower(me) then raise exception 'that is you'; end if;
  if public._is_friend(me, u) then return 'already'; end if;
  -- druga strona już zaprosiła: od razu akceptuj
  select id into rid from public.friend_requests where lower(from_name) = u and lower(to_name) = lower(me) and status = 'pending';
  if rid is not null then
    update public.friend_requests set status = 'accepted', updated_at = now() where id = rid;
    perform public._notify(tgt, 'friend_ok', lower(me), '@' || me || ' przyjął(-ęła) Twoje zaproszenie do znajomych');
    return 'accepted';
  end if;
  insert into public.friend_requests (from_uid, from_name, to_name, status) values (auth.uid(), lower(me), u, 'pending')
    on conflict (from_name, to_name) do update set status = 'pending', updated_at = now(), created_at = now();
  perform public._notify(tgt, 'friend_req', lower(me), '@' || me || ' zaprasza Cię do znajomych');
  return 'sent';
end $$;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.respond_friend_request(rid uuid, acc boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_username(); r public.friend_requests;
begin
  select * into r from public.friend_requests where id = rid and lower(to_name) = lower(me) and status = 'pending';
  if not found then raise exception 'no such request'; end if;
  update public.friend_requests set status = case when acc then 'accepted' else 'declined' end, updated_at = now() where id = rid;
  update public.notifications set read = true where user_id = auth.uid() and kind = 'friend_req' and ref = lower(r.from_name);
  if acc then perform public._notify(r.from_uid, 'friend_ok', lower(me), '@' || me || ' przyjął(-ęła) Twoje zaproszenie do znajomych'); end if;
end $$;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- usuwa znajomego albo anuluje wysłane zaproszenie
create or replace function public.remove_friend(uname text) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_username(); u text := lower(trim(uname));
begin
  delete from public.friend_requests where
    (status = 'accepted' and ((lower(from_name) = lower(me) and to_name = u) or (from_name = u and lower(to_name) = lower(me))))
    or (status = 'pending' and lower(from_name) = lower(me) and to_name = u);
end $$;
grant execute on function public.remove_friend(text) to authenticated;

-- Profil do podglądu: publiczny dla wszystkich, prywatny tylko dla zaakceptowanych znajomych (ci widzą też notatki)
create or replace function public.get_friend_profile(uname text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := public.my_username(); p public.profiles;
begin
  select * into p from public.profiles where lower(username) = lower(trim(uname)) limit 1;
  if not found then return null; end if;
  if me is not null and lower(me) <> lower(p.username) and public._is_friend(me, p.username) then
    return jsonb_build_object('username', p.username, 'visits', coalesce(p.data -> 'visits', '{}'::jsonb), 'hvisits', coalesce(p.data -> 'hvisits', '{}'::jsonb));
  end if;
  if me is not null and lower(me) = lower(p.username) then
    return jsonb_build_object('username', p.username, 'visits', coalesce(p.data -> 'visits', '{}'::jsonb), 'hvisits', coalesce(p.data -> 'hvisits', '{}'::jsonb));
  end if;
  if coalesce(p.is_public, true) then return public.get_public_profile(p.username); end if;
  return null;
end $$;
grant execute on function public.get_friend_profile(text) to anon, authenticated;

---------------------------------------------------------------- RPC: zaproszenia do wyjazdów
create or replace function public.invite_to_trip(tid uuid, uname text) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_username(); u text := lower(trim(uname)); t public.shared_trips; tgt uuid := public._uid_of(u); iid uuid; nm text;
begin
  select * into t from public.shared_trips where id = tid and owner = auth.uid();
  if not found then raise exception 'only owner invites'; end if;
  if tgt is null then raise exception 'user not found'; end if;
  if u = lower(coalesce(me, '')) or tgt = t.owner then raise exception 'that is you'; end if;
  if u = any (select lower(x) from unnest(t.members) x) then raise exception 'already member'; end if;
  nm := coalesce(nullif(t.data ->> 'name', ''), 'Wyjazd');
  insert into public.trip_invites (trip_id, trip_name, from_name, to_name, status) values (tid, nm, lower(me), u, 'pending')
    on conflict (trip_id, to_name) do update set status = 'pending', trip_name = excluded.trip_name, created_at = now()
    returning id into iid;
  perform public._notify(tgt, 'trip_inv', iid::text, '@' || me || ' zaprasza Cię do wyjazdu „' || nm || '”');
end $$;
grant execute on function public.invite_to_trip(uuid, text) to authenticated;

create or replace function public.respond_trip_invite(iid uuid, acc boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.my_username(); i public.trip_invites; ow uuid;
begin
  select * into i from public.trip_invites where id = iid and lower(to_name) = lower(me) and status = 'pending';
  if not found then raise exception 'no such invite'; end if;
  select owner into ow from public.shared_trips where id = i.trip_id;
  if acc then
    perform set_config('app.join', '1', true);
    update public.shared_trips set members = case when lower(me) = any (select lower(x) from unnest(members) x) or owner = auth.uid() then members else array_append(members, me) end where id = i.trip_id;
  end if;
  update public.trip_invites set status = case when acc then 'accepted' else 'declined' end where id = iid;
  update public.notifications set read = true where user_id = auth.uid() and kind = 'trip_inv' and ref = iid::text;
  perform public._notify(ow, case when acc then 'trip_ok' else 'trip_no' end, i.trip_id::text,
    '@' || me || case when acc then ' dołączył(a) do wyjazdu „' else ' odrzucił(a) zaproszenie do wyjazdu „' end || i.trip_name || '”');
end $$;
grant execute on function public.respond_trip_invite(uuid, boolean) to authenticated;

create or replace function public.cancel_trip_invite(iid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.trip_invites where id = iid and lower(from_name) = lower(coalesce(public.my_username(), ''));
end $$;
grant execute on function public.cancel_trip_invite(uuid) to authenticated;

---------------------------------------------------------------- zmiany we wspólnym wyjeździe -> powiadomienia
create or replace function public._trip_counts(d jsonb, out items int, out comments int, out costs int) language sql immutable as $$
  select coalesce(jsonb_array_length(d -> 'items'), 0),
         coalesce((select sum(coalesce(jsonb_array_length(e -> 'cm'), 0))::int from jsonb_array_elements(coalesce(d -> 'items', '[]'::jsonb)) e), 0),
         coalesce(jsonb_array_length(d -> 'costs'), 0)
$$;

create or replace function public.trips_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := coalesce(public.my_username(), '?'); o record; n record; k text; msg text; nm text; m text; mu uuid;
begin
  if new.data is not distinct from old.data then return new; end if;
  select * into o from public._trip_counts(old.data);
  select * into n from public._trip_counts(new.data);
  nm := coalesce(nullif(new.data ->> 'name', ''), 'Wyjazd');
  if n.comments > o.comments then k := 'trip_comment'; msg := '@' || me || ' skomentował(a) w wyjeździe „' || nm || '”';
  elsif n.items > o.items then k := 'trip_item'; msg := '@' || me || ' dodał(a) szlak do wyjazdu „' || nm || '”';
  elsif n.costs > o.costs then k := 'trip_cost'; msg := '@' || me || ' dodał(a) wydatek w wyjeździe „' || nm || '”';
  else k := 'trip_edit'; msg := '@' || me || ' zmienił(a) wyjazd „' || nm || '”'; end if;
  if new.owner <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then perform public._notify(new.owner, k, new.id::text, msg); end if;
  foreach m in array coalesce(new.members, '{}') loop
    mu := public._uid_of(m);
    if mu is not null and mu <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then perform public._notify(mu, k, new.id::text, msg); end if;
  end loop;
  return new;
end $$;
drop trigger if exists trips_notify_trg on public.shared_trips;
create trigger trips_notify_trg after update on public.shared_trips for each row execute function public.trips_notify();
