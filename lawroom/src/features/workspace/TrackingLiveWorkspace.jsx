import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Folder, LogOut, Plus, RefreshCw, Scale, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase.js';
import { createTrackingSupabaseRepository } from '../../data/trackingSupabaseRepository.js';
import { createTrackingWorkspaceController } from '../../data/trackingWorkspaceController.js';
import { createTrackingDocumentBridge } from '../../data/trackingDocumentBridge.js';
import { clientTrackingDTO } from '../../domain/tracking-contract.js';
import { prepareMatterRows, queryMatterRows } from '../../domain/matter-views.js';
import { normalizeSearchText } from '../../lib/normalize.js';
import MatterCockpit from '../tracking/MatterCockpit.jsx';
import ClientMatterView from '../tracking/ClientMatterView.jsx';
import MatterCreateWizard from '../matter-create/MatterCreateWizard.jsx';
import './workspace.css';
import './tracking-live.css';

const idle = Object.freeze({ status: 'idle', items: [], selected: null, error: null, canRetry: false });
const noSubscribe = () => () => {};
const getIdle = () => idle;
const noop = () => {};

/** Only this wrapper reads real Auth/client configuration. Test fixtures inject the named view. */
export default function TrackingLiveWorkspace() {
  const auth = useAuth();
  const repository = useMemo(() => supabase ? createTrackingSupabaseRepository(supabase) : null, []);
  return <TrackingWorkspaceView repository={repository} session={auth?.session} identity={auth?.identity} onSignOut={auth?.signOut}/>;
}

export function TrackingWorkspaceView({ repository, session, identity, onSignOut = noop }) {
  const userId = session?.user?.id, role = identity?.account?.role;
  if (!repository || !userId || !['lawyer', 'client'].includes(role) || identity?.account?.status !== 'active') {
    return <section className="live-main"><div className="panel"><h1>Çalışma alanı açılamadı.</h1><p role="alert">Etkin bir avukat veya müvekkil oturumu gerekli.</p></div></section>;
  }
  return <WorkspaceBody key={userId + ':' + role} repository={repository} session={session} identity={identity} onSignOut={onSignOut}/>;
}

function WorkspaceBody({ repository, session, identity, onSignOut }) {
  const role = identity.account.role, userId = session.user.id;
  const memberships = identity.memberships?.filter(m => m.active) || [];
  const [chosenOrganization, setChosenOrganization] = useState('');
  const organizationId = memberships.some(m => m.organization_id === chosenOrganization) ? chosenOrganization : memberships[0]?.organization_id;
  const [store, setStore] = useState(null), [query, setQuery] = useState(''), [creating, setCreating] = useState(false), [localError, setLocalError] = useState(''), [retryVersion, setRetryVersion] = useState(0);
  const contextKey = useMemo(() => ({}), [repository, userId, role, organizationId]);
  const controller = store?.key === contextKey ? store.controller : null;
  const state = useSyncExternalStore(controller?.subscribe || noSubscribe, controller?.getSnapshot || getIdle, getIdle);
  useEffect(() => {
    const next = createTrackingWorkspaceController(repository, { userId, role, organizationId });
    setStore({ key: contextKey, controller: next });
    void next.load();
    return () => next.dispose();
  }, [contextKey, repository, userId, role, organizationId]);
  const documents = useMemo(() => controller ? createTrackingDocumentBridge(controller) : null, [controller]);
  const items = state.items.map(dto => dto.matter), selected = state.selected;
  const busy = ['idle', 'loading', 'loading-detail', 'saving'].includes(state.status);
  const rows = useMemo(() => {
    if (role !== 'lawyer') return [];
    return prepareMatterRows(state.items.map(dto => dto.matter), new Date().toISOString());
  }, [state.items, role]);
  const lawyerRows = useMemo(() => queryMatterRows(rows, { query, statuses: [] }), [rows, query]);
  const clientRows = role === 'client' ? items.filter(m => normalizeSearchText(`${m.title} ${m.number || ''}`).includes(normalizeSearchText(query))) : [];
  const denied = ['access-denied', 'setup-required'].includes(state.status);

  async function checked(operation) {
    const ok = await operation();
    if (!ok) throw new Error(controller?.getSnapshot().error?.message || 'İşlem kaydedilemedi.');
    return true;
  }
  function back() { setCreating(false); setLocalError(''); controller?.back(); }
  return <div className="live-page tracking-live">
    <header className="live-header"><a className="brand" href="#"><Scale size={26}/>lawroom<span>.</span></a>
      <span className="live-badge"><ShieldCheck size={14}/>Dosya çalışma alanı</span>
      <div><span>{identity.account.display_name}</span><button className="text" onClick={async () => { setLocalError(''); try { await onSignOut(); } catch { setLocalError('Çıkış yapılamadı. Yeniden deneyin.'); } }}><LogOut size={15}/>Çıkış yap</button></div>
    </header>
    <main className="live-main">
      {localError && <p className="tracking-error" role="alert">{localError}</p>}
      {state.error && <div className="tracking-error" role="alert"><p>{state.error.message}</p><div className="tracking-actions">
        {state.canRetry && <button className="secondary" disabled={busy} onClick={async () => { if(await controller.retry()){setRetryVersion(v=>v+1);if(controller.getSnapshot().selected)setCreating(false);} }}><RefreshCw size={14}/>Aynı işlemi yeniden dene</button>}
        <button className="text" onClick={() => { setCreating(false); controller.load(); }}>Çalışma alanını yeniden yükle</button>
      </div></div>}
      {!controller || state.status === 'loading' || state.status === 'idle' ? <section className="panel" role="status">Dosyalarınız yükleniyor…</section> : denied ? <section className="panel"><h1>{state.status === 'setup-required' ? 'Çalışma alanı hazırlanıyor.' : 'Dosya erişimi kapalı.'}</h1><p>İçerik bu oturumda görüntülenmiyor.</p></section> : creating && role === 'lawyer' ? <section>
        <button className="text" onClick={back}><ArrowLeft size={14}/>Dosyalarım</button>
        {memberships.length > 1 && <label className="tracking-live-org">Dosyanın çalışma alanı<select value={organizationId} onChange={e => setChosenOrganization(e.target.value)}>{memberships.map(m => <option key={m.organization_id} value={m.organization_id}>{m.organization_name || m.organization_id}</option>)}</select></label>}
        <MatterCreateWizard role={role} onCancel={back} onCreate={async input => { await checked(() => controller.create(input)); setCreating(false); return controller.getSnapshot().selected?.matter; }}/>
      </section> : state.status === 'loading-detail' ? <section className="panel" role="status">Güncel dosya erişimi kontrol ediliyor…</section> : selected?.audience === 'client' ? <ClientMatterView key={selected.matter.id + ':' + retryVersion} matter={selected.matter} serverView={clientTrackingDTO(selected)} mode="live" documentRepository={documents} onChanged={noop} onBack={back} onSendMessage={(_id, body) => checked(() => controller.save('add_message', { body }))}/>
        : selected?.audience === 'lawyer' ? <MatterCockpit key={selected.matter.id + ':' + retryVersion} matter={selected.matter} matters={items} actorId={userId} actorName={selected.matter.responsibleName || identity.account.display_name} mode="live" documentRepository={documents} onChanged={noop} onBack={back} onOpenMatter={m => controller.open(m.id)} onCommand={(type, input) => checked(() => controller.save(type, input))} onLink={(otherId, kind) => checked(() => controller.link(otherId, kind))} onDerive={input => checked(() => controller.derive(input))}/>
        : <section><div className="heading"><div><div className="eyebrow">{role === 'lawyer' ? 'HER DOSYA, BİR SONRAKİ ADIMIYLA' : 'SİZİN İÇİN, DAHA ANLAŞILIR'}</div><h1>Dosyalarım</h1><p>{role === 'lawyer' ? 'Yetkili olduğunuz dosyaları bulun ve sıradaki işi inceleyin.' : 'Avukatınızın sizinle paylaştığı gelişmeler burada.'}</p></div>{role === 'lawyer' && <button className="primary" disabled={!memberships.length} onClick={() => { controller.back(); setCreating(true); }}><Plus size={16}/>Yeni dosya</button>}</div>
          <div className="tracking-live-toolbar"><label>Dosya veya numara ara<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Dosya adı veya 2026/184…"/></label><button className="secondary" onClick={() => controller.load()}><RefreshCw size={15}/>Yenile</button></div>
          <section className="panel">{!(role === 'lawyer' ? lawyerRows.length : clientRows.length) && <div className="tracking-empty"><Folder size={28}/><h2>Bu görünümde dosya yok.</h2><p>{query ? 'Aramanızı değiştirebilirsiniz.' : role === 'client' ? 'Avukatınız dosya paylaştığında burada görebilirsiniz.' : 'İlk dosyanızı açarak başlayabilirsiniz.'}</p></div>}
            {role === 'lawyer' ? lawyerRows.map(row => <button className="file-row" key={row.record.id} onClick={() => controller.open(row.record.id)}><Folder size={22}/><div><h3>{row.record.title}</h3><p>{row.numbers[0] || 'Numara bekleniyor'} · {row.record.type} · {row.record.stage}</p></div><span className="row-next">{row.nextStep?.title || 'Sıradaki iş belirlenmedi'}<p>{row.attention?.reason || 'Dosyayı incele'}</p></span></button>) : clientRows.map(m => <button className="file-row" key={m.id} onClick={() => controller.open(m.id)}><Folder size={22}/><div><h3>{m.title}</h3><p>{m.number || 'Dosyanız'} · {m.stage}</p><p>{m.summary}</p></div>{m.requests.length > 0 && <span className="tracking-badge">Sizden beklenen {m.requests.length} iş</span>}</button>)}
          </section>
        </section>}
      <footer><span>lawroom.</span><span>Hukukun ciddiyeti, iletişimin sıcaklığı.</span></footer>
    </main>
  </div>;
}
