-- One authoritative scorer for every Gulf screen and persisted score.
-- SECURITY INVOKER preserves prediction visibility policies.
create or replace function public.gulf27_scores(target_fixture uuid default null)
returns table(prediction_id uuid,fixture_id uuid,user_id uuid,round_id uuid,outcome_points integer,exact_score_points integer,bonus_points integer,total_points integer)
language sql stable security invoker set search_path=public as $$
 with points as (
 select p.id,p.fixture_id,p.user_id,f.round_id,
 case when f.status='finished' and p.outcome=case
   when r.round_number in (4,5) then case when f.winner_team_id=f.home_team_id then 'home' when f.winner_team_id=f.away_team_id then 'away' end
   when f.home_score>f.away_score then 'home' when f.home_score<f.away_score then 'away' when f.home_score=f.away_score then 'draw' end then 1 else 0 end op,
 case when f.status='finished' and p.predicted_home_score=f.home_score and p.predicted_away_score=f.away_score then 2 else 0 end ep,
 case when f.status='finished' and r.round_number in (4,5) and p.finish_method=f.finish_method then 1 else 0 end bp
 from public.predictions p join public.fixtures f on f.id=p.fixture_id
 join public.rounds r on r.id=f.round_id join public.seasons s on s.id=f.season_id
 where s.season_code='GULF-27-2026' and (target_fixture is null or f.id=target_fixture)
 ) select id,fixture_id,user_id,round_id,op,ep,bp,op+ep+bp from points;
$$;
revoke all on function public.gulf27_scores(uuid) from public,anon;
grant execute on function public.gulf27_scores(uuid) to authenticated,service_role;

create or replace function public.gulf_score_result() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 -- Canonical winner means the qualifying team; scores exclude shootout goals.
 update public.fixtures set home_score=new.home_score,away_score=new.away_score,
 winner_team_id=case when new.winner='home' then home_team_id else away_team_id end,
 finish_method=new.finish_method where id=new.fixture_id and public.gulf_is_knockout(id);
 insert into public.prediction_scores(prediction_id,outcome_points,exact_score_points,bonus_points)
 select prediction_id,outcome_points,exact_score_points,bonus_points from public.gulf27_scores(new.fixture_id)
 on conflict(prediction_id) do update set outcome_points=excluded.outcome_points,exact_score_points=excluded.exact_score_points,bonus_points=excluded.bonus_points,calculated_at=now();
 return new;
end $$;

create or replace function public.gulf27_refresh_scores() returns trigger
language plpgsql security invoker set search_path=public as $$
declare fid uuid;
begin
 fid:=(to_jsonb(new)->>case when tg_table_name='fixtures' then 'id' else 'fixture_id' end)::uuid;
 if not exists(select 1 from public.fixtures f join public.seasons s on s.id=f.season_id where f.id=fid and s.season_code='GULF-27-2026' and f.status='finished') then return new; end if;
 insert into public.prediction_scores(prediction_id,outcome_points,exact_score_points,bonus_points)
 select prediction_id,outcome_points,exact_score_points,bonus_points from public.gulf27_scores(fid)
 on conflict(prediction_id) do update set outcome_points=excluded.outcome_points,exact_score_points=excluded.exact_score_points,bonus_points=excluded.bonus_points,calculated_at=now();
 return new;
end $$;
create trigger gulf27_fixture_scores after update of home_score,away_score,winner_team_id,finish_method,status on public.fixtures for each row execute function public.gulf27_refresh_scores();
create trigger gulf27_prediction_scores after insert or update on public.predictions for each row execute function public.gulf27_refresh_scores();
revoke all on function public.gulf27_refresh_scores() from public,anon;
revoke all on function public.gulf_score_result() from public,anon;

-- Reconcile both semifinal result records with their verified canonical fixtures.
insert into public.gulf_knockout_results(fixture_id,winner,finish_method,home_score,away_score,source)
select f.id,case when f.winner_team_id=f.home_team_id then 'home' else 'away' end,f.finish_method,f.home_score,f.away_score,'verified canonical fixture'
from public.fixtures f join public.seasons s on s.id=f.season_id join public.rounds r on r.id=f.round_id
where s.season_code='GULF-27-2026' and r.round_number=4 and f.status='finished' and f.winner_team_id is not null and f.finish_method is not null
on conflict(fixture_id) do update set winner=excluded.winner,finish_method=excluded.finish_method,home_score=excluded.home_score,away_score=excluded.away_score,source=excluded.source;

-- Rebuild all Gulf scores from predictions and verified fixture results, never totals.
insert into public.prediction_scores(prediction_id,outcome_points,exact_score_points,bonus_points)
select prediction_id,outcome_points,exact_score_points,bonus_points from public.gulf27_scores()
on conflict(prediction_id) do update set outcome_points=excluded.outcome_points,exact_score_points=excluded.exact_score_points,bonus_points=excluded.bonus_points,calculated_at=now();
