import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IsosManager } from '@/components/isos/IsosManager';
import type { Language } from '@/types';
import '@/styles/fonts.css';
import '@/styles/global.scss';

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
  const changeLanguage = (value: Language): void => {
    window.history.replaceState(window.history.state, '', `/${value}/isos`);
    applyDocumentLanguage(value);
    setLang(value);
  };
  return <IsosManager lang={lang} onLanguageChange={changeLanguage} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing IsOS root element.');
createRoot(root).render(<App />);
