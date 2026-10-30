import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IsosHome } from '@/components/isos/IsosHome';
import '@/components/isos/workbench.scss';
import type { Language } from '@/types';
import '@/styles/fonts.css';
import '@/styles/global.scss';

const NodeGraphManager = lazy(async () => ({ default: (await import('@/components/isos/NodeGraphManager')).NodeGraphManager }));
const EosWorkbench = lazy(async () => ({ default: (await import('@/components/isos/EosWorkbench')).EosWorkbench }));

const theme = localStorage.getItem('island-theme');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const rootElement = document.documentElement;
rootElement.dataset.theme = theme === 'light' || theme === 'dark' ? theme : systemTheme.matches ? 'dark' : 'light';
const accent = localStorage.getItem('island-accent');
rootElement.dataset.accent = ['teal', 'pink', 'green', 'blue', 'violet', 'amber'].includes(accent || '') ? accent! : 'teal';
if (theme !== 'light' && theme !== 'dark') {
  systemTheme.addEventListener('change', (event) => { rootElement.dataset.theme = event.matches ? 'dark' : 'light'; });
}

function detectLanguage(): Language {
  if (window.location.pathname.startsWith('/cn/')) return 'cn';
  if (window.location.pathname.startsWith('/en/')) return 'en';
  return navigator.language.toLowerCase().startsWith('zh') ? 'cn' : 'en';
}

function applyDocumentLanguage(lang: Language): void {
  rootElement.lang = lang === 'cn' ? 'zh-CN' : 'en';
  document.title = lang === 'cn' ? 'IsOS 配置' : 'IsOS Configuration';
}

const initialLanguage = detectLanguage();
applyDocumentLanguage(initialLanguage);

function App(): React.ReactElement {
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [graphDirty, setGraphDirty] = useState(false);
  type Page = 'home' | 'graph' | 'eos' | 'egia';
  const [page, setPage] = useState<Page>(() => {
    const segment = new URLSearchParams(window.location.search).get('page');
    return segment === 'home' || segment === 'eos' || segment === 'egia' ? segment : 'graph';
  });
  const openPage = (next: Page): void => {
    window.history.pushState({ page: next }, '', `/${lang}/isos${next === 'graph' ? '' : `?page=${next}`}`);
    setPage(next);
  };
  const changeLanguage = (value: Language): void => {
    window.history.replaceState(window.history.state, '', `/${value}/isos${page === 'graph' ? '' : `?page=${page}`}`);
    applyDocumentLanguage(value);
    setLang(value);
  };
  React.useEffect(() => {
    const onPop = (): void => { const segment = new URLSearchParams(window.location.search).get('page'); setPage(segment === 'home' || segment === 'eos' || segment === 'egia' ? segment : 'graph'); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const labels = lang === 'cn' ? { home: '首页', graph: '节点图', eos: 'EOS', egia: 'EGIA', language: '语言', shell: '此运行面板将在对应核心可用时提供。节点配置请使用节点图页面。' } : { home: 'Home', graph: 'Graph', eos: 'EOS', egia: 'EGIA', language: 'Language', shell: 'This runtime panel will be available with its core. Configure nodes on the Graph page.' };
  return <div className="isos-workbench"><nav className="isos-workbench__nav" aria-label="IsOS"><a className="isos-workbench__brand" href="https://www.os-island.com" aria-label="Island website">ISOS<span> / Aether</span></a><div role="group" aria-label="Pages">{(['graph', 'eos', 'egia'] as Page[]).map((name) => <button type="button" key={name} className={page === name ? 'active' : ''} aria-current={page === name ? 'page' : undefined} onClick={() => openPage(name)}>{labels[name]}</button>)}</div><button type="button" onClick={() => changeLanguage(lang === 'en' ? 'cn' : 'en')} aria-label={labels.language}>{lang === 'en' ? '中文' : 'EN'}</button></nav>
    {page === 'home' && <IsosHome lang={lang} onOpenGraph={() => openPage('graph')} graphDirty={graphDirty} />}
    <div className="isos-workbench__graph-view" hidden={page !== 'graph'}><Suspense fallback={<p role="status">{lang === 'cn' ? '正在加载节点图…' : 'Loading node graph…'}</p>}><NodeGraphManager lang={lang} visible={page === 'graph'} onDirtyChange={setGraphDirty} /></Suspense></div>
    {page === 'eos' && <Suspense fallback={<p role="status">{lang === 'cn' ? '正在加载 EOS…' : 'Loading EOS…'}</p>}><EosWorkbench lang={lang} onOpenGraph={() => openPage('graph')} graphDirty={graphDirty} /></Suspense>}
    {page === 'egia' && <main className="isos-workbench__shell"><p className="isos-eyebrow">EGIA · Aether v2</p><h1>{labels.egia}</h1><p>{labels.shell}</p><button type="button" onClick={() => openPage('graph')}>{labels.graph}</button></main>}
  </div>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing IsOS root element.');
createRoot(root).render(<App />);
