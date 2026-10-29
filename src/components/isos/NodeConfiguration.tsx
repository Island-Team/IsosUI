import React, { useEffect, useState } from 'react';
import type { IsosDiagnostic, IsosNode, IsosProfile, IsosSettingField } from '@/services/isos/config-manager';
import type { Language } from '@/types';

interface NodeConfigurationProps {
  node: IsosNode;
  profile?: IsosProfile;
  lang: Language;
  onUpdate: (change: Partial<IsosNode>) => void;
  onRename: (id: string) => string | null;
  onRemove: () => void;
  diagnostics: IsosDiagnostic[];
}

const LABELS = {
  en: { id: 'Node ID', kind: 'Kind', role: 'Role', enabled: 'Enabled', owned: 'Managed by IsOS', pkg: 'Package', version: 'Version', launch: 'Launch command (one argument per line)', ready: 'Ready TCP', timeout: 'Timeout (ms)', env: 'Environment JSON', contract: 'Contract', settings: 'Settings', advanced: 'Advanced settings JSON', applyJson: 'Apply JSON', remove: 'Remove node', invalid: 'Settings must be a JSON object.', invalidEnv: 'Environment must be a JSON object of strings.', invalidNumber: 'Enter a valid number.', duplicate: 'Node ID must be unique and use lowercase letters, numbers, or hyphens.' },
  cn: { id: '节点 ID', kind: '类型', role: '角色', enabled: '启用', owned: '由 IsOS 管理', pkg: '软件包', version: '版本', launch: '启动命令（每行一个参数）', ready: '就绪 TCP', timeout: '超时（毫秒）', env: '环境变量 JSON', contract: '契约', settings: '设置', advanced: '高级设置 JSON', applyJson: '应用 JSON', remove: '删除节点', invalid: '设置必须是 JSON 对象。', invalidEnv: '环境变量必须是字符串组成的 JSON 对象。', invalidNumber: '请输入有效数字。', duplicate: '节点 ID 必须唯一，且仅能使用小写字母、数字和连字符。' },
} as const;
const FIELD_CN: Record<string, string> = { host: '主机', grpc_port: 'gRPC 端口', grpc_uds_path: 'gRPC 套接字路径', north_http_port: 'HTTP 端口', north_http_url: 'HTTP 地址', binding_backend: '绑定后端', binding_profile: '绑定配置', socket_path: '套接字路径', 'server.host': '服务主机', 'server.port': '服务端口', 'server.status_frequency_hz': '状态频率', 'gateway.transport': '网关传输方式', 'gateway.host': '网关主机', 'gateway.grpc_port': '网关 gRPC 端口', 'gateway.path': '网关路径' };

export function getSetting(settings: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>)[segment] : undefined, settings);
}

export function setSetting(settings: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.');
  const result: Record<string, unknown> = { ...settings };
  let cursor = result;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    cursor[part] = next && typeof next === 'object' && !Array.isArray(next) ? { ...(next as Record<string, unknown>) } : {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return result;
}

function fieldValue(value: unknown): string { return value === undefined || value === null ? '' : String(value); }

function SettingControl({ field, node, lang, onUpdate, issue }: { field: IsosSettingField; node: IsosNode; lang: Language; onUpdate: (change: Partial<IsosNode>) => void; issue?: string }): React.ReactElement {
  const value = getSetting(node.settings || {}, field.path) ?? (field.read_only ? field.default : undefined);
  const [draft, setDraft] = useState(fieldValue(value));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(fieldValue(value)); setError(''); }, [value, field.path]);
  const label = lang === 'cn' ? FIELD_CN[field.path] || field.label || field.path : field.label || field.path;
  const update = (next: unknown): void => onUpdate({ settings: setSetting(node.settings || {}, field.path, next) });
  const commit = (): void => {
    if (field.read_only) return;
    if (field.type === 'integer' || field.type === 'number') {
      const number = Number(draft);
      if (!draft.trim() || !Number.isFinite(number) || (field.type === 'integer' && !Number.isInteger(number)) || (field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) { setError(LABELS[lang].invalidNumber); return; }
      update(number);
    } else update(draft);
    setError('');
  };
  return <label className="isos-config__field"><span>{label}{field.required ? ' *' : ''}</span>
    {field.type === 'boolean' ? <input type="checkbox" checked={Boolean(value)} disabled={field.read_only} onChange={(event) => update(event.target.checked)} />
      : field.options?.length ? <select value={draft} disabled={field.read_only} onChange={(event) => { setDraft(event.target.value); update(event.target.value); }}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      : <input type={field.type === 'integer' || field.type === 'number' ? 'number' : 'text'} value={draft} disabled={field.read_only} min={field.min} max={field.max} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />}
    {field.description && <small>{field.description}</small>}{(error || issue) && <small className="isos-config__error" role="alert">{error || issue}</small>}
  </label>;
}

/** Edit graph-owned node fields while keeping adapter-derived settings typed. */
export function NodeConfiguration({ node, profile, lang, onUpdate, onRename, onRemove, diagnostics }: NodeConfigurationProps): React.ReactElement {
  const copy = LABELS[lang];
  const [id, setId] = useState(node.id);
  const [settingsJson, setSettingsJson] = useState(JSON.stringify(node.settings || {}, null, 2));
  const [envJson, setEnvJson] = useState(JSON.stringify(node.launch?.env || {}, null, 2));
  const [error, setError] = useState('');
  useEffect(() => { setId(node.id); setError(''); }, [node.id]);
  useEffect(() => { setSettingsJson(JSON.stringify(node.settings || {}, null, 2)); }, [node.settings]);
  useEffect(() => { setEnvJson(JSON.stringify(node.launch?.env || {}, null, 2)); }, [node.launch?.env]);
  const launch = node.launch || { command: [], timeout_ms: 30000 };
  const updateLaunch = (change: Partial<NonNullable<IsosNode['launch']>>): void => onUpdate({ launch: { ...launch, ...change } });
  const updatePackage = (id: string, version: string): void => onUpdate({ package: id || version ? { id, version } : undefined });
  const commitId = (): void => { if (id !== node.id) { const issue = onRename(id.trim()); setError(issue ? copy.duplicate : ''); } };
  const commitEnv = (): void => {
    try {
      const parsed: unknown = JSON.parse(envJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some((value) => typeof value !== 'string')) throw new Error();
      updateLaunch({ env: parsed as Record<string, string> }); setError('');
    } catch { setError(copy.invalidEnv); }
  };
  const commitSettings = (): void => {
    try {
      const parsed: unknown = JSON.parse(settingsJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      onUpdate({ settings: parsed as Record<string, unknown> }); setError('');
    } catch { setError(copy.invalid); }
  };
  return <div className="isos-config">
    <div className="isos-config__summary"><strong>{node.id}</strong><span>{profile?.description || profile?.label || node.profile?.id || node.kind}</span></div>
    <label>{copy.id}<input value={id} onChange={(event) => setId(event.target.value.toLowerCase())} onBlur={commitId} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
    <div className="isos-config__row"><span>{copy.kind}: {node.kind}</span>{node.role && <span>{copy.role}: {node.role}</span>}</div>
    <label className="isos-config__check"><input type="checkbox" checked={node.enabled !== false} onChange={(event) => onUpdate({ enabled: event.target.checked })} />{copy.enabled}</label>
    {node.kind !== 'endpoint' && <label className="isos-config__check"><input type="checkbox" checked={node.owned !== false} onChange={(event) => onUpdate({ owned: event.target.checked })} />{copy.owned}</label>}
    {node.kind !== 'endpoint' && <details className="isos-config__section"><summary>{copy.pkg}</summary><div><label>{copy.pkg}<input value={node.package?.id || ''} onChange={(event) => updatePackage(event.target.value, node.package?.version || '')} /></label><label>{copy.version}<input value={node.package?.version || ''} onChange={(event) => updatePackage(node.package?.id || '', event.target.value)} /></label></div></details>}
    {node.kind !== 'endpoint' && node.kind !== 'skill' && <details className="isos-config__section"><summary>{copy.launch}</summary><div><label>{copy.launch}<textarea rows={3} value={launch.command.join('\n')} onChange={(event) => updateLaunch({ command: event.target.value.split('\n').filter(Boolean) })} /></label><label>{copy.ready}<input value={launch.ready_tcp || ''} disabled={Boolean(node.role)} onChange={(event) => updateLaunch({ ready_tcp: event.target.value })} /></label><label>{copy.timeout}<input type="number" min={1} value={launch.timeout_ms ?? 30000} onChange={(event) => updateLaunch({ timeout_ms: Number(event.target.value) })} /></label><label>{copy.env}<textarea rows={3} value={envJson} onChange={(event) => setEnvJson(event.target.value)} onBlur={commitEnv} /></label></div></details>}
    {node.contract !== undefined && <label>{copy.contract}<input value={node.contract} onChange={(event) => onUpdate({ contract: event.target.value })} /></label>}
    <details className="isos-config__section" open><summary>{copy.settings}</summary><div>{profile?.settings_fields?.map((field) => <SettingControl key={field.path} field={field} node={node} lang={lang} onUpdate={onUpdate} issue={diagnostics.find((item) => item.path.endsWith(`/settings/${field.path.replace(/\./g, '/')}`))?.message} />)}
      <details><summary>{copy.advanced}</summary><textarea rows={8} value={settingsJson} onChange={(event) => setSettingsJson(event.target.value)} /><button type="button" onClick={commitSettings}>{copy.applyJson}</button></details></div></details>
    {error && <p className="isos-config__error" role="alert">{error}</p>}
    <button type="button" className="isos-config__remove" onClick={onRemove}>{copy.remove}</button>
  </div>;
}
