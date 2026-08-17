import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import {
  assertCommunitySourceUrl,
  CommunitySourceDisclosureController,
  CommunitySourceDisclosureMiddleware,
  COMMUNITY_SOURCE_URL_INVALID,
  COMMUNITY_SOURCE_URL_REQUIRED,
} from './community-source-disclosure.module';

const configWith = (
  values: Record<string, string | undefined>,
): ConfigService =>
  ({
    get: (key: string, defaultValue?: unknown) =>
      key in values ? values[key] : defaultValue,
  }) as unknown as ConfigService;

describe('assertCommunitySourceUrl', () => {
  it('accepts an HTTPS source URL', () => {
    expect(assertCommunitySourceUrl('https://example.com/source')).toBe(
      'https://example.com/source',
    );
  });

  it('accepts plain HTTP to localhost outside production', () => {
    expect(
      assertCommunitySourceUrl('http://localhost:3000', 'development'),
    ).toBe('http://localhost:3000/');
  });

  it('rejects plain HTTP to localhost in production', () => {
    expect(() =>
      assertCommunitySourceUrl('http://localhost:3000', 'production'),
    ).toThrow(COMMUNITY_SOURCE_URL_INVALID);
  });

  it('rejects URLs carrying credentials or a fragment', () => {
    expect(() =>
      assertCommunitySourceUrl('https://user:pass@example.com'),
    ).toThrow(COMMUNITY_SOURCE_URL_INVALID);
    expect(() =>
      assertCommunitySourceUrl('https://example.com/#section'),
    ).toThrow(COMMUNITY_SOURCE_URL_INVALID);
  });

  it('rejects missing and placeholder values', () => {
    expect(() => assertCommunitySourceUrl(undefined)).toThrow(
      COMMUNITY_SOURCE_URL_REQUIRED,
    );
    expect(() =>
      assertCommunitySourceUrl('https://replace-with-example'),
    ).toThrow(COMMUNITY_SOURCE_URL_REQUIRED);
  });
});

describe('CommunitySourceDisclosureController', () => {
  it('advertises Apache-2.0 and links the Apache-2.0 license text', () => {
    const controller = new CommunitySourceDisclosureController(
      configWith({
        COMMUNITY_SOURCE_URL: 'https://example.com/source',
        NODE_ENV: 'production',
      }),
    );
    const disclosure = controller.getSourceDisclosure();
    expect(disclosure.license).toBe('Apache-2.0');
    expect(disclosure.licenseUrl).toBe(
      'https://www.apache.org/licenses/LICENSE-2.0',
    );
    // Regression guard: this compliance surface once pointed at the AGPL-3.0
    // text after the repository relicensed to Apache-2.0.
    expect(disclosure.licenseUrl).not.toMatch(/agpl|gnu\.org/i);
    expect(disclosure.correspondingSourceUrl).toBe(
      'https://example.com/source',
    );
  });
});

describe('CommunitySourceDisclosureMiddleware', () => {
  it('advertises the corresponding source on every response', () => {
    const middleware = new CommunitySourceDisclosureMiddleware(
      configWith({
        COMMUNITY_SOURCE_URL: 'https://example.com/source',
        NODE_ENV: 'production',
      }),
    );
    const setHeader = vi.fn();
    const next = vi.fn();
    middleware.use({}, { setHeader }, next);
    expect(setHeader).toHaveBeenCalledWith(
      'Link',
      '<https://example.com/source>; rel="alternate"; title="Corresponding Source"',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'X-NexusClaw-Corresponding-Source',
      'https://example.com/source',
    );
    expect(next).toHaveBeenCalled();
  });
});
