import type { ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * Connection to the agent-governance sidecar (base URL + optional bearer
 * token). Test: GET /health.
 */
export class GovernanceApi implements ICredentialType {
  name = 'governanceApi';
  displayName = 'Agent Governance Sidecar';
  documentationUrl = 'https://github.com/NexusClawHQ/nexusclaw';
  properties: INodeProperties[] = [
    {
      name: 'baseUrl',
      displayName: 'Base URL',
      type: 'string',
      default: 'http://127.0.0.1:7899',
      placeholder: 'http://127.0.0.1:7899',
      description: 'Where the agent-governance sidecar listens',
    },
    {
      name: 'token',
      displayName: 'Bearer Token',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Optional bearer token for the sidecar',
    },
  ];

  authenticate = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '={{$credentials.token ? "Bearer " + $credentials.token : undefined}}',
      },
    },
  } as unknown as ICredentialType['authenticate'];

  test: ICredentialType['test'] = {
    request: {
      url: '={{$credentials.baseUrl}}/health',
      method: 'GET',
    },
  };
}
