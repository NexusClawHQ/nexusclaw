import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  INodeProperties,
} from 'n8n-workflow';

/**
 * Governance Gate — gate any tool call through the agent-governance sidecar.
 *
 * Output json carries the decision; route downstream nodes on
 * `{{ $json.decision }}`:
 *   allow   -> run the real tool, then POST /gate/:id/complete
 *   paused  -> an approval is waiting (approvalId); pair with the
 *              Governance Approve node
 *   blocked -> deny by default (not granted) or an L4 rule
 */
export class GovernanceGate implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Governance Gate',
    name: 'governanceGate',
    icon: 'file:governance-gate.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["toolName"]}}',
    description: 'Gate a tool call: deny by default, L0-L4 guardrails, L2/L3 human approval',
    defaults: { name: 'Governance Gate' },
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
        name: 'toolName',
        displayName: 'Tool Name',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'crm.update_customer',
        description: 'The tool the agent wants to invoke; grants live server-side',
      },
      {
        name: 'toolInput',
        displayName: 'Tool Input (JSON)',
        type: 'json',
        default: '={}',
        description: 'Input payload of the gated tool call',
      },
    ] satisfies INodeProperties[],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const credentials = await this.getCredentials('governanceApi');
      const baseUrl = String(credentials.baseUrl ?? '').replace(/\/$/, '');
      const toolName = this.getNodeParameter('toolName', i) as string;
      const toolInput = this.getNodeParameter('toolInput', i, {}) as Record<string, unknown>;

      const response = await this.helpers.httpRequest({
        method: 'POST',
        url: `${baseUrl}/gate`,
        body: { toolName, toolInput },
        json: true,
      });

      returnData.push({
        json: {
          decision: response.decision,
          executionId: response.executionId,
          toolCallId: response.toolCallId,
          approvalId: response.approvalId,
          riskLevel: response.riskLevel,
          reason: response.reason,
          toolName,
        },
        pairedItem: { item: i },
      });
    }

    return [returnData];
  }
}
