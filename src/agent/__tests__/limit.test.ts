import { describe, it, expect } from 'vitest';
import { failureReason, isLimitError, limitResetsAt } from '../executor.js';

describe('agent failures', () => {
  const limitLine = JSON.stringify({ type: 'result', is_error: true, result: "You've hit your session limit · resets 7:30pm (America/Recife)" });

  it('reads the reason from the result line, not "Exit code 1"', () => {
    const stdout = [JSON.stringify({ type: 'system', subtype: 'init' }), limitLine].join('\n');
    expect(failureReason(stdout, '', 1)).toBe("You've hit your session limit · resets 7:30pm (America/Recife)");
    expect(failureReason('', 'boom', 1)).toBe('boom');
    expect(failureReason('', '', 1)).toBe('Exit code 1');
  });

  it('knows a usage limit when it sees one', () => {
    expect(isLimitError("You've hit your session limit · resets 7:30pm")).toBe(true);
    expect(isLimitError('Claude AI usage limit reached|1759263000')).toBe(true);
    expect(isLimitError('Your credit balance is too low')).toBe(true);
    expect(isLimitError('Timeout (300000ms)')).toBe(false);
    expect(isLimitError(undefined)).toBe(false);
  });

  it('turns "resets 7:30pm" into the next 19:30', () => {
    const afternoon = new Date(2026, 9, 1, 15, 0);
    expect(limitResetsAt('resets 7:30pm', afternoon)?.getHours()).toBe(19);
    expect(limitResetsAt('resets 7:30pm', afternoon)?.getDate()).toBe(1);
    const night = new Date(2026, 9, 1, 21, 0);
    expect(limitResetsAt('resets 7:30pm', night)?.getDate()).toBe(2); // already passed → tomorrow
    expect(limitResetsAt('resets 12pm', afternoon)?.getHours()).toBe(12);
    expect(limitResetsAt('no time here')).toBeUndefined();
  });
});
