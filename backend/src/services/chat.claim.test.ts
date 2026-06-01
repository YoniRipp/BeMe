import { describe, it, expect, vi } from 'vitest';

// chat.ts validates env config on import; stub it out for this unit test.
vi.mock('../config/index.js', () => ({
  config: { geminiApiKey: 'test-key', geminiModel: 'gemini-test' },
}));

import { SINGLE_ACTION_CLAIM_PATTERN } from './chat.js';

/**
 * The chat agent uses SINGLE_ACTION_CLAIM_PATTERN as a safety net: when the model
 * *claims* it performed an action but never actually called a tool, a forced
 * tool call is triggered so the change really lands in the DB.
 *
 * Regression: deletion/removal claims previously slipped through (only add/save
 * verbs were matched), so "remove my workout" replies never forced delete_workout.
 */
describe('SINGLE_ACTION_CLAIM_PATTERN', () => {
  it('matches deletion / removal / edit claims', () => {
    const claims = [
      "I've removed your workout",
      'I deleted the Push Day workout',
      "I've updated that workout",
      'I changed the squat weight',
      'I edited your workout',
      "I've moved the workout to yesterday",
    ];
    for (const c of claims) {
      expect(SINGLE_ACTION_CLAIM_PATTERN.test(c), c).toBe(true);
    }
  });

  it('still matches add / save claims', () => {
    const claims = [
      "I've logged your workout",
      'I added the food',
      'I saved that goal',
      'Done!',
      'All set.',
    ];
    for (const c of claims) {
      expect(SINGLE_ACTION_CLAIM_PATTERN.test(c), c).toBe(true);
    }
  });

  it('does not match plain conversational replies', () => {
    const nonClaims = [
      'What would you like to remove?',
      'Which workout should I delete?',
      'Here are your workouts for this week.',
    ];
    for (const c of nonClaims) {
      expect(SINGLE_ACTION_CLAIM_PATTERN.test(c), c).toBe(false);
    }
  });
});
