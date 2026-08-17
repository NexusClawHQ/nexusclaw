import { describe, expect, it, vi } from 'vitest';

import { createTranslator, detectLang } from './i18n';

describe('createTranslator', () => {
  it('interpolates numeric params into both languages', () => {
    const en = createTranslator('en');
    const zh = createTranslator('zh');
    expect(en('common.ms', { n: 42 })).toBe('42 ms');
    expect(zh('common.ms', { n: 42 })).toBe('42 毫秒');
  });

  it('leaves placeholders untouched when no params are given', () => {
    expect(createTranslator('en')('common.ms')).toBe('{n} ms');
  });

  it('translates a known status label', () => {
    expect(createTranslator('en')('status.guardrail_pending')).toBe(
      'awaiting approval',
    );
    expect(createTranslator('zh')('status.guardrail_pending')).toBe('等待审批');
  });
});

describe('detectLang', () => {
  it('prefers Chinese for zh locales', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' });
    expect(detectLang()).toBe('zh');
    vi.unstubAllGlobals();
  });

  it('falls back to English for anything else', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(detectLang()).toBe('en');
    vi.unstubAllGlobals();
  });
});
