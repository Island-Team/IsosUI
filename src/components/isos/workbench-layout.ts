export const WINDOW_IDS = ['library', 'config', 'connections', 'diagnostics', 'eos', 'egia', 'minimap'] as const;
export type WindowId = typeof WINDOW_IDS[number];
export type WindowMode = 'float' | 'left' | 'right' | 'bottom';

export interface WindowPlacement {
  open: boolean;
  collapsed: boolean;
  mode: WindowMode;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}

export type WorkbenchLayout = Record<WindowId, WindowPlacement>;
const STORAGE_KEY = 'isos-workbench-layout-v1';

export function defaultLayout(): WorkbenchLayout {
  return {
    library: { open: true, collapsed: false, mode: 'float', x: 18, y: 68, width: 290, height: 420, z: 2 },
    config: { open: false, collapsed: false, mode: 'right', x: 0, y: 0, width: 370, height: 550, z: 3 },
    connections: { open: false, collapsed: false, mode: 'bottom', x: 0, y: 0, width: 430, height: 260, z: 4 },
    diagnostics: { open: false, collapsed: false, mode: 'bottom', x: 0, y: 0, width: 430, height: 240, z: 5 },
    eos: { open: false, collapsed: false, mode: 'right', x: 0, y: 0, width: 340, height: 300, z: 6 },
    egia: { open: false, collapsed: false, mode: 'right', x: 0, y: 0, width: 340, height: 300, z: 7 },
    minimap: { open: false, collapsed: false, mode: 'float', x: 24, y: 470, width: 240, height: 180, z: 1 },
  };
}

export function loadLayout(): WorkbenchLayout {
  const fallback = defaultLayout();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    for (const id of WINDOW_IDS) {
      const value = (stored as Record<string, unknown>)[id];
      if (!value || typeof value !== 'object') return fallback;
      const item = value as Record<string, unknown>;
      if (typeof item.open !== 'boolean' || !['float', 'left', 'right', 'bottom'].includes(String(item.mode))) return fallback;
      if (['x', 'y', 'width', 'height', 'z'].some((key) => !Number.isFinite(item[key]) || Number(item[key]) < 0)) return fallback;
      fallback[id] = { open: item.open, collapsed: item.collapsed === true, mode: item.mode as WindowMode, x: Number(item.x), y: Number(item.y), width: Number(item.width), height: Number(item.height), z: Number(item.z) };
    }
  } catch { return defaultLayout(); }
  return fallback;
}

export function saveLayout(layout: WorkbenchLayout): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* Layout can remain session-only. */ }
}
