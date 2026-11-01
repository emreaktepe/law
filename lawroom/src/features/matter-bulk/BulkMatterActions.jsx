import React, { useMemo, useState } from 'react';
import { bulkMatterRepository } from '../../data/bulkMatterRepository.js';
import './matter-bulk.css';

/** Used inside the list selection slot, only with already-authorized demo rows. */
export default function BulkMatterActions({ selectedMatters, actorId, actorName, role, onChanged }) {
  const [mode, setMode] = useState(''), [error, setError] = useState(''), [preview, setPreview] = useState(null), [notice, setNotice] = useState('');
  const candidates = useMemo(() => {
    const people = new Map([[actorId, { id: actorId, name: actorName || 'Kendim' }]]);
    for (const matter of selectedMatters) for (const member of matter.members || []) if (member.active !== false && ['responsible', 'collaborator'].includes(member.role)) people.set(member.userId, { id: member.userId, name: member.name || member.displayName || member.userId });
    return [...people.values()].filter(person => selectedMatters.every(matter => person.id === actorId || matter.responsibleId === person.id || (matter.members || []).some(member => member.userId === person.id && ['responsible', 'collaborator'].includes(member.role) && member.active !== false)));
  }, [selectedMatters, actorId, actorName]);
  if (role !== 'lawyer' || !selectedMatters.length) return null;
  const ids = selectedMatters.map(matter => matter.id), selectionKey = JSON.stringify(ids);
  function command(form) { const data = new FormData(form), person = candidates.find(item => item.id === data.get('responsibleId')); return { type: mode, reason: data.get('reason'), responsibleId: person?.id, responsibleName: person?.name, closedOn: data.get('closedOn') }; }
  function inspect(event) {
    event.preventDefault(); setError(''); setNotice('');
    try { const value = command(event.currentTarget), result = bulkMatterRepository.preview(ids, value, { role, actorId }); setPreview({ selectionKey, value, result }); }
    catch (failure) { setPreview(null); setError(failure.message); }
  }
  function commit() {
    if (!preview || preview.selectionKey !== selectionKey) return;
    try { const next = bulkMatterRepository.commit(ids, preview.value, { role, actorId }); onChanged(next); setPreview(null); setMode(''); setNotice(`${ids.length} dosyada işlem ve denetim kaydı tamamlandı.`); }
    catch (failure) { setError(failure.message); setPreview(null); }
  }
  return <div className="mb-actions"><div className="mb-buttons"><button className="secondary" onClick={() => { setMode('assign_responsible'); setPreview(null); setError(''); }}>Sorumlu ata</button><button className="secondary" onClick={() => { setMode('archive'); setPreview(null); setError(''); }}>Arşivle</button></div>
    {notice ? <p role="status">{notice}</p> : null}{error ? <p role="alert" className="mb-error">{error}</p> : null}
    {mode ? <form className="mb-form" onSubmit={inspect} onChange={() => setPreview(null)}><h3>{mode === 'archive' ? 'Toplu kapanış kontrolü' : 'Sorumlu avukat atama'}</h3><p>{ids.length} dosya seçili. Önizleme kaydetmez; işlem sırasında tüm dosyalar yeniden kontrol edilir.</p>
      {mode === 'assign_responsible' ? <label>Yeni sorumlu<select name="responsibleId" defaultValue={actorId}>{candidates.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select><small>Yalnız tüm seçili dosyalarda yetkili ekip üyeleri listelenir.</small></label> : <label>Kapanış tarihi<input name="closedOn" type="date" required/><small>Açık görev, süre veya takvim kaydı varsa hiçbir dosya arşivlenmez.</small></label>}
      <label>İşlem gerekçesi<textarea name="reason" required maxLength={1000}/></label><div className="mb-buttons"><button className="secondary">Önizle</button><button type="button" className="text" onClick={() => { setMode(''); setPreview(null); }}>Vazgeç</button></div>
      {preview && preview.selectionKey === selectionKey ? <div className="mb-preview"><strong>{preview.result.length} dosyada {mode === 'archive' ? 'paylaşım kapatılıp arşive taşınacak' : 'sorumlu değişecek'}.</strong><ul>{preview.result.slice(0, 8).map(matter => <li key={matter.id}>{matter.title}</li>)}</ul>{preview.result.length > 8 ? <p>ve {preview.result.length - 8} diğer dosya</p> : null}<button type="button" className="primary" onClick={commit}>{preview.result.length} dosyaya uygula</button></div> : null}
    </form> : null}
  </div>;
}
