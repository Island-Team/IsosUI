import React, { useRef } from 'react';
import type { WindowId, WindowMode, WindowPlacement } from './workbench-layout';

interface WorkbenchWindowProps {
  id: WindowId;
  title: string;
  placement: WindowPlacement;
  onChange: (change: Partial<WindowPlacement>) => void;
  onFocus: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

/** A viewport-bound workbench window with pointer and keyboard docking controls. */
export function WorkbenchWindow({ id, title, placement, onChange, onFocus, onClose, children }: WorkbenchWindowProps): React.ReactElement | null {
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const resize = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  if (!placement.open) return null;

  const startDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (placement.mode !== 'float' || (event.target as HTMLElement).closest('.isos-window__actions')) return;
    drag.current = { x: event.clientX, y: event.clientY, left: placement.x, top: placement.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    onFocus();
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    const workspace = event.currentTarget.closest('.isos-manager__workspace') as HTMLElement | null;
    const bounds = workspace?.getBoundingClientRect();
    if (!bounds) return;
    onChange({ x: Math.max(0, Math.min(bounds.width - 80, drag.current.left + event.clientX - drag.current.x)), y: Math.max(0, Math.min(bounds.height - 40, drag.current.top + event.clientY - drag.current.y)) });
  };
  const endDrag = (): void => { drag.current = null; };
  const startResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    resize.current = { x: event.clientX, y: event.clientY, width: placement.width, height: placement.height };
    event.currentTarget.setPointerCapture(event.pointerId);
    onFocus();
  };
  const moveResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!resize.current) return;
    onChange({ width: Math.max(230, resize.current.width + event.clientX - resize.current.x), height: Math.max(160, resize.current.height + event.clientY - resize.current.y) });
  };
  const dock = (mode: WindowMode): void => onChange({ mode, x: mode === 'float' ? 36 : placement.x, y: mode === 'float' ? 72 : placement.y });
  const style: React.CSSProperties = placement.mode === 'float'
    ? { left: placement.x, top: placement.y, width: placement.width, height: placement.collapsed ? 36 : placement.height, zIndex: placement.z }
    : { zIndex: placement.z };

  return <section className={`isos-window isos-window--${placement.mode}${placement.collapsed ? ' isos-window--collapsed' : ''} nodrag nopan`} style={style} aria-label={title} onPointerDown={onFocus}>
    <div className="isos-window__titlebar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <strong>{title}</strong>
      <div className="isos-window__actions">
        <button type="button" title={placement.collapsed ? 'Expand' : 'Collapse'} aria-label={`${title}: ${placement.collapsed ? 'Expand' : 'Collapse'}`} aria-expanded={!placement.collapsed} onClick={() => onChange({ collapsed: !placement.collapsed })}>{placement.collapsed ? '▾' : '▴'}</button>
        <details className="isos-window__dock-menu"><summary title="Window position" aria-label={`${title}: Window position`}>▣</summary><div>
          <button type="button" onClick={() => dock('float')}>Float</button>
          <button type="button" onClick={() => dock('left')}>Dock left</button>
          <button type="button" onClick={() => dock('right')}>Dock right</button>
          <button type="button" onClick={() => dock('bottom')}>Dock bottom</button>
        </div></details>
        <button type="button" title="Close" aria-label={`${title}: Close`} onClick={onClose}>×</button>
      </div>
    </div>
    {!placement.collapsed && <div className="isos-window__body">{children}</div>}
    {placement.mode === 'float' && !placement.collapsed && <div className="isos-window__resize" role="separator" aria-label={`${title}: Resize`} onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={() => { resize.current = null; }} onPointerCancel={() => { resize.current = null; }} />}
  </section>;
}
