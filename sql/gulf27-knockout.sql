-- Scope: Gulf 27 semifinals/final only; no historical score updates.
alter table public.predictions add column if not exists finish_method text check(finish_method in ('regulation','extra_time','penalties'));
create or replace function public.gulf_is_knockout(fid uuid) returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from fixtures f join rounds r on r.id=f.round_id join seasons s on s.id=f.season_id where f.id=fid and s.season_code='GULF-27-2026' and r.round_number in (4,5));
$$;
create table public.gulf_knockout_results(
 fixture_id uuid primary key references public.fixtures(id),
 winner text not null check(winner in ('home','away')),
 finish_method text not null check(finish_method in ('regulation','extra_time','penalties')),
 home_score integer not null check(home_score>=0),away_score integer not null check(away_score>=0),
 source text not null default 'admin',updated_at timestamptz not null default now(),
 check((finish_method='penalties' and home_score=away_score) or (finish_method<>'penalties' and ((winner='home' and home_score>away_score) or (winner='away' and away_score>home_score))))
);
alter table public.gulf_knockout_results enable row level security;
create policy gulf_result_read on public.gulf_knockout_results for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved'));
create policy gulf_result_admin on public.gulf_knockout_results for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.gulf_knockout_results to authenticated;
grant all on public.gulf_knockout_results to service_role;
create or replace function public.gulf_validate_result() returns trigger language plpgsql set search_path=public as $$
begin
 if not gulf_is_knockout(new.fixture_id) or not exists(select 1 from fixtures where id=new.fixture_id and status='finished') then raise exception 'Knockout result requires a finished Gulf semifinal or final';end if;
 new.updated_at=now();return new;
end $$;
create trigger gulf_result_guard before insert or update on public.gulf_knockout_results for each row execute function public.gulf_validate_result();
create or replace function public.enforce_prediction_score_matches_outcome() returns trigger language plpgsql as $$
begin
 if public.gulf_is_knockout(new.fixture_id) then
  if new.outcome not in ('home','away') then raise exception 'اختر المنتخب الفائز — لا يوجد تعادل في خروج المغلوب';end if;
  if new.finish_method is null then raise exception 'اختر طريقة حسم المباراة';end if;
  if (new.predicted_home_score is null)<>(new.predicted_away_score is null) then raise exception 'أدخل نتيجة الفريقين معًا';end if;
  if new.predicted_home_score is not null then
   if new.finish_method='penalties' and new.predicted_home_score<>new.predicted_away_score then raise exception 'نتيجة اللعب قبل الترجيح يجب أن تكون تعادلًا';end if;
   if new.finish_method<>'penalties' and ((new.outcome='home' and new.predicted_home_score<=new.predicted_away_score) or (new.outcome='away' and new.predicted_away_score<=new.predicted_home_score)) then raise exception 'Exact score does not match selected outcome';end if;
  end if;
  return new;
 end if;
 if new.finish_method is not null then raise exception 'Finish method only applies to Gulf knockout matches';end if;
 if new.predicted_home_score is null and new.predicted_away_score is null then return new; end if;
 if new.predicted_home_score is null or new.predicted_away_score is null then raise exception 'Exact score must include both teams';end if;
 if (new.outcome='home' and new.predicted_home_score<=new.predicted_away_score) or (new.outcome='away' and new.predicted_away_score<=new.predicted_home_score) or (new.outcome='draw' and new.predicted_home_score<>new.predicted_away_score) then raise exception 'Exact score does not match selected outcome';end if;
 return new;
end $$;
create or replace function public.gulf_score_result() returns trigger language plpgsql set search_path=public as $$
begin
 insert into prediction_scores(prediction_id,outcome_points,exact_score_points,bonus_points)
 select p.id,case when p.outcome=new.winner then 1 else 0 end,
 case when p.predicted_home_score=new.home_score and p.predicted_away_score=new.away_score then 2 else 0 end,
 case when p.finish_method=new.finish_method then 2 else 0 end
 from predictions p where p.fixture_id=new.fixture_id
 on conflict(prediction_id) do update set outcome_points=excluded.outcome_points,exact_score_points=excluded.exact_score_points,bonus_points=excluded.bonus_points,calculated_at=now();
 return new;
end $$;
create trigger gulf_result_score after insert or update on public.gulf_knockout_results for each row execute function public.gulf_score_result();
