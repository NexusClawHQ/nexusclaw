import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { inMemoryUpstream, type Upstream } from './upstream.js';

const TOOLS = [
  {
    name: 'echo',
    description: 'Return the input text unchanged (no side effects).',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'counter',
    description: 'Increment a counter and return the new value.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'send_notice',
    description: 'Send a notice to a customer — L3 risk, pauses for human approval.',
    inputSchema: {
      type: 'object',
      properties: { to: { type: 'string' }, subject: { type: 'string' } },
      required: ['to', 'subject'],
    },
  },
  {
    name: 'danger',
    description: 'Delete arbitrary records — intentionally UNGRANTED (deny-by-default demo).',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
];

/**
 * In-process demo downstream MCP server (`SIDECAR_MCP_DEMO=memory`): four
 * tools covering every governance path — allow (echo/counter), L3 pause
 * (send_notice) and ungranted (danger, hidden from tools/list by default).
 */
export async function buildMemoryDemoUpstream(): Promise<Upstream> {
  let count = 0;
  const notices: string[] = [];
  const server = new Server({ name: 'memory-demo-upstream', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    switch (name) {
      case 'echo':
        return { content: [{ type: 'text', text: `echo:${String((args as { text?: string }).text ?? '')}` }] };
      case 'counter': {
        count += 1;
        return { content: [{ type: 'text', text: `count:${count}` }] };
      }
      case 'send_notice': {
        const { to, subject } = args as { to?: string; subject?: string };
        notices.push(`${to}:${subject}`);
        return { content: [{ type: 'text', text: `notice-sent#${notices.length} to=${to} subject=${subject}` }] };
      }
      case 'danger':
        return { content: [{ type: 'text', text: `deleted:${String((args as { path?: string }).path ?? '')}` }] };
      default:
        throw new Error(`UNKNOWN_TOOL:${name}`);
    }
  });

  return inMemoryUpstream('memory', (transport) => server.connect(transport));
}
