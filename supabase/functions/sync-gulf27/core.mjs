const TEAM_ALIASES = {
  iraq: ['iraq', 'العراق'],
  oman: ['oman', 'عمان', 'عُمان'],
  saudi: ['saudiarabia', 'saudi', 'السعودية', 'المملكةالعربيةالسعودية'],
  kuwait: ['kuwait', 'الكويت'],
  uae: ['unitedarabemirates', 'uae', 'الإمارات', 'الامارات', 'الإماراتالعربيةالمتحدة'],
  yemen: ['yemen', 'اليمن'],
  qatar: ['qatar', 'قطر'],
  bahrain: ['bahrain', 'البحرين'],
};

function normalized(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function canonicalTeam(value) {
  const name = normalized(value);
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) {
    if (aliases.some(alias => normalized(alias) === name)) return canonical;
  }
  return name;
}

function score(value) {
  if (value == null || Number(value) < 0) return null;
  return Number(value);
}

function minute(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function adaptFotMob(payload) {
  const events = [];
  for (const league of payload?.leagues || []) {
    for (const match of league.matches || []) {
      const status = match.status || {};
      const state = status.cancelled
        ? 'postponed'
        : status.finished
          ? 'finished'
          : status.started || status.ongoing
            ? 'live'
            : 'scheduled';
      events.push({
        source: 'fotmob',
        externalId: String(match.id),
        competition: league.name || '',
        kickoffAt: status.utcTime || new Date(match.timeTS).toISOString(),
        homeName: match.home?.name || match.home?.longName || '',
        awayName: match.away?.name || match.away?.longName || '',
        homeScore: score(match.home?.score),
        awayScore: score(match.away?.score),
        state,
        minute: state === 'finished' ? 90 : minute(status.liveTime?.short || status.liveTime?.long),
      });
    }
  }
  return events;
}

export function adapt365Scores(payload) {
  return (payload?.games || []).map(game => {
    const statusText = String(game.statusText || '').toLowerCase();
    const cancelled = /تأجل|الغيت|ألغيت|postpon|cancel/.test(statusText);
    const finished = !cancelled && (game.statusGroup === 4 || /انتهت|finished|full time/.test(statusText));
    const state = cancelled ? 'postponed' : finished ? 'finished' : game.statusGroup === 3 ? 'live' : 'scheduled';
    return {
      source: '365scores',
      externalId: String(game.id),
      competition: game.competitionDisplayName || '',
      kickoffAt: game.startTime,
      homeName: game.homeCompetitor?.name || '',
      awayName: game.awayCompetitor?.name || '',
      homeScore: score(game.homeCompetitor?.score),
      awayScore: score(game.awayCompetitor?.score),
      state,
      minute: state === 'finished' ? 90 : minute(game.gameTimeDisplay || game.gameTime),
    };
  });
}

export function findProviderMatch(fixture, events) {
  const kickoff = Date.parse(fixture.kickoff_at);
  const found = events.find(event => {
    const eventKickoff = Date.parse(event.kickoffAt);
    return canonicalTeam(fixture.home_name) === canonicalTeam(event.homeName)
      && canonicalTeam(fixture.away_name) === canonicalTeam(event.awayName)
      && Number.isFinite(eventKickoff)
      && Math.abs(eventKickoff - kickoff) <= 8 * 60 * 60 * 1000;
  });
  return found || null;
}

export function providerEventToPatch(event, updatedAt = new Date().toISOString()) {
  const live = event.state === 'live';
  const finished = event.state === 'finished';
  return {
    external_fixture_id: `${event.source}:${event.externalId}`,
    kickoff_at: event.kickoffAt,
    status: event.state,
    live_home_score: live || finished ? event.homeScore : null,
    live_away_score: live || finished ? event.awayScore : null,
    minute: live || finished ? event.minute : null,
    home_score: finished ? event.homeScore : null,
    away_score: finished ? event.awayScore : null,
    updated_at: updatedAt,
  };
}
