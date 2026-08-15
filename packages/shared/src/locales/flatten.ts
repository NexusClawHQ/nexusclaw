/**
 * Flatten a nested object into dot-separated keys.
 * e.g. { menu: { crm: { dashboard: '工作台' } } } → { 'menu.crm.dashboard': '工作台' }
 *
 * Used by mobile-h5 to resolve i18nKey strings like 'menu.crm.dashboard'
 * against the same nested translation objects shared with frontend.
 */
export function flattenMessages(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenMessages(value as Record<string, unknown>, fullKey));
    }
  }

  return result;
}
