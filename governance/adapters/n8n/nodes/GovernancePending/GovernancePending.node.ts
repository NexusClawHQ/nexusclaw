import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

/**
 * Governance Pending — list pending L2/L3 approvals on the
 * agent-governance sidecar. One output item per approval, carrying the
 * paused tool call (toolName / riskLevel / toolInput) and executionId.
 */
export class GovernancePending implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Governance Pending Approvals',
    name: 'governancePending',
    icon: 'file:governance-pending.svg',
    group: ['transform'],
    version: 1,
    description: 'List approvals waiting for a human decision',
    defaults: { name: 'Governance Pending' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'governanceApi',
        required: true,
      },
    ],
    properties: [],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('governanceApi');
    const baseUrl = String(credentials.baseUrl ?? '').replace(/\/$/, '');

    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: `${baseUrl}/approvals/pending`,
      json: true,
    });

    const approvals = (response.approvals ?? []) as Array<Record<string, unknown>>;
    return [
      approvals.map((approval, index) => ({
        json: {
          id: String(approval.id ?? ''),
          executionId: String(approval.executionId ?? ''),
          submittedAt: String(approval.submittedAt ?? ''),
          pausedToolCall: approval.pausedToolCall as unknown as Record<string, unknown>,
        },
        pairedItem: { item: index },
      })),
    ];
  }
}
