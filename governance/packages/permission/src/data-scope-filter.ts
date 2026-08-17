import type { DataScopeWhereClause } from './interfaces.js';
import { InvalidCustomFilterException } from './errors.js';

/**
 * Data Scope Filter Service
 *
 * Generates parameterized SQL WHERE clauses based on the Agent's
 * dataScopeType configuration. Prevents SQL injection via whitelist
 * field names and parameterized values.
 */
export class DataScopeFilterService {
  // Whitelist of allowed field names for custom filters
  private readonly ALLOWED_FIELDS = new Set([
    'id', 'workspace_id', 'org_node_id', 'created_by', 'owner_id',
    'record_type_id', 'status', 'stage', 'type', 'is_active',
    'created_at', 'updated_at', 'name', 'account_id', 'contact_id',
  ]);

  /**
   * Build a parameterized WHERE clause based on data scope type.
   */
  buildWhereClause(
    dataScopeType: 'all' | 'org_subtree' | 'own' | 'custom',
    options: {
      orgSubtreeIds?: string[];
      userId?: string;
      customFilter?: string;
    },
  ): DataScopeWhereClause {
    switch (dataScopeType) {
      case 'all':
        return { sql: '', params: [] };

      case 'org_subtree':
        return this.buildOrgSubtreeClause(options.orgSubtreeIds || []);

      case 'own':
        return this.buildOwnClause(options.userId || '');

      case 'custom':
        return this.buildCustomClause(options.customFilter || '');

      default:
        return this.buildOwnClause(options.userId || '');
    }
  }

  private buildOrgSubtreeClause(orgSubtreeIds: string[]): DataScopeWhereClause {
    if (orgSubtreeIds.length === 0) {
      return { sql: '1 = 0', params: [] }; // No access if no org nodes
    }
    const placeholders = orgSubtreeIds.map((_, i) => `$${i + 1}`).join(', ');
    return {
      sql: `org_node_id IN (${placeholders})`,
      params: orgSubtreeIds,
    };
  }

  private buildOwnClause(userId: string): DataScopeWhereClause {
    return { sql: 'created_by = $1', params: [userId] };
  }

  /**
   * Parse a simple custom filter expression into parameterized SQL.
   * Supports: field = 'value' AND field = 'value'
   * SQL injection protection via field name whitelist + parameterized values.
   */
  private buildCustomClause(customFilter: string): DataScopeWhereClause {
    if (!customFilter || customFilter.trim() === '') {
      throw new InvalidCustomFilterException('Empty custom filter expression');
    }

    const conditions = customFilter.split(/\s+AND\s+/i);
    const sqlParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const condition of conditions) {
      const match = condition.trim().match(/^(\w+)\s*(=|!=|>|<|>=|<=)\s*'([^']*)'$/);
      if (!match) {
        throw new InvalidCustomFilterException(`Invalid condition syntax: ${condition}`);
      }

      const [, fieldName = '', operator = '', value = ''] = match;

      if (!this.ALLOWED_FIELDS.has(fieldName)) {
        throw new InvalidCustomFilterException(`Field not allowed in custom filter: ${fieldName}`);
      }

      const allowedOps = ['=', '!=', '>', '<', '>=', '<='];
      if (!allowedOps.includes(operator)) {
        throw new InvalidCustomFilterException(`Operator not allowed: ${operator}`);
      }

      sqlParts.push(`${fieldName} ${operator} $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    return { sql: sqlParts.join(' AND '), params };
  }
}
