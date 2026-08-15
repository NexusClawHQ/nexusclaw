const MAX_PROJECTED_RECORDS = 10;
const MAX_PROJECTED_FIELDS = 10;
const MAX_STRING_VALUE_LENGTH = 120;
const MAX_SERIALIZED_BYTES = 8 * 1024;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function compactScalar(value: unknown): string | number | boolean | null | undefined {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') return undefined;
  return value.length <= MAX_STRING_VALUE_LENGTH
    ? value
    : `${value.slice(0, MAX_STRING_VALUE_LENGTH)}…`;
}

function filterFieldNames(toolInput: unknown): string[] {
  const input = asRecord(toolInput);
  const filter = asRecord(input?.filter ?? input?.filters);
  return filter ? Object.keys(filter) : [];
}

function projectRecord(record: JsonRecord, preferredFields: readonly string[]): JsonRecord {
  const orderedKeys = Array.from(new Set([
    'id',
    ...preferredFields,
    ...Object.keys(record).filter((key) => {
      const value = record[key];
      return typeof value === 'number' || typeof value === 'boolean';
    }),
    ...Object.keys(record),
  ]));
  const projected: JsonRecord = {};
  for (const key of orderedKeys) {
    const value = compactScalar(record[key]);
    if (value === undefined) continue;
    projected[key] = value;
    if (Object.keys(projected).length >= MAX_PROJECTED_FIELDS) break;
  }
  return projected;
}

/**
 * Project record.query feedback for the next model turn without replaying
 * relation expansions or long text fields. The full result remains persisted
 * in ReactStep; this bounded projection preserves the query total, record IDs,
 * filter fields, and generic scalar facts needed to answer the user.
 */
export function serializeRecordQueryObservationForPrompt(
  output: unknown,
  toolInput: unknown,
): string {
  const source = asRecord(output);
  const records = Array.isArray(source?.records)
    ? source.records.map(asRecord).filter((record): record is JsonRecord => !!record)
    : [];
  const preferredFields = filterFieldNames(toolInput);
  const recordIds = records
    .map((record) => compactScalar(record.id))
    .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number');
  const projectedRecords = records
    .slice(0, MAX_PROJECTED_RECORDS)
    .map((record) => projectRecord(record, preferredFields));
  const projected: JsonRecord = {
    totalCount: source?.totalCount ?? records.length,
    returnedCount: records.length,
    recordIds,
    records: projectedRecords,
    truncated:
      records.length > projectedRecords.length ||
      records.some((record, index) =>
        index < projectedRecords.length &&
        Object.keys(record).length > Object.keys(projectedRecords[index]).length,
      ),
  };

  while (projectedRecords.length > 1) {
    const serialized = JSON.stringify(projected);
    if (Buffer.byteLength(serialized, 'utf8') <= MAX_SERIALIZED_BYTES) {
      return serialized;
    }
    projectedRecords.pop();
    projected.truncated = true;
  }
  return JSON.stringify(projected);
}
