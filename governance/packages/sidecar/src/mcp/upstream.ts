import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/** A tool as advertised by a downstream MCP server. */
export interface UpstreamTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface UpstreamCallResult {
  content: Array<Record<string, unknown>>;
  isError?: boolean;
}

/**
 * A downstream MCP server the gateway fronts. Agents never talk to these
 * directly — every call goes through the governance gate first.
 */
export interface Upstream {
  readonly name: string;
  listTools(): Promise<UpstreamTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<UpstreamCallResult>;
  close(): Promise<void>;
}

class ClientUpstream implements Upstream {
  constructor(
    readonly name: string,
    private readonly client: Client,
  ) {}

  async listTools(): Promise<UpstreamTool[]> {
    const result = await this.client.listTools();
    return (result.tools ?? []).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<UpstreamCallResult> {
    const result = await this.client.callTool({ name, arguments: args });
    return {
      content: (result.content ?? []) as Array<Record<string, unknown>>,
      isError: result.isError === true,
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

/** Connect to an in-process MCP server over linked in-memory transports. */
export async function inMemoryUpstream(
  name: string,
  connectServer: (transport: Transport) => Promise<unknown>,
): Promise<Upstream> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await connectServer(serverTransport);
  const client = new Client({ name: 'agent-governance-gateway', version: '0.1.0' });
  await client.connect(clientTransport);
  return new ClientUpstream(name, client);
}

/** Connect to a Streamable-HTTP downstream MCP server. */
export async function httpUpstream(name: string, url: string, token?: string): Promise<Upstream> {
  const transport = new StreamableHTTPClientTransport(
    new URL(url),
    token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : {},
  );
  const client = new Client({ name: 'agent-governance-gateway', version: '0.1.0' });
  await client.connect(transport);
  return new ClientUpstream(name, client);
}

/** Parse `SIDECAR_MCP_UPSTREAMS` (`name|url[|token]`, comma-separated). */
export function parseUpstreamEnv(raw: string | undefined): Array<{ name: string; url: string; token?: string }> {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url, token] = entry.split('|').map((part) => part?.trim());
      if (!name || !url) throw new Error(`SIDECAR_MCP_UPSTREAMS entry must be name|url[|token]: ${entry}`);
      return { name, url, token };
    });
}
