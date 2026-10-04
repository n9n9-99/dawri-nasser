-- Publish only submission counts to approved participants. Prediction RLS stays intact.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.gulf27_prediction_counts(target_round uuid)
returns table(user_id uuid, prediction_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved'
  ) then
    raise exception 'Approved participant required' using errcode='42501';
  end if;
  return query
  select p.id, count(pr.id)
  from public.profiles p
  cross join public.rounds r
  join public.seasons s on s.id=r.season_id and s.season_code='GULF-27-2026'
  left join public.fixtures f on f.round_id=r.id
  left join public.predictions pr on pr.fixture_id=f.id and pr.user_id=p.id
  where r.id=target_round and p.approval_status='approved'
  group by p.id;
end;
$$;
revoke all on function private.gulf27_prediction_counts(uuid) from public, anon;
grant execute on function private.gulf27_prediction_counts(uuid) to authenticated;

create or replace function public.gulf27_prediction_counts(target_round uuid)
returns table(user_id uuid, prediction_count bigint)
language sql stable security invoker set search_path = '' as $$
  select * from private.gulf27_prediction_counts(target_round);
$$;
revoke all on function public.gulf27_prediction_counts(uuid) from public, anon;
grant execute on function public.gulf27_prediction_counts(uuid) to authenticated;
