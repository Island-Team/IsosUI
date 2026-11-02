// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogBrowser, catalogTypeKey } from './CatalogBrowser';
import { CatalogSelector, settingOptionGroup, unavailableSelections } from './CatalogSelector';
import { optionResponseIsCurrent, pairedDeviceSettings } from './catalog-options';
import type { NodeOptions, NodeTypeDefinition, SettingOptionGroup } from '@/services/isos/node-graph';

const group: SettingOptionGroup = { node_path: 'eos/process/mujoco/simulator', setting: 'scene', selected: 'pick-place', options: [
  { value: 'navigation', label: 'Navigation', description: 'Drive to a goal', available: true, reason_code: null, reason: null },
  { value: 'pick-place', label: 'Pick and place', description: 'Saved scene', available: false, reason_code: 'package_changed', reason: 'Relink the exact release' },
] };
const options: NodeOptions = { adapter_families: [], primitive_bindings: [], targets: [], setting_options: [group], graph_revision: null, read_only: false };

describe('P03 catalog options', () => {
  it('uses exact node path and setting, and blocks an unavailable saved ID', () => {
    expect(settingOptionGroup(options, group.node_path, 'scene')).toBe(group);
    expect(settingOptionGroup(options, 'eos/process/mujoco/other', 'scene')).toBeUndefined();
    expect(unavailableSelections(options)).toEqual([group]);
    const html = renderToStaticMarkup(<CatalogSelector group={group} label="Scene" value="pick-place" lang="en" onChange={() => undefined} />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('package_changed Relink the exact release');
    expect(html).toContain('2 options');
    expect(html).toContain('value="pick-place"');
  });

  it('keeps a selected ID visible even if the server omitted its row', () => {
    const html = renderToStaticMarkup(<CatalogSelector group={{ ...group, options: [group.options[0]] }} label="场景" value="old-scene" lang="cn" onChange={() => undefined} />);
    expect(html).toContain('old-scene');
    expect(html).toContain('不可用');
    expect(html).toContain('role="alert"');
  });

  it('moves from search into the native keyboard selector and clears search on Escape', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    await act(async () => { root.render(<CatalogSelector group={group} label="Scene" value="navigation" lang="en" onChange={() => undefined} />); });
    const search = host.querySelector('input')!;
    const select = host.querySelector('select')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'nav'); search.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host.textContent).toContain('1 options');
    await act(async () => { search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(host.textContent).toContain('2 options');
    await act(async () => { search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.activeElement).toBe(select);
    await act(async () => { search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(document.activeElement).toBe(select);
    await act(async () => { root.unmount(); }); host.remove();
  });

  it('discards a delayed response after a newer draft request', async () => {
    let resolveOld!: (value: NodeOptions) => void;
    const old = new Promise<NodeOptions>((resolve) => { resolveOld = resolve; });
    let latest = 1;
    const accepted = vi.fn();
    const pending = old.then((result) => { if (optionResponseIsCurrent(1, latest, 'old draft', 'new draft')) accepted(result); });
    latest = 2;
    resolveOld(options);
    await pending;
    expect(accepted).not.toHaveBeenCalled();
    expect(optionResponseIsCurrent(2, latest, 'new draft', 'new draft')).toBe(true);
  });

  it('updates the two MuJoCo device fields as one draft edit', () => {
    expect(pairedDeviceSettings({ backend: 'eos/process/mujoco/simulator', device_id: 'old', simulator_node: 'different' }, 'base-1')).toEqual({ backend: 'eos/process/mujoco/simulator', device_id: 'base-1', simulator_node: 'base-1' });
  });
});

describe('catalog hierarchy', () => {
  const base: NodeTypeDefinition = { id: 'same@v0.1', core: 'eos', layer: 'hardware', group: 'base', kind: 'base', lifecycle: 'adapter', description: 'Drive a mobile base.', capabilities: [], settings: [], inputs: [], outputs: [] };
  it('keeps the exact core, layer, group and type tuple', () => {
    const other = { ...base, group: 'camera', description: 'Capture frames.' };
    expect(catalogTypeKey(base)).not.toBe(catalogTypeKey(other));
    const html = renderToStaticMarkup(<CatalogBrowser types={[base, other]} value="" lang="en" onChange={() => undefined} />);
    expect(html).toContain('Core');
    expect(html).toContain('Layer');
    expect(html).toContain('Group');
    expect(html).toContain('Node type');
    expect(html).toContain('Search node types');
    expect(renderToStaticMarkup(<CatalogBrowser types={[base]} value="" lang="cn" onChange={() => undefined} />)).toContain('节点类型');
  });
});

afterEach(() => { document.body.innerHTML = ''; });
