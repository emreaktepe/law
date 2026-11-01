import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X, ArrowUpRight } from 'lucide-react';
import { prepareMatterRows, queryMatterRows } from '../../domain/matter-views.js';
import { normalizeSearchText } from '../../lib/normalize.js';
import { browserRecentMatterRepository } from '../../data/recentMatterRepository.js';
import './workbench.css';

/** Authorized input only; no global search endpoint or hidden content is loaded. */
export default function CommandPalette({ matters, role, ownerId = 'demo', currentMatter, onMatterAction, onOpenMatter, onCreateMatter, onNavigate }) {
  const dialog = useRef(null), input = useRef(null), previousFocus = useRef(null);
  const [opened, setOpened] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const id = useId();
  const recentStore = useMemo(() => browserRecentMatterRepository(role + ':' + ownerId), [role, ownerId]);
  const [recent, setRecent] = useState([]);
  const rows = useMemo(() => role === 'lawyer' ? prepareMatterRows(matters, new Date().toISOString()) : [], [matters, role]);
  const results = useMemo(() => {
    if (role !== 'lawyer') return [];
    const actions = [
      { id: 'create', title: 'Yeni dosya aç', hint: 'Dosya oluştur', run: onCreateMatter },
      { id: 'today', title: 'Bugün ekranını aç', hint: 'Öncelikler', run: () => onNavigate('Bugün') },
      { id: 'calendar', title: 'Takvim ve süreleri aç', hint: 'Takvim', run: () => onNavigate('Takvim & süreler') },
      ...(currentMatter && onMatterAction && !currentMatter.archivedAt && !currentMatter.archived_at && !['closed', 'archived'].includes(currentMatter.status) ? [
        { id: 'event', title: 'Safahat ekle', hint: currentMatter.title, run: () => onMatterAction(currentMatter, 'event') },
        { id: 'task', title: 'Görev ekle', hint: currentMatter.title, run: () => onMatterAction(currentMatter, 'task') },
        { id: 'agenda', title: 'Duruşma ekle', hint: currentMatter.title, run: () => onMatterAction(currentMatter, 'agenda') },
      ] : []),
    ].filter(action => !query || normalizeSearchText(action.title + ' ' + action.hint).includes(normalizeSearchText(query)));
    const authorized = new Map(rows.map(row => [row.record.id, row]));
    const recentRows = recent.map(item => authorized.get(item.id)).filter(Boolean);
    const matches = (query ? queryMatterRows(rows, { query, statuses: [] }).slice(0, 30) : recentRows.length ? recentRows : rows.slice(0, 5)).map(row => ({ id: 'matter:' + row.record.id, matterId: row.record.id, title: row.record.title, hint: (!query && recentRows.length ? 'Son açılan dosya · ' : '') + (row.numbers[0] || 'Dosya'), run: () => onOpenMatter(row.matter) }));
    return [...actions, ...matches];
  }, [rows, recent, query, role, currentMatter, onMatterAction, onCreateMatter, onNavigate, onOpenMatter]);
  function open() { previousFocus.current = document.activeElement; setRecent(recentStore.list()); setQuery(''); setActive(0); setOpened(true); }
  function close() { setOpened(false); }
  function choose(result) { if (!result) return; if (result.matterId) { try { recentStore.visit(String(result.matterId)); } catch { /* Opening still works when optional demo history cannot persist. */ } } close(); result.run(); }
  useEffect(() => {
    if (role !== 'lawyer') return;
    const listener = event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.altKey) { event.preventDefault(); if (opened) close(); else open(); } };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [role, opened, recentStore]);
  useEffect(() => {
    const element = dialog.current;
    if (opened && role === 'lawyer') { element.showModal(); input.current?.focus(); }
    else if (element?.open) { element.close(); if (previousFocus.current?.isConnected) previousFocus.current.focus(); }
  }, [opened, role]);
  useEffect(() => { if (opened) document.getElementById(id + '-option-' + active)?.scrollIntoView({ block: 'nearest' }); }, [active, opened, id]);
  if (role !== 'lawyer') return null;
  return <><button className="wb-command-trigger" onClick={open}><Search size={14}/>Hızlı erişim <kbd>Ctrl K</kbd></button><dialog ref={dialog} className="wb-command" aria-labelledby={id + '-title'} onCancel={() => close()} onClose={() => setOpened(false)} onClick={event => { if (event.target === dialog.current) close(); }}>
    <div className="wb-command-heading"><h2 id={id + '-title'}>Dosyaya veya işe git</h2><button aria-label="Hızlı erişimi kapat" onClick={close}><X size={18}/></button></div>
    <label className="sr-only" htmlFor={id + '-search'}>Dosya adı, numara veya komut</label><input id={id + '-search'} ref={input} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={id + '-results'} aria-activedescendant={results[active] ? id + '-option-' + active : undefined} placeholder="2026 184, müvekkil veya yeni dosya…" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(previous => Math.max(0, Math.min(results.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1)))); } else if (event.key === 'Enter') { event.preventDefault(); choose(results[active]); } }}/>
    <div role="listbox" id={id + '-results'} aria-label="Hızlı erişim sonuçları">{results.map((result, index) => <div role="option" aria-selected={active === index} id={id + '-option-' + index} key={result.id} onMouseDown={event => event.preventDefault()} onClick={() => choose(result)}><span><strong>{result.title}</strong><small>{result.hint}</small></span><ArrowUpRight size={16}/></div>)}</div>
    {!results.length ? <p role="status">Eşleşen dosya veya komut bulunamadı.</p> : null}<p className="wb-command-help">↑ ↓ Seç · Enter Aç · Esc Kapat</p>
  </dialog></>;
}
