import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrometheusClient } from './PrometheusClient';

interface Seen {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, string>;
}

// A fake Prometheus-compatible API that records each request and answers
// with whatever the test set for that path.
async function withApi(
  answers: Record<string, { status?: number; body: unknown }>,
  test: (baseUrl: string, seen: Seen[]) => Promise<void>,
  prefix = '',
) {
  const seen: Seen[] = [];
  const app = express().use(express.urlencoded({ extended: false }));
  app.post(`${prefix}/api/v1/:endpoint`, (req, res) => {
    const path = req.path.slice(prefix.length);
    seen.push({ path, headers: req.headers, body: req.body });
    const answer = answers[path];
    if (!answer) {
      res.status(404).end();
      return;
    }
    res.status(answer.status ?? 200).json(answer.body);
  });
  const server: Server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const { port } = server.address() as AddressInfo;
    await test(`http://127.0.0.1:${port}${prefix}`, seen);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

const vector = (value: string) => ({
  status: 'success',
  data: { resultType: 'vector', result: [{ metric: {}, value: [1700000000, value] }] },
});
const emptyVector = { status: 'success', data: { resultType: 'vector', result: [] } };
const matrix = {
  status: 'success',
  data: {
    resultType: 'matrix',
    result: [{ metric: {}, values: [[100, '1'], [130, 'NaN'], [160, '2.5']] }],
  },
};

describe('PrometheusClient', () => {
  it('sends no X-Scope-OrgID without a tenant (plain Prometheus)', async () => {
    await withApi({ '/api/v1/query': { body: vector('3') } }, async (baseUrl, seen) => {
      await new PrometheusClient(baseUrl).queryScalar('up');
      expect(seen[0].headers['x-scope-orgid']).toBeUndefined();
      expect(seen[0].headers['content-type']).toBe('application/x-www-form-urlencoded');
    });
  });

  it('sends X-Scope-OrgID with a tenant (Mimir), on query and query_range', async () => {
    await withApi(
      { '/api/v1/query': { body: vector('3') }, '/api/v1/query_range': { body: matrix } },
      async (baseUrl, seen) => {
        const client = new PrometheusClient(baseUrl, { tenant: 'platform' });
        await client.queryScalar('up');
        await client.queryRange('up', 100, 160, 30);
        expect(seen.map(s => s.headers['x-scope-orgid'])).toEqual(['platform', 'platform']);
      },
    );
  });

  it('appends /api/v1/... to a base URL with a path prefix, like Mimir /prometheus', async () => {
    await withApi(
      { '/api/v1/query': { body: vector('3') } },
      async (baseUrl, seen) => {
        await new PrometheusClient(`${baseUrl}/`, { tenant: 'platform' }).queryScalar('up');
        expect(seen.map(s => s.path)).toEqual(['/api/v1/query']);
      },
      '/prometheus',
    );
  });

  it('parses an instant query: the first sample, or null when there is none', async () => {
    await withApi({ '/api/v1/query': { body: vector('0.25') } }, async (baseUrl, seen) => {
      expect(await new PrometheusClient(baseUrl).queryScalar('x')).toBe(0.25);
      expect(seen[0].body).toEqual({ query: 'x' });
    });
    await withApi({ '/api/v1/query': { body: emptyVector } }, async baseUrl => {
      expect(await new PrometheusClient(baseUrl).queryScalar('x')).toBeNull();
    });
    await withApi({ '/api/v1/query': { body: vector('NaN') } }, async baseUrl => {
      expect(await new PrometheusClient(baseUrl).queryScalar('x')).toBeNull();
    });
  });

  it('parses a range query, dropping non-finite steps', async () => {
    await withApi({ '/api/v1/query_range': { body: matrix } }, async (baseUrl, seen) => {
      const points = await new PrometheusClient(baseUrl).queryRange('x', 100, 160, 30);
      expect(points).toEqual([
        [100, 1],
        [160, 2.5],
      ]);
      expect(seen[0].body).toEqual({ query: 'x', start: '100', end: '160', step: '30' });
    });
  });

  it('throws on an HTTP error and on an error response body', async () => {
    await withApi(
      { '/api/v1/query': { status: 401, body: { status: 'error', error: 'no org id' } } },
      async baseUrl => {
        await expect(new PrometheusClient(baseUrl).queryScalar('x')).rejects.toThrow('401');
      },
    );
    await withApi(
      { '/api/v1/query': { body: { status: 'error', error: 'bad query' } } },
      async baseUrl => {
        await expect(new PrometheusClient(baseUrl).queryScalar('x')).rejects.toThrow('bad query');
      },
    );
  });
});
