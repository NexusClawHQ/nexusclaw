import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { formatDuration, formatTokens, TERMINAL_STATUSES } from './ui';

const en = createTranslator('en');
const zh = createTranslator('zh');

describe('formatDuration', () => {
  it('renders the em-dash placeholder for missing durations', () => {
    expect(formatDuration(null, en)).toBe('—');
  });

  it('renders sub-10s durations in milliseconds', () => {
    expect(formatDuration(150, en)).toBe('150 ms');
    expect(formatDuration(150, zh)).toBe('150 毫秒');
  });

  it('switches to seconds from 10s upward', () => {
    expect(formatDuration(15_000, en)).toBe('15.0 s');
  });
});

describe('formatTokens', () => {
  it('returns the placeholder when both counts are missing', () => {
    expect(formatTokens(null, null)).toBe('—');
  });

  it('treats a missing side as zero', () => {
    expect(formatTokens(178, null)).toBe('178 / 0');
    expect(formatTokens(null, 366)).toBe('0 / 366');
  });
});

describe('TERMINAL_STATUSES', () => {
  it('treats guardrail_pending as resumable and done/failed as terminal', () => {
    expect(TERMINAL_STATUSES.has('guardrail_pending')).toBe(false);
    expect(TERMINAL_STATUSES.has('done')).toBe(true);
    expect(TERMINAL_STATUSES.has('failed')).toBe(true);
  });
});
