export type PiiClassification =
  | 'none'
  | 'personal'
  | 'sensitive'
  | 'financial'
  | 'health';

export const PII_CLASSIFICATIONS = [
  'none',
  'personal',
  'sensitive',
  'financial',
  'health',
] as const satisfies ReadonlyArray<PiiClassification>;

export const HARD_ERASURE_PII_CLASSIFICATIONS: readonly PiiClassification[] = [
  'sensitive',
  'financial',
  'health',
];
