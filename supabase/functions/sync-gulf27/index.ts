import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { adapt365Scores, adaptFotMob, findProviderMatch, providerEventToPatch } from "./core.mjs";

const SEASON_CODE = "GULF-27-2026";
const DAY = 86_400_000;

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "DawriNasser-Gulf27-Live/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} HTTP ${response.status}`);
  return response.json();
}

function fotMobDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }).replaceAll("-", "");
}

function selectFixtures(fixtures: any[]) {
  const now = Date.now();
  const near = fixtures.filter(f => {
    const kickoff = Date.parse(f.kickoff_at);
    return f.status === "live" || (kickoff >= now - 8 * 60 * 60 * 1000 && kickoff <= now + 36 * 60 * 60 * 1000);
  });
  if (near.length) return near;
  const future = fixtures.filter(f => Date.parse(f.kickoff_at) > now).sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at));
  return future.length ? fixtures.filter(f => fotMobDate(f.kickoff_at) === fotMobDate(future[0].kickoff_at)) : [];
}

async function fotMobEvents(fixtures: any[]) {
  const dates = [...new Set(fixtures.map(f => fotMobDate(f.kickoff_at)))];
  const payloads = await Promise.all(dates.map(date => fetchJson(
    `https://www.fotmob.com/api/data/matches?date=${date}&ccode3=SAU&timezone=Asia%2FRiyadh&refresh=true`,
  )));
  return payloads.flatMap(adaptFotMob);
}

async function scores365Events() {
  const params = new URLSearchParams({
    appTypeId: "5",
    langId: "27",
    timezoneName: "Asia/Riyadh",
    userCountryId: "191",
    sports: "1",
  });
  return adapt365Scores(await fetchJson(`https://webws.365scores.com/web/games/fixtures/?${params}`));
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: season, error: seasonError } = await supabase
      .from("seasons").select("id").eq("season_code", SEASON_CODE).single();
    if (seasonError || !season) throw seasonError || new Error("Gulf 27 season missing");

    const { data: rows, error: fixtureError } = await supabase
      .from("fixtures")
      .select("id,season_id,round_id,kickoff_at,status,home_team_id,away_team_id,home_score,away_score,live_home_score,live_away_score,minute")
      .eq("season_id", season.id)
      .order("kickoff_at");
    if (fixtureError) throw fixtureError;

    const teamIds = [...new Set((rows || []).flatMap((f: any) => [f.home_team_id, f.away_team_id]))];
    const { data: teams, error: teamError } = await supabase.from("teams").select("id,name_ar").in("id", teamIds);
    if (teamError) throw teamError;
    const teamNames = new Map((teams || []).map((team: any) => [team.id, team.name_ar]));
    const fixtures = selectFixtures((rows || []).map((f: any) => ({
      ...f,
      home_name: teamNames.get(f.home_team_id),
      away_name: teamNames.get(f.away_team_id),
    })));

    const providerHealth: Record<string, string> = {};
    let fotmob: any[] = [];
    let scores365: any[] = [];
    try {
      fotmob = await fotMobEvents(fixtures);
      providerHealth.fotmob = "ok";
    } catch (error) {
      providerHealth.fotmob = String((error as Error).message || error);
    }
    const needsFallback = fixtures.some(f => !findProviderMatch(f, fotmob));
    if (needsFallback) {
      try {
        scores365 = await scores365Events();
        providerHealth["365scores"] = "ok";
      } catch (error) {
        providerHealth["365scores"] = String((error as Error).message || error);
      }
    }

    let matched = 0;
    let changed = 0;
    const unmatched: string[] = [];
    for (const fixture of fixtures) {
      const event = findProviderMatch(fixture, fotmob) || findProviderMatch(fixture, scores365);
      if (!event) {
        unmatched.push(`${fixture.home_name}-${fixture.away_name}`);
        continue;
      }
      matched++;
      const patch = providerEventToPatch(event);
      const different = fixture.status !== patch.status
        || fixture.live_home_score !== patch.live_home_score
        || fixture.live_away_score !== patch.live_away_score
        || fixture.home_score !== patch.home_score
        || fixture.away_score !== patch.away_score
        || fixture.minute !== patch.minute;
      const { error } = await supabase.from("fixtures").update(patch)
        .eq("id", fixture.id)
        .eq("season_id", season.id);
      if (error) throw error;
      if (different) changed++;
    }

    const roundIds = [...new Set(fixtures.map((f: any) => f.round_id))];
    for (const roundId of roundIds) {
      const { data: roundFixtures, error } = await supabase.from("fixtures")
        .select("kickoff_at,status").eq("round_id", roundId).eq("season_id", season.id).order("kickoff_at");
      if (error || !roundFixtures?.length) continue;
      const first = roundFixtures[0].kickoff_at;
      const allDone = roundFixtures.every((f: any) => f.status === "finished");
      const anyStarted = roundFixtures.some((f: any) => ["live", "halftime", "finished"].includes(f.status));
      await supabase.from("rounds").update({
        first_match_at: first,
        predictions_close_at: new Date(Date.parse(first) - 60 * 60 * 1000).toISOString(),
        predictions_revealed: anyStarted,
        status: allDone ? "finished" : anyStarted ? "live" : "upcoming",
      }).eq("id", roundId).eq("season_id", season.id);
    }

    const ok = matched === fixtures.length && fixtures.length > 0;
    return new Response(JSON.stringify({ ok, seasonCode: SEASON_CODE, providers: providerHealth, checked: fixtures.length, matched, changed, unmatched }), {
      status: ok ? 200 : 503,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, seasonCode: SEASON_CODE, error: String((error as Error).message || error) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
