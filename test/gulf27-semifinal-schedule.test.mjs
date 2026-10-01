import test from 'node:test';
import assert from 'node:assert/strict';
import {providerEventToPatch} from '../supabase/functions/sync-gulf27/core.mjs';
test('approved Saudi-Qatar kickoff survives stale provider schedule',()=>{
 const event={source:'fotmob',externalId:'6052094',kickoffAt:'2026-10-03T15:00:00Z',state:'scheduled'};
 assert.equal(Date.parse(providerEventToPatch(event).kickoff_at),Date.parse('2026-10-03T15:55:00Z'));
});
test('other provider fixtures retain their schedule',()=>{
 const event={source:'fotmob',externalId:'6052095',kickoffAt:'2026-10-03T18:30:00Z',state:'scheduled'};
 assert.equal(providerEventToPatch(event).kickoff_at,event.kickoffAt);
});
