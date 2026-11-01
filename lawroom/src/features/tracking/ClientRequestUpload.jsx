import React, { useRef, useState } from 'react';
import { demoDocumentRepository } from '../../data/demoDocumentRepository.js';

export default function ClientRequestUpload({ matterId, request, onChanged }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false);
  if (request.status === 'review') return <p>Belgeniz alındı. Avukatınızın incelemesi bekleniyor.</p>;
  return <form className="tracking-form" onSubmit={async event => {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget, file = form.elements.file.files[0]; if (!file) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const next = await demoDocumentRepository.upload(matterId, file, { requestId: request.id, category: 'Müvekkil belgesi' }, { role: 'client', actorId: 'demo-client-deniz', clientName: 'Deniz Yılmaz' });
      onChanged(next); form.reset();
    } catch (failure) { setError(failure.message || 'Yükleme yapılamadı.'); }
    finally { lock.current = false; setBusy(false); }
  }}>
    <label>Bu talebe belge ekle<input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.udf"/></label>
    {error && <p role="alert" className="tracking-error">{error}</p>}
    <button className="secondary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Belgeyi incelemeye gönder'}</button>
    <p>Demo yüklemesi bu tarayıcıda saklanır.</p>
  </form>;
}
