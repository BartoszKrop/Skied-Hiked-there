-- Model "obserwowanie": publiczne konto obserwujesz od razu, prywatne po akceptacji właściciela.
-- Uruchom po social.sql. Bezpieczne do ponownego uruchomienia.
-- friend_requests: from_name = obserwujący, to_name = obserwowany; status accepted = obserwuje, pending = prośba.

create or replace function public._follows(a text, b text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.friend_requests where status = 'accepted' and lower(from_name) = lower(a) and lower(to_name) = lower(b))
$$;
revoke all on function public._follows(text, text) from public, anon, authenticated;

create or replace function public.send_friend_request(uname text) returns text
language plpgsql security definer set search_path = public as $$
declare me text := public.my_username(); u text := lower(trim(uname)); tgt uuid := public._uid_of(u); pub boolean;
begin
  if me is null or me = '' then raise exception 'set username first'; end if;
  if tgt is null then raise exception 'user not found'; end if;
  if u = lower(me) then raise exception 'that is you'; end if;
  if public._follows(me, u) then return 'already'; end if;
  select coalesce(is_public, true) into pub from public.profiles where user_id = tgt;
  if pub then
    insert into public.friend_requests (from_uid, from_name, to_name, status) values (auth.uid(), lower(me), u, 'accepted')
      on conflict (from_name, to_name) do update set status = 'accepted', updated_at = now();
    perform public._notify(tgt, 'follow', lower(me), '@' || me || ' zaczął(a) Cię obserwować');
    return 'following';
  end if;
  insert into public.friend_requests (from_uid, from_name, to_name, status) values (auth.uid(), lower(me), u, 'pending')
    on conflict (from_name, to_name) do update set status = 'pending', updated_at = now(), created_at = now();
  perform public._notify(tgt, 'friend_req', lower(me), '@' || me || ' prosi o możliwość obserwowania Cię');
  return 'requested';
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
  if acc then perform public._notify(r.from_uid, 'friend_ok', lower(me), '@' || me || ' zaakceptował(a) Twoją prośbę o obserwowanie'); end if;
end $$;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- przestań obserwować / anuluj wysłaną prośbę
create or replace function public.remove_friend(uname text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friend_requests where lower(from_name) = lower(coalesce(public.my_username(), '')) and to_name = lower(trim(uname));
end $$;
grant execute on function public.remove_friend(text) to authenticated;

-- usuń kogoś z obserwujących mnie
create or replace function public.remove_follower(uname text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friend_requests where lower(to_name) = lower(coalesce(public.my_username(), '')) and from_name = lower(trim(uname));
end $$;
grant execute on function public.remove_follower(text) to authenticated;

create or replace function public.get_friend_profile(uname text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := public.my_username(); p public.profiles;
begin
  select * into p from public.profiles where lower(username) = lower(trim(uname)) limit 1;
  if not found then return null; end if;
  if me is not null and (lower(me) = lower(p.username) or public._follows(me, p.username)) then
    return jsonb_build_object('username', p.username, 'visits', coalesce(p.data -> 'visits', '{}'::jsonb), 'hvisits', coalesce(p.data -> 'hvisits', '{}'::jsonb));
  end if;
  if coalesce(p.is_public, true) then return public.get_public_profile(p.username); end if;
  return null;
end $$;
grant execute on function public.get_friend_profile(text) to anon, authenticated;
