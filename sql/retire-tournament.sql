-- Remove retired tournament services while retaining every Roshn scoring row.
drop trigger if exists trg_enforce_gulf27_result_guard on public.fixtures;
drop trigger if exists gulf27_fixture_scores on public.fixtures;
drop trigger if exists gulf27_prediction_scores on public.predictions;
drop table if exists public.gulf_knockout_results;
drop function if exists public.gulf_validate_result();
drop function if exists public.gulf_score_result();
drop function if exists public.enforce_gulf27_result_guard();
drop function if exists public.gulf27_refresh_scores();
drop table if exists public.gulf27_result_guard;
drop function if exists public.gulf27_prediction_counts(uuid);
drop function if exists private.gulf27_prediction_counts(uuid);
drop function if exists public.gulf27_scores(uuid);
create or replace function public.enforce_prediction_score_matches_outcome() returns trigger language plpgsql as $$
begin
 if new.finish_method is not null then raise exception 'Finish method is not used in this competition';end if;
 if new.predicted_home_score is null and new.predicted_away_score is null then return new; end if;
 if new.predicted_home_score is null or new.predicted_away_score is null then raise exception 'Exact score must include both teams';end if;
 if (new.outcome='home' and new.predicted_home_score<=new.predicted_away_score) or (new.outcome='away' and new.predicted_away_score<=new.predicted_home_score) or (new.outcome='draw' and new.predicted_home_score<>new.predicted_away_score) then raise exception 'Exact score does not match selected outcome';end if;
 return new;
end $$;
create or replace function public.enforce_exact_score_limit() returns trigger language plpgsql as $$
declare target_round uuid; target_round_number integer; target_season_code text; exact_count integer; exact_limit integer:=2;
begin
 if (new.predicted_home_score is null)<>(new.predicted_away_score is null) then raise exception 'يجب إدخال نتيجتي الفريقين معًا أو تركهما فارغتين';end if;
 if new.predicted_home_score is null and new.predicted_away_score is null then return new;end if;
 select f.round_id,r.round_number,s.season_code into target_round,target_round_number,target_season_code from public.fixtures f join public.rounds r on r.id=f.round_id join public.seasons s on s.id=f.season_id where f.id=new.fixture_id;
 if target_round is null then raise exception 'تعذر تحديد جولة المباراة';end if;
 if target_season_code='SPL-2026-2027' and target_round_number=7 then exact_limit:=3;end if;
 select count(*) into exact_count from public.predictions p join public.fixtures f on f.id=p.fixture_id where p.user_id=new.user_id and f.round_id=target_round and p.predicted_home_score is not null and p.predicted_away_score is not null and (tg_op='INSERT' or p.id<>new.id);
 if exact_count>=exact_limit then raise exception 'الحد المسموح نتيجتان دقيقتان فقط في هذه الجولة';end if;
 return new;
end $$;
drop function if exists public.gulf_is_knockout(uuid);
