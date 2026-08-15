/**
 * Public-key-only primitives for the AI authoring context detached JWS.
 *
 * Private-key parsing and signing stay in the backend owner. This shared file
 * owns the exact protected header, canonical payload and fail-closed verifier
 * used by both backend tests and the CLI.
 */
import { createPublicKey, verify } from 'node:crypto';
import {
  AI_CONTEXT_SIGNATURE_ALG_ED25519,
  AI_CONTEXT_SIGNATURE_TYP,
  AI_CONTEXT_SIGNING_KEY_SET_SCHEMA_VERSION,
} from './contract-versions';
import type {
  AiContextSignatureHeaderV1,
  AiContextSignaturePayloadV1,
  AiContextSigningKeySetV1,
  AiContextSigningPublicJwkV1,
} from './ai-authoring-context.types';
import { canonicalJsonString, isSha256Digest } from './canonical-hash';
import type { JsonValue } from './json-value';

export type AiContextSigningErrorCode =
  | 'AI_CONTEXT_SIGNATURE_INVALID'
  | 'AI_CONTEXT_SIGNING_KEY_UNKNOWN';

export class AiContextSigningError extends Error {
  constructor(readonly code: AiContextSigningErrorCode) {
    super(code);
    this.name = 'AiContextSigningError';
  }
}

export interface AiContextDetachedSigningInput {
  readonly protectedHeader: string;
  readonly signingInput: Uint8Array;
}

export interface VerifyAiContextDetachedJwsInput {
  readonly detachedJws: string;
  readonly expectedKeyId: string;
  readonly payload: AiContextSignaturePayloadV1;
  readonly keySet: AiContextSigningKeySetV1;
  readonly expectedIssuer?: string;
  readonly now?: Date;
}

function base64UrlEncode(value: Uint8Array | string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  return decoded;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isExactIsoInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

function requireNonBlank(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value
  );
}

function assertPublicJwk(value: unknown): asserts value is AiContextSigningPublicJwkV1 {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !exactKeys(value as Record<string, unknown>, ['kty', 'crv', 'x'])
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  const jwk = value as Record<string, unknown>;
  if (
    jwk.kty !== 'OKP' ||
    jwk.crv !== 'Ed25519' ||
    typeof jwk.x !== 'string' ||
    base64UrlDecode(jwk.x).byteLength !== 32
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
}

/** Runtime validation for the authenticated public JWK-set response. */
export function assertAiContextSigningKeySet(
  value: unknown,
): asserts value is AiContextSigningKeySetV1 {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !exactKeys(value as Record<string, unknown>, [
      'schemaVersion',
      'issuer',
      'generatedAt',
      'cacheUntil',
      'keys',
    ])
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  const keySet = value as Record<string, unknown>;
  if (
    keySet.schemaVersion !== AI_CONTEXT_SIGNING_KEY_SET_SCHEMA_VERSION ||
    !requireNonBlank(keySet.issuer) ||
    !isExactIsoInstant(keySet.generatedAt) ||
    !isExactIsoInstant(keySet.cacheUntil) ||
    Date.parse(keySet.cacheUntil) <= Date.parse(keySet.generatedAt) ||
    !Array.isArray(keySet.keys)
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }

  const seen = new Set<string>();
  let previousKeyId: string | undefined;
  for (const rawKey of keySet.keys) {
    if (
      rawKey === null ||
      typeof rawKey !== 'object' ||
      Array.isArray(rawKey) ||
      !exactKeys(rawKey as Record<string, unknown>, [
        'keyId',
        'alg',
        'publicKeyJwk',
        'notBefore',
        'notAfter',
        'status',
      ])
    ) {
      throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
    }
    const key = rawKey as Record<string, unknown>;
    if (
      !requireNonBlank(key.keyId) ||
      key.alg !== AI_CONTEXT_SIGNATURE_ALG_ED25519 ||
      !isExactIsoInstant(key.notBefore) ||
      !isExactIsoInstant(key.notAfter) ||
      Date.parse(key.notAfter) <= Date.parse(key.notBefore) ||
      (key.status !== 'active' && key.status !== 'retiring') ||
      seen.has(key.keyId) ||
      (previousKeyId !== undefined && previousKeyId.localeCompare(key.keyId) >= 0)
    ) {
      throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
    }
    assertPublicJwk(key.publicKeyJwk);
    seen.add(key.keyId);
    previousKeyId = key.keyId;
  }
}

function assertSignaturePayload(
  payload: AiContextSignaturePayloadV1,
): void {
  if (
    !exactKeys(payload as unknown as Record<string, unknown>, [
      'lockDigest',
      'workspaceId',
      'principalScopeDigest',
      'orgAliasClaim',
      'generatedAt',
      'expiresAt',
    ]) ||
    !isSha256Digest(payload.lockDigest) ||
    !isSha256Digest(payload.principalScopeDigest) ||
    !requireNonBlank(payload.workspaceId) ||
    !requireNonBlank(payload.orgAliasClaim) ||
    !isExactIsoInstant(payload.generatedAt) ||
    !isExactIsoInstant(payload.expiresAt) ||
    Date.parse(payload.expiresAt) <= Date.parse(payload.generatedAt)
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
}

/**
 * Build the exact RFC 8785 payload signing input. The returned JWS protected
 * segment is combined with a deliberately omitted compact payload by callers:
 * `<protected>..<signature>`.
 */
export function buildAiContextDetachedSigningInput(
  payload: AiContextSignaturePayloadV1,
  keyId: string,
): AiContextDetachedSigningInput {
  assertSignaturePayload(payload);
  if (!requireNonBlank(keyId)) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  const header: AiContextSignatureHeaderV1 = {
    alg: AI_CONTEXT_SIGNATURE_ALG_ED25519,
    typ: AI_CONTEXT_SIGNATURE_TYP,
    kid: keyId,
  };
  const protectedHeader = base64UrlEncode(
    canonicalJsonString(header as unknown as JsonValue),
  );
  const encodedPayload = base64UrlEncode(
    canonicalJsonString(payload as unknown as JsonValue),
  );
  return {
    protectedHeader,
    signingInput: Buffer.from(`${protectedHeader}.${encodedPayload}`, 'utf8'),
  };
}

/**
 * Verify an Ed25519 detached compact JWS using only the authenticated public
 * key set. Embedded/untrusted keys and non-canonical/extra header fields are
 * never accepted.
 */
export function verifyAiContextDetachedJws(
  input: VerifyAiContextDetachedJwsInput,
): { readonly issuer: string; readonly keyId: string } {
  assertAiContextSigningKeySet(input.keySet);
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  if (
    !Number.isFinite(nowMs) ||
    (input.expectedIssuer !== undefined &&
      input.keySet.issuer !== input.expectedIssuer)
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }

  const segments = input.detachedJws.split('.');
  if (segments.length !== 3 || segments[1] !== '') {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  let header: unknown;
  try {
    header = JSON.parse(base64UrlDecode(segments[0]!).toString('utf8'));
  } catch (error) {
    if (error instanceof AiContextSigningError) throw error;
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  if (
    header === null ||
    typeof header !== 'object' ||
    Array.isArray(header) ||
    !exactKeys(header as Record<string, unknown>, ['alg', 'typ', 'kid'])
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  const protectedHeader = header as Record<string, unknown>;
  if (
    protectedHeader.alg !== AI_CONTEXT_SIGNATURE_ALG_ED25519 ||
    protectedHeader.typ !== AI_CONTEXT_SIGNATURE_TYP ||
    protectedHeader.kid !== input.expectedKeyId
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }

  const rebuilt = buildAiContextDetachedSigningInput(
    input.payload,
    input.expectedKeyId,
  );
  if (rebuilt.protectedHeader !== segments[0]) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }

  if (
    nowMs >= Date.parse(input.keySet.cacheUntil) ||
    nowMs < Date.parse(input.payload.generatedAt) ||
    nowMs >= Date.parse(input.payload.expiresAt)
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNING_KEY_UNKNOWN');
  }
  const key = input.keySet.keys.find(
    (candidate) => candidate.keyId === input.expectedKeyId,
  );
  if (
    !key ||
    nowMs < Date.parse(key.notBefore) ||
    nowMs >= Date.parse(key.notAfter)
  ) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNING_KEY_UNKNOWN');
  }

  let valid = false;
  try {
    const publicKey = createPublicKey({
      key: {
        kty: key.publicKeyJwk.kty,
        crv: key.publicKeyJwk.crv,
        x: key.publicKeyJwk.x,
      } as Record<string, string>,
      format: 'jwk',
    });
    valid = verify(
      null,
      rebuilt.signingInput,
      publicKey,
      base64UrlDecode(segments[2]!),
    );
  } catch (error) {
    if (error instanceof AiContextSigningError) throw error;
    valid = false;
  }
  if (!valid) {
    throw new AiContextSigningError('AI_CONTEXT_SIGNATURE_INVALID');
  }
  return { issuer: input.keySet.issuer, keyId: key.keyId };
}
