import { createHash } from 'node:crypto';
import type { IFieldMaskRule, PartialMaskConfig, HashMaskConfig, RangeMaskConfig } from './interfaces.js';

/**
 * Field Masking Service
 *
 * Pure-function masking engine: applies mask rules to record arrays
 * without mutating the input. Supports hide/partial/hash/range types.
 */
export class FieldMaskingService {
  /**
   * Apply mask rules to an array of records.
   * Returns a new array — input is never modified.
   */
  applyMasks(records: Record<string, any>[], rules: IFieldMaskRule[], objectApiName: string): Record<string, any>[] {
    const applicableRules = rules.filter(r => r.objectApiName === objectApiName);
    if (applicableRules.length === 0) return records;

    return records.map(record => {
      const masked = { ...record };
      for (const rule of applicableRules) {
        if (!(rule.fieldApiName in masked)) continue;

        switch (rule.maskType) {
          case 'hide':
            delete masked[rule.fieldApiName];
            break;
          case 'partial':
            masked[rule.fieldApiName] = this.applyPartialMask(
              masked[rule.fieldApiName],
              rule.maskConfig as PartialMaskConfig,
            );
            break;
          case 'hash':
            masked[rule.fieldApiName] = this.applyHashMask(
              masked[rule.fieldApiName],
              rule.maskConfig as HashMaskConfig,
            );
            break;
          case 'range':
            masked[rule.fieldApiName] = this.applyRangeMask(
              masked[rule.fieldApiName],
              rule.maskConfig as RangeMaskConfig,
            );
            break;
        }
      }
      return masked;
    });
  }

  /** Partial mask: keep prefix + mask middle + keep suffix */
  applyPartialMask(value: any, config: PartialMaskConfig): string {
    if (value == null || value === '') return value ?? '';
    const str = String(value);
    const maskChar = config.maskChar || '*';
    const prefixLen = Math.max(0, config.prefixLength || 0);
    const suffixLen = Math.max(0, config.suffixLength || 0);

    if (str.length <= prefixLen + suffixLen) {
      return maskChar.repeat(str.length);
    }

    const prefix = str.slice(0, prefixLen);
    const suffix = str.slice(str.length - suffixLen);
    const middleLen = str.length - prefixLen - suffixLen;
    return prefix + maskChar.repeat(middleLen) + suffix;
  }

  /** Hash mask: SHA-256 or MD5, optionally truncated */
  applyHashMask(value: any, config: HashMaskConfig): string {
    if (value == null || value === '') return '';
    const algorithm = config.algorithm === 'md5' ? 'md5' : 'sha256';
    const hash = createHash(algorithm).update(String(value)).digest('hex');
    return config.truncateLength ? hash.slice(0, config.truncateLength) : hash;
  }

  /** Range mask: bucket numeric values into ranges */
  applyRangeMask(value: any, config: RangeMaskConfig): string {
    if (value == null) return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    const bucket = config.bucketSize || 1;
    const lower = Math.floor(num / bucket) * bucket;
    const upper = lower + bucket;
    const unit = config.unit || '';
    return `${lower}-${upper}${unit}`;
  }
}
