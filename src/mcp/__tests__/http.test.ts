import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startServer, stopServer, getPort } from '../../bridge/ws-server.js';
import { createAnnotation, getAnnotation } from '../../bridge/store.js';
import { createMcpHttpHandler } from '../http.js';

const TOKEN = 'ilse_test_token';
const claimed: string[][] = [];
const resolved: string[] = [];

function text(result: unknown): string {
  return ((result as { content: Array<{ text: string }> }).content[0]).text;
}

async function client(token: string) {
  const c = new Client({ name: 'test', version: '0' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${getPort()}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }));
  return c;
}

describe('MCP over HTTP', () => {
  beforeAll(async () => {
    await startServer({
      port: 4761,
      httpHandler: createMcpHttpHandler({
        version: 'test',
        token: TOKEN,
        hooks: { onClaim: (a) => claimed.push(a.map(x => x.id)), onResolved: (a) => resolved.push(a.id) },
      }),
    });
  });
  afterAll(() => stopServer());

  it('rejects requests without the token', async () => {
    const res = await fetch(`http://127.0.0.1:${getPort()}/mcp`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
    await expect(client('wrong')).rejects.toThrow();
  });

  it('lists tools and carries Ilse instructions', async () => {
    const c = await client(TOKEN);
    const { tools } = await c.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(['ilse_changes', 'ilse_get_annotation', 'ilse_list_annotations', 'ilse_resolve', 'ilse_watch']);
    expect(c.getInstructions()).toContain('Source');
    const { prompts } = await c.listPrompts();
    expect(prompts.map(p => p.name)).toEqual(['watch']);
    const prompt = await c.getPrompt({ name: 'watch' });
    expect(JSON.stringify(prompt.messages)).toContain('ilse_watch');
    await c.close();
  });

  it('claims pending annotations once and resolves them', async () => {
    const a = createAnnotation({ note: 'mais respiro', element: 'button.cta', styles: {}, intent: 'fix' });
    const c = await client(TOKEN);

    const first = text(await c.callTool({ name: 'ilse_list_annotations', arguments: {} }));
    expect(first).toContain(a.id);
    expect(first).toContain('mais respiro');
    expect(getAnnotation(a.id)?.status).toBe('sent');
    expect(claimed).toEqual([[a.id]]);

    // Already claimed: a second agent gets nothing
    expect(text(await c.callTool({ name: 'ilse_list_annotations', arguments: {} }))).toContain('No pending');

    expect(text(await c.callTool({ name: 'ilse_resolve', arguments: { id: a.id, summary: 'padding 16px' } }))).toContain('resolved');
    expect(getAnnotation(a.id)?.status).toBe('resolved');
    expect(resolved).toEqual([a.id]);
    await c.close();
  });

  it('watch returns annotations that arrive while waiting', async () => {
    const c = await client(TOKEN);
    const pending = c.callTool({ name: 'ilse_watch', arguments: { timeoutSeconds: 10 } });
    setTimeout(() => createAnnotation({ note: 'cor errada', element: 'h1', styles: {}, intent: 'fix' }), 100);
    expect(text(await pending)).toContain('cor errada');
    await c.close();
  }, 15000);
});
