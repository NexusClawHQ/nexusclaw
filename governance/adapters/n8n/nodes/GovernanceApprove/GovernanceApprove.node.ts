import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  INodeProperties,
} from 'n8n-workflow';

/**
 * Governance Approve — decide a pending L2/L3 approval on the
 * agent-governance sidecar. APPROVED returns the gated execution to
 * `running` (the caller then executes the tool and completes it);
 * REJECTED cancels the execution.
 */
export class GovernanceApprove implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Governance Approve',
    name: 'governanceApprove',
    icon: 'file:governance-approve.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["decision"]}}',
    description: 'Approve or reject a pending governance approval',
    defaults: { name: 'Governance Approve' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'governanceApi',
        required: true,
      },
    ],
    properties: [
      {
        name: 'approvalId',
        displayName: 'Approval ID',
        type: 'string',
        required: true,
        default: '',
        placeholder: '={{ $json.approvalId }}',
        description: 'Pending approval instance to decide',
      },
      {
        name: 'decision',
        displayName: 'Decision',
        type: 'options',
        options: [
          { name: 'Approved', value: 'APPROVED' },
          { name: 'Rejected', value: 'REJECTED' },
        ],
        required: true,
        default: 'APPROVED',
      },
      {
        name: 'comment',
        displayName: 'Comment',
        type: 'string',
        default: '',
        description: 'Optional decision comment recorded on the audit trail',
      },
    ] satisfies INodeProperties[],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const credentials = await this.getCredentials('governanceApi');
      const baseUrl = String(credentials.baseUrl ?? '').replace(/\/$/, '');
      const approvalId = this.getNodeParameter('approvalId', i) as string;
      const decision = this.getNodeParameter('decision', i) as 'APPROVED' | 'REJECTED';
      const comment = this.getNodeParameter('comment', i, '') as string;

      const response = await this.helpers.httpRequest({
        method: 'POST',
        url: `${baseUrl}/approvals/${encodeURIComponent(approvalId)}/decide`,
        body: { decision, comment: comment || undefined },
        json: true,
      });

      returnData.push({
        json: {
          instanceId: response.instanceId,
          decision: response.decision,
          executionId: response.executionId,
          executionStatus: response.executionStatus,
        },
        pairedItem: { item: i },
      });
    }

    return [returnData];
  }
}
