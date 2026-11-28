-- Opinie o szlakach (letnie): publiczne oceny i notatki do konkretnych szlaków w danym miejscu.
-- Zwraca tylko dane z publicznych profili; notatki tylko od osób z włączonym „Pokazuj moje notatki w profilu”.
-- Uruchom raz w Supabase → SQL Editor.
create or replace function public.get_hike_opinions(pid text) returns table(username text, hike int, rating int, note text)
language sql stable security definer set search_path = public as $$
  select p.username,
         (h.key)::int as hike,
         nullif(p.data -> 'hvisits' -> pid -> 'hr' ->> h.key, '')::int as rating,
         case when coalesce(p.show_notes, false) then nullif(trim(p.data -> 'hvisits' -> pid -> 'hn' ->> h.key), '') end as note
  from public.profiles p
  cross join lateral (
    select key from jsonb_object_keys(coalesce(p.data -> 'hvisits' -> pid -> 'hr', '{}'::jsonb)) as key
    union
    select key from jsonb_object_keys(coalesce(p.data -> 'hvisits' -> pid -> 'hn', '{}'::jsonb)) as key
  ) h(key)
  where coalesce(p.is_public, true) and p.username is not null and h.key ~ '^[0-9]+$'
$$;
grant execute on function public.get_hike_opinions(text) to authenticated;
