import { canonicalJsonDigest } from './canonical-hash';
import type { WorkforceReleaseGateReceiptV1 } from './release-evidence.types';
import type { JsonValue } from './json-value';

export function buildWorkforceReleaseGateReceipt(
  input: Omit<WorkforceReleaseGateReceiptV1, 'schemaVersion' | 'receiptDigest'>,
): WorkforceReleaseGateReceiptV1 {
  const evidenceRunIds = [...input.evidenceRunIds].sort();
  if (
    !input.approvalId.trim() ||
    !input.candidateReleaseSetId.trim() ||
    evidenceRunIds.length === 0 ||
    evidenceRunIds.some((id) => !id.trim()) ||
    new Set(evidenceRunIds).size !== evidenceRunIds.length ||
    input.decisionVersion !== (input.decision === 'pending' ? 0 : 1) ||
    !Number.isFinite(Date.parse(input.expiresAt))
  ) {
    throw new Error('WORKFORCE_RELEASE_GATE_RECEIPT_INVALID');
  }
  const receipt = {
    schemaVersion:
      'nexusclaw.workforce-release-gate-receipt/v1' as const,
    ...input,
    evidenceRunIds,
  };
  return {
    ...receipt,
    receiptDigest: canonicalJsonDigest(receipt as unknown as JsonValue),
  };
}
