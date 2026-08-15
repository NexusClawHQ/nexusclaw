import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

/**
 * Object-level layout config contract (Req 9.4).
 *
 * Carries the layout configuration that has no dedicated home yet — Search Layout
 * (which result/filter/lookup columns a list/search/lookup surface renders) and
 * Field Sets (named, ordered field groups a surface can request by apiName). It is
 * a *typed* carrier validated by this schema (red line: no bare `settings: any`),
 * with a read adapter that applies defaults so rendering surfaces get a stable
 * shape regardless of legacy data.
 *
 * Compact Layout is intentionally NOT carried here — it already has a dedicated
 * persisted entity + read service (page-builder `CompactLayout`), which remains
 * its single source of truth.
 */

const fieldName = z.string().min(1);

/** Which columns appear on list / search / lookup result surfaces. */
export const SearchLayoutConfigSchema = z
  .object({
    resultColumns: z.array(fieldName).default([]),
    filterableFields: z.array(fieldName).default([]),
    lookupDisplayFields: z.array(fieldName).default([]),
  })
  .partial();

/** A named, ordered group of fields a rendering surface can request by apiName. */
export const FieldSetConfigSchema = z.object({
  apiName: z.string().min(1),
  label: z.string().min(1),
  fields: z.array(fieldName).default([]),
});

export const ObjectLayoutConfigSchema = z
  .object({
    searchLayout: SearchLayoutConfigSchema.optional(),
    fieldSets: z
      .array(FieldSetConfigSchema)
      .default([])
      .superRefine((sets, ctx) => {
        const seen = new Set<string>();
        for (const set of sets) {
          if (seen.has(set.apiName)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `duplicate field set apiName "${set.apiName}"`,
              path: [set.apiName],
            });
          }
          seen.add(set.apiName);
        }
      }),
  })
  .partial();

export type SearchLayoutConfig = z.infer<typeof SearchLayoutConfigSchema>;
export type FieldSetConfig = z.infer<typeof FieldSetConfigSchema>;
export type ObjectLayoutConfig = z.infer<typeof ObjectLayoutConfigSchema>;

/** Default-applied shape returned by the read adapter for every object. */
export interface ResolvedObjectLayout {
  searchLayout: {
    resultColumns: string[];
    filterableFields: string[];
    lookupDisplayFields: string[];
  };
  fieldSets: FieldSetConfig[];
}

/**
 * Validate an object's layout config. Throws BadRequestException with a
 * field-level message on the first violation. No-op when absent.
 */
export function validateObjectLayoutConfig(input: unknown): void {
  if (input == null) return;
  const result = ObjectLayoutConfigSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.join('.') || 'layoutConfig';
    throw new BadRequestException(
      `Invalid object layout config at "${path}": ${first?.message ?? 'validation failed'}`,
    );
  }
}

/**
 * Read adapter (design FD2 spirit). Returns the normalized, default-applied
 * layout for the rendering surfaces. Never throws — legacy/absent config falls
 * back to empty defaults (validation happens on write).
 */
export function readObjectLayoutConfig(object: {
  layoutConfig?: unknown;
}): ResolvedObjectLayout {
  const parsed = ObjectLayoutConfigSchema.safeParse(object.layoutConfig ?? {});
  const cfg: ObjectLayoutConfig = parsed.success ? parsed.data : {};
  return {
    searchLayout: {
      resultColumns: cfg.searchLayout?.resultColumns ?? [],
      filterableFields: cfg.searchLayout?.filterableFields ?? [],
      lookupDisplayFields: cfg.searchLayout?.lookupDisplayFields ?? [],
    },
    fieldSets: cfg.fieldSets ?? [],
  };
}
