export const SYSTEM_OBJECT_PERSISTENCE_KINDS = {
  user: 'native-adapter',
  orgNode: 'native-adapter',
  account: 'generic-record',
  contact: 'generic-record',
  opportunity: 'generic-record',
  task: 'generic-record',
  product: 'generic-record',
  priceBook: 'generic-record',
  quote: 'generic-record',
  case: 'generic-record',
  // Activity is persisted by the canonical ActivityService on the
  // structured `activities` table (subtype semantics + timeline + outbox),
  // NOT on the JSONB object_records table. Writing it through the generic
  // record API previously landed rows in object_records where no read path
  // looked — a silent noop. Marking it native-adapter makes the generic
  // createRecord/update/delete reject it loudly; callers must use the
  // dedicated createActivity/updateActivity mutations.
  activity: 'native-adapter',
  lead: 'generic-record',
  leadConversionLog: 'read-only-projection',
  campaign: 'generic-record',
  campaignMember: 'generic-record',
  agentExecution: 'read-only-projection',
} as const;

export type SystemObjectPersistenceKind =
  (typeof SYSTEM_OBJECT_PERSISTENCE_KINDS)[keyof typeof SYSTEM_OBJECT_PERSISTENCE_KINDS];

export const resolveSystemObjectPersistenceKind = (
  objectName: string,
): SystemObjectPersistenceKind | undefined =>
  SYSTEM_OBJECT_PERSISTENCE_KINDS[
    objectName as keyof typeof SYSTEM_OBJECT_PERSISTENCE_KINDS
  ];

export const canMutateThroughGenericRecordApi = (objectName: string): boolean => {
  const kind = resolveSystemObjectPersistenceKind(objectName);
  return kind === undefined || kind === 'generic-record';
};
