import React, { useEffect, useRef, useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { demoDocumentRepository } from '../../data/demoDocumentRepository.js';

export default function TrackingDocuments({ matter, actorId, role = 'lawyer', clientName, readonly, onChanged }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [preview, setPreview] = useState(null), previewRef = useRef(null), lock = useRef(false);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  const context = { role, actorId, clientName };
  const docs = (matter.documents || []).filter(d => role === 'lawyer' || matter.shared && d.shared);
  async function open(doc, version, inline) {
    setError('');
    try {
      const blob = await demoDocumentRepository.download(matter.id, doc.id, version.id, context);
      const url = URL.createObjectURL(blob);
      if (inline) { if (previewRef.current) URL.revokeObjectURL(previewRef.current); previewRef.current = url; setPreview({ url, name: version.name, mediaType: version.mediaType }); }
      else { const a = document.createElement('a'); a.href = url; a.download = version.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (e) { setError(e.message); }
  }
  return <div className="tracking-documents"><div className="tracking-section-head"><h2>Belgeler ve sürümler</h2></div><p>Demo belgeleri yalnız bu tarayıcının belge deposunda saklanır. Her yükleme ayrı sürümdür; önceki dosyanın üzerine yazılmaz.</p>{error && <p role="alert" className="tracking-error">{error}</p>}
    {role === 'lawyer' && !readonly && <form className="tracking-form tracking-record" onSubmit={async e => { e.preventDefault(); if (lock.current) return; const form = e.currentTarget, p = new FormData(form), file = form.elements.file.files[0]; if (!file) return; lock.current = true; setBusy(true); setError(''); try { onChanged(await demoDocumentRepository.upload(matter.id, file, Object.fromEntries(p), context)); form.reset(); } catch (failure) { setError(failure.message); } finally { lock.current = false; setBusy(false); } }}>
      <label>Belge<input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.udf"/></label><div className="two"><label>Yeni belge / sürüm<select name="documentId"><option value="">Yeni belge</option>{docs.map(d => <option key={d.id} value={d.id}>{d.name} · yeni sürüm</option>)}</select></label><label>Kategori<select name="category">{['Dilekçe', 'Karar', 'Tebligat', 'Bilirkişi', 'Sözleşme', 'Makbuz', 'Diğer'].map(c => <option key={c}>{c}</option>)}</select></label></div><label>Kaynak safahat<select name="sourceEventId"><option value="">Bağlantı yok</option>{(matter.events || []).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label><p>En fazla 20 MB. PDF ve resim önizlenebilir. UDF/DOCX orijinal dosya olarak indirilir.</p><button className="secondary" disabled={busy}>{busy ? 'Yükleniyor…' : 'Yeni sürümü kaydet'}</button>
    </form>}
    {!docs.length && <div className="tracking-empty"><FileText size={28}/><p>Henüz belge yok.</p></div>}
    {docs.map(doc => <article className="tracking-record" key={doc.id}><div className="tracking-section-head"><h3>{doc.name}</h3><span className="tracking-badge">{doc.category} · {doc.shared ? 'Müvekkile açık' : 'Büro içi'}</span></div>{doc.sourceEventId && <p>Kaynak: {matter.events?.find(e => e.id === doc.sourceEventId)?.title || 'Safahat kaydı'}</p>}<div className="tracking-document-versions">{[...doc.versions].reverse().map(version => <div key={version.id} className="tracking-document-version"><div><strong>Sürüm {version.number} · {version.name}</strong><p>{Math.ceil(version.sizeBytes / 1024)} KB · {new Date(version.createdAt).toLocaleDateString('tr-TR')}</p>{role === 'lawyer' && <small title={version.sha256}>SHA-256: {version.sha256.slice(0, 16)}…</small>}</div><div className="tracking-actions">{['application/pdf', 'image/png', 'image/jpeg'].includes(version.mediaType) && <button className="text" onClick={() => open(doc, version, true)}><Eye size={14}/>Önizle</button>}<button className="text" onClick={() => open(doc, version, false)}><Download size={14}/>İndir</button></div></div>)}</div>{role === 'lawyer' && !readonly && <button className="secondary" onClick={() => { try { onChanged(demoDocumentRepository.share(matter.id, doc.id, !doc.shared, context)); } catch (e) { setError(e.message); } }}>{doc.shared ? 'Belge paylaşımını kapat' : 'Belgeyi müvekkile aç'}</button>}</article>)}
    {preview && <section className="tracking-record"><div className="tracking-section-head"><h3>{preview.name}</h3><button className="text" onClick={() => { URL.revokeObjectURL(previewRef.current); previewRef.current = null; setPreview(null); }}>Önizlemeyi kapat</button></div>{preview.mediaType.startsWith('image/') ? <img className="tracking-document-preview" src={preview.url} alt={preview.name}/> : <iframe className="tracking-document-preview" title={preview.name + ' PDF önizlemesi'} src={preview.url} sandbox=""/>}</section>}
  </div>;
}
