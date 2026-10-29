import { describe, expect, it } from 'vitest';
import type { IsosGraph } from '@/services/isos/config-manager';
import { createGraphNode, editGraphNode } from './graph-edits';
import { getSetting, setSetting } from './NodeConfiguration';

describe('graph settings edits', () => {
  it('creates generic nodes without a built-in profile', () => {
    expect(createGraphNode('worker', undefined, 'service')).toMatchObject({ id: 'worker', kind: 'service', enabled: false, settings: {}, launch: { command: [] } });
    expect(createGraphNode('worker', undefined, 'service').profile).toBeUndefined();
  });
  it('synchronizes EOS listeners and a sidecar when ports change', () => {
    const graph: IsosGraph = { schema_version: 2, name: 'default', edges: [], nodes: [
      { id: 'eos', kind: 'component', role: 'eos', settings: { host: '127.0.0.1', grpc_port: 16200, north_http_port: 16201 }, launch: { command: ['eosd'], ready_tcp: '127.0.0.1:16200' } },
      { id: 'eos-north-http', kind: 'service', settings: { sidecar_of: 'eos' }, launch: { command: ['http'], ready_tcp: '127.0.0.1:16201' } },
    ] };
    const next = editGraphNode(graph, 'eos', { settings: { host: '::1', grpc_port: 17200, north_http_port: 17201 } });
    expect(next.nodes[0].settings?.north_http_url).toBe('http://[::1]:17201');
    expect(next.nodes[0].launch?.ready_tcp).toBe('[::1]:17200');
    expect(next.nodes[1].launch?.ready_tcp).toBe('[::1]:17201');
    expect(graph.nodes[0].launch?.ready_tcp).toBe('127.0.0.1:16200');
  });

  it('synchronizes EGIA readiness from nested server settings', () => {
    const graph: IsosGraph = { schema_version: 2, name: 'default', edges: [], nodes: [{ id: 'egia', kind: 'component', role: 'egia', settings: { server: { host: '127.0.0.1', port: 16100 } }, launch: { command: ['egia'] } }] };
    const next = editGraphNode(graph, 'egia', { settings: setSetting(graph.nodes[0].settings || {}, 'server.port', 17100) });
    expect(next.nodes[0].launch?.ready_tcp).toBe('127.0.0.1:17100');
    expect(getSetting(next.nodes[0].settings || {}, 'server.port')).toBe(17100);
  });

  it('preserves other nested settings when one field changes', () => {
    const original = { server: { host: '127.0.0.1', port: 16100 } };
    const next = setSetting(original, 'server.port', 17100);
    expect(next).toEqual({ server: { host: '127.0.0.1', port: 17100 } });
    expect(original.server.port).toBe(16100);
  });
});
