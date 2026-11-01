import React, { useState } from 'react';
import { getMatterTemplate, matterTemplates } from '../../domain/stages.js';
import { linkKinds } from '../../domain/tracking-model.js';

export default function DeriveMatterForm({ source, onDerive, onClose, busy }) {
  const [type, setType] = useState('icra'), template = getMatterTemplate(type);
  return <form className="tracking-form" onSubmit={event => {
    event.preventDefault(); const p = Object.fromEntries(new FormData(event.currentTarget));
    onDerive({ ...p, type, stageKey: template.stages[0].key, numberKind: type === 'icra' ? 'icra_takip' : 'esas' });
  }}><p>Kaynak: <strong>{source.title}</strong>. Yeni dosya özel açılır; ilişki ve paylaşım aktarılmaz. İki dosyada da bağlantı oluşur.</p>
    <label>Bağlantı türü<select name="linkKind" defaultValue="enforcement_of">{Object.entries(linkKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>Yeni dosyanın başlığı<input name="title" required maxLength={160} defaultValue={source.title + ' · İcra'}/></label>
    <div className="two"><label>Tür<select value={type} onChange={e => setType(e.target.value)}>{matterTemplates.map(t => <option value={t.key} key={t.key}>{t.label}</option>)}</select></label><label>Alt tür<select name="subtype" key={type}>{template.subtypes.map(t => <option key={t}>{t}</option>)}</select></label><label>Numara (isteğe bağlı)<input name="number" placeholder="2026/184"/></label><label>Mahkeme / daire<input name="court" maxLength={200}/></label></div>
    <p>{template.notice}</p><div className="tracking-form-footer"><button type="button" className="secondary" onClick={onClose}>Vazgeç</button><button className="primary" disabled={busy}>Yeni dosyayı oluştur ve bağla</button></div>
  </form>;
}
