CREATE OR REPLACE FUNCTION public.enforce_exact_score_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  target_round uuid;
  target_round_number integer;
  target_season_code text;
  exact_count integer;
  exact_limit integer := 2;
begin
  if (new.predicted_home_score is null) <> (new.predicted_away_score is null) then
    raise exception 'يجب إدخال نتيجتي الفريقين معًا أو تركهما فارغتين';
  end if;
  if new.predicted_home_score is null and new.predicted_away_score is null then return new; end if;

  select f.round_id,r.round_number,s.season_code
    into target_round,target_round_number,target_season_code
  from public.fixtures f
  join public.rounds r on r.id=f.round_id
  join public.seasons s on s.id=f.season_id
  where f.id=new.fixture_id;

  if target_round is null then raise exception 'تعذر تحديد جولة المباراة'; end if;

  -- خليجي 27: حد نهائي نتيجتان دقيقتان فقط لكل متسابق في الجولة.
  if target_season_code='GULF-27-2026' then exact_limit:=2;
  -- إبقاء قاعدة دوري روشن الحالية كما هي.
  elsif target_season_code='SPL-2026-2027' and target_round_number=7 then exact_limit:=3;
  end if;

  select count(*) into exact_count
  from public.predictions p
  join public.fixtures f on f.id=p.fixture_id
  where p.user_id=new.user_id
    and f.round_id=target_round
    and p.predicted_home_score is not null
    and p.predicted_away_score is not null
    and (tg_op='INSERT' or p.id<>new.id)
    and not (target_season_code='GULF-27-2026' and target_round_number in (4,5) and p.fixture_id=new.fixture_id);

  if exact_count>=exact_limit then
    raise exception 'الحد المسموح نتيجتان دقيقتان فقط في هذه الجولة';
  end if;
  return new;
end;
$function$;
