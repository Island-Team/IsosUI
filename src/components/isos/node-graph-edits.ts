import type { NodeGraph, NodeInstance, NodeSource, NodeTypeDefinition } from '@/services/isos/node-graph';

export interface GraphNode { path: string; node: NodeInstance; definition?: NodeTypeDefinition }
export const nodeIdPattern = /^[a-z][a-z0-9-]{0,47}$/;

export function nodePath(definition: Pick<NodeTypeDefinition, 'core' | 'layer' | 'group'>, id: string): string {
  return `cores/${definition.core}/layers/${definition.layer}/groups/${definition.group}/nodes/${id}`;
}

export function graphNodes(graph: NodeGraph, types: NodeTypeDefinition[]): GraphNode[] {
  const definitions = new Map(types.map((type) => [type.id, type]));
  return Object.entries(graph.cores).flatMap(([coreId, core]) => Object.entries(core.layers).flatMap(([layerId, layer]) =>
    Object.entries(layer.groups).flatMap(([groupId, group]) => Object.entries(group.nodes).map(([id, node]) => ({
      path: `cores/${coreId}/layers/${layerId}/groups/${groupId}/nodes/${id}`,
      node,
      definition: definitions.get(node.node_type),
    })))));
}

function graphCopy(graph: NodeGraph): NodeGraph { return structuredClone(graph); }

function nodeSlot(graph: NodeGraph, path: string): { nodes: Record<string, NodeInstance>; id: string } | undefined {
  const parts = path.split('/');
  if (parts.length !== 8 || parts[0] !== 'cores' || parts[2] !== 'layers' || parts[4] !== 'groups' || parts[6] !== 'nodes') return;
  const nodes = graph.cores[parts[1]]?.layers[parts[3]]?.groups[parts[5]]?.nodes;
  return nodes ? { nodes, id: parts[7] } : undefined;
}

export function makeNode(id: string, definition: NodeTypeDefinition): NodeInstance {
  const node: NodeInstance = { id, node_type: definition.id, label: id, description: '', capabilities: [], settings: {}, inputs: {} };
  if (definition.lifecycle === 'adapter') {
    node.frame_id = `${id}_frame`;
    node.adapter = { type: 'mock-cxx' };
    node.health_timing = { poll_interval_ms: 100, stale_after_ms: 500 };
    node.observation = { max_rate_hz: 30, max_payload_bytes: definition.kind === 'camera' ? 8388608 : 4096 };
    node.capabilities = definition.kind === 'camera' ? ['rgb8'] : [definition.capabilities[0]];
    if (definition.kind === 'manipulator') node.joint_names = ['joint1'];
    if (definition.kind === 'base') node.movement = { modes: ['body_velocity'], limits: { max_linear_m_s: 1, max_angular_rad_s: 1, max_velocity_lease_ms: 500, max_translation_m: 5, max_rotation_rad: 3.14 } };
    if (definition.kind === 'manipulator') node.movement = { modes: ['joint_positions'], limits: { max_joint_position_rad: 3.14, max_joint_speed_rad_s: 1, max_end_effector_speed_m_s: 0.2, max_end_effector_translation_m: 1 } };
  }
  return node;
}

export function addNode(graph: NodeGraph, definition: NodeTypeDefinition, id: string): NodeGraph {
  if (!nodeIdPattern.test(id)) throw new Error('Invalid node ID.');
  if (graphNodes(graph, []).some((entry) => entry.path === nodePath(definition, id))) throw new Error('A node with this ID already exists in this group.');
  if (definition.lifecycle === 'adapter' && graphNodes(graph, []).some((entry) => entry.path.startsWith('cores/eos/layers/hardware/') && entry.node.id === id)) throw new Error('A hardware node with this ID already exists.');
  const next = graphCopy(graph);
  const core = next.cores[definition.core] ||= { layers: {} };
  const layer = core.layers[definition.layer] ||= { groups: {} };
  const group = layer.groups[definition.group] ||= { nodes: {} };
  group.nodes[id] = makeNode(id, definition);
  return next;
}

export function updateNode(graph: NodeGraph, path: string, update: Partial<NodeInstance>): NodeGraph {
  const next = graphCopy(graph);
  const slot = nodeSlot(next, path);
  if (!slot || !slot.nodes[slot.id]) return graph;
  slot.nodes[slot.id] = { ...slot.nodes[slot.id], ...update, id: slot.id, node_type: slot.nodes[slot.id].node_type };
  return next;
}

export function removeNode(graph: NodeGraph, path: string): NodeGraph {
  const next = graphCopy(graph);
  const slot = nodeSlot(next, path);
  if (!slot || !slot.nodes[slot.id]) return graph;
  delete slot.nodes[slot.id];
  for (const entry of graphNodes(next, [])) {
    entry.node.inputs = Object.fromEntries(Object.entries(entry.node.inputs || {}).filter(([, source]) => source.node !== path));
    entry.node.references = entry.node.references?.filter((reference) => reference !== path);
  }
  const parts = path.split('/');
  const core = next.cores[parts[1]];
  const layer = core.layers[parts[3]];
  const group = layer.groups[parts[5]];
  if (!Object.keys(group.nodes).length) delete layer.groups[parts[5]];
  if (!Object.keys(layer.groups).length) delete core.layers[parts[3]];
  if (!Object.keys(core.layers).length) delete next.cores[parts[1]];
  return next;
}

export function renameNode(graph: NodeGraph, path: string, id: string): NodeGraph {
  if (!nodeIdPattern.test(id)) throw new Error('Invalid node ID.');
  const next = graphCopy(graph);
  const slot = nodeSlot(next, path);
  if (!slot || !slot.nodes[slot.id]) return graph;
  if (slot.nodes[id] && id !== slot.id) throw new Error('A node with this ID already exists in this group.');
  const old = slot.nodes[slot.id];
  delete slot.nodes[slot.id];
  slot.nodes[id] = { ...old, id };
  const newPath = `${path.slice(0, path.lastIndexOf('/') + 1)}${id}`;
  for (const entry of graphNodes(next, [])) {
    for (const source of Object.values(entry.node.inputs || {})) if (source.node === path) source.node = newPath;
    entry.node.references = entry.node.references?.map((reference) => reference === path ? newPath : reference);
  }
  return next;
}

export function connectNodes(graph: NodeGraph, types: NodeTypeDefinition[], providerPath: string, output: string, consumerPath: string, input: string): NodeGraph {
  const nodes = graphNodes(graph, types);
  const provider = nodes.find((entry) => entry.path === providerPath);
  const consumer = nodes.find((entry) => entry.path === consumerPath);
  if (!provider || !consumer || providerPath === consumerPath) throw new Error('Choose two different nodes.');
  const outputType = provider.definition?.outputs.find((port) => port.name === output)?.data_type;
  const inputType = consumer.definition?.inputs.find((port) => port.name === input)?.data_type;
  if (!outputType || !inputType || outputType !== inputType) throw new Error('Ports must have the same data type.');
  if (consumer.node.inputs?.[input]) throw new Error('This input already has a provider.');
  const next = graphCopy(graph);
  const slot = nodeSlot(next, consumerPath)!;
  const target = slot.nodes[slot.id];
  const source: NodeSource = { node: providerPath, output };
  target.inputs = { ...target.inputs, [input]: source };
  return next;
}

export function disconnectInput(graph: NodeGraph, consumerPath: string, input: string): NodeGraph {
  const next = graphCopy(graph);
  const slot = nodeSlot(next, consumerPath);
  if (!slot || !slot.nodes[slot.id]?.inputs?.[input]) return graph;
  delete slot.nodes[slot.id].inputs![input];
  return next;
}
