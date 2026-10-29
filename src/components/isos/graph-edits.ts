import type { IsosGraph, IsosNode } from '@/services/isos/config-manager';

function listenerAddress(host: string, port: number): string {
  return `${host.includes(':') ? `[${host}]` : host}:${port}`;
}

/** Keep graph-owned listener and readiness values consistent with editable settings. */
export function editGraphNode(graph: IsosGraph, id: string, change: Partial<IsosNode>): IsosGraph {
  const node = graph.nodes.find((item) => item.id === id);
  if (!node) return graph;
  const changed: IsosNode = { ...node, ...change };
  if (changed.role === 'eos') {
    const settings = { ...changed.settings };
    const host = typeof settings.host === 'string' ? settings.host : '127.0.0.1';
    const grpcPort = typeof settings.grpc_port === 'number' ? settings.grpc_port : 16200;
    const httpPort = typeof settings.north_http_port === 'number' ? settings.north_http_port : 16201;
    settings.north_http_url = `http://${listenerAddress(host, httpPort)}`;
    changed.settings = settings;
    if (changed.launch) changed.launch = { ...changed.launch, ready_tcp: listenerAddress(host, grpcPort) };
    return { ...graph, nodes: graph.nodes.map((item) => {
      if (item.id === id) return changed;
      if (item.settings?.sidecar_of === 'eos' && item.launch) return { ...item, launch: { ...item.launch, ready_tcp: listenerAddress(host, httpPort) } };
      return item;
    }) };
  }
  if (changed.role === 'egia') {
    const server = changed.settings?.server;
    const values = server && typeof server === 'object' && !Array.isArray(server) ? server as Record<string, unknown> : {};
    const host = typeof values.host === 'string' ? values.host : '127.0.0.1';
    const port = typeof values.port === 'number' ? values.port : 16100;
    if (changed.launch) changed.launch = { ...changed.launch, ready_tcp: listenerAddress(host, port) };
  }
  return { ...graph, nodes: graph.nodes.map((item) => item.id === id ? changed : item) };
}
