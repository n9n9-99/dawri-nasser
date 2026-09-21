import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adapt365Scores,
  adaptFotMob,
  findProviderMatch,
  providerEventToPatch,
} from '../supabase/functions/sync-gulf27/core.mjs';

const fixture = {
  id: 'gulf-only-fixture',
  kickoff_at: '2026-09-23T14:30:00.000Z',
  home_name: 'العراق',
  away_name: 'عُمان',
};

test('FotMob adapter exposes Gulf match identity and live state', () => {
  const events = adaptFotMob({
    leagues: [{
      name: 'Gulf Cup Grp. A',
      matches: [{
        id: 6052027,
        home: { name: 'Iraq', score: 2 },
        away: { name: 'Oman', score: 1 },
        status: {
          utcTime: '2026-09-23T14:30:00.000Z',
          started: true,
          finished: false,
          cancelled: false,
          liveTime: { short: '67‎’‎' },
        },
      }],
    }],
  });

  assert.deepEqual(events, [{
    source: 'fotmob',
    externalId: '6052027',
    competition: 'Gulf Cup Grp. A',
    kickoffAt: '2026-09-23T14:30:00.000Z',
    homeName: 'Iraq',
    awayName: 'Oman',
    homeScore: 2,
    awayScore: 1,
    state: 'live',
    minute: 67,
  }]);
});

test('365Scores adapter exposes a finished national-team match', () => {
  const events = adapt365Scores({
    games: [{
      id: 9001,
      competitionDisplayName: 'كأس الخليج العربي',
      startTime: '2026-09-23T17:30:00+03:00',
      statusGroup: 4,
      statusText: 'انتهت',
      gameTime: 90,
      homeCompetitor: { name: 'العراق', score: 2 },
      awayCompetitor: { name: 'عمان', score: 1 },
    }],
  });

  assert.equal(events[0].state, 'finished');
  assert.equal(events[0].homeScore, 2);
  assert.equal(events[0].awayScore, 1);
});

test('matcher accepts aliases but rejects the wrong kickoff or reversed teams', () => {
  const correct = {
    externalId: '1', homeName: 'Iraq', awayName: 'Oman',
    kickoffAt: '2026-09-23T14:30:00.000Z', state: 'scheduled',
  };
  const reversed = { ...correct, externalId: '2', homeName: 'Oman', awayName: 'Iraq' };
  const wrongDay = { ...correct, externalId: '3', kickoffAt: '2026-09-25T14:30:00.000Z' };

  assert.equal(findProviderMatch(fixture, [reversed, wrongDay, correct])?.externalId, '1');
  assert.equal(findProviderMatch(fixture, [reversed, wrongDay]), null);
});

test('database patch never writes final scores before the match finishes', () => {
  assert.deepEqual(providerEventToPatch({
    source: 'fotmob', externalId: '1', kickoffAt: fixture.kickoff_at,
    state: 'live', homeScore: 2, awayScore: 1, minute: 67,
  }, '2026-09-21T20:00:00.000Z'), {
    external_fixture_id: 'fotmob:1',
    kickoff_at: fixture.kickoff_at,
    status: 'live',
    live_home_score: 2,
    live_away_score: 1,
    minute: 67,
    home_score: null,
    away_score: null,
    updated_at: '2026-09-21T20:00:00.000Z',
  });

  assert.equal(providerEventToPatch({
    source: 'fotmob', externalId: '1', kickoffAt: fixture.kickoff_at,
    state: 'finished', homeScore: 2, awayScore: 1, minute: 90,
  }).home_score, 2);
});
