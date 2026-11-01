import { demoRepository } from './demoRepository.js';
import { isArchived, trackingMatter } from '../domain/tracking-model.js';

let database;
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('lawroom-demo-documents-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('versions');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error('Belge deposu başka sekmede kilitli.')); };
  });
  return database;
}
const blobStore = {
  async run(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('versions', mode), request = action(transaction.objectStore('versions'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || new Error('Belge işlemi kesildi.'));
    });
  },
  add(id, blob) { return this.run('readwrite', store => store.add(blob, id)); },
  get(id) { return this.run('readonly', store => store.get(id)); },
  discard(id) { return this.run('readwrite', store => store.delete(id)); },
};
export function createDemoDocumentRepository({ storage = demoRepository, blobs = blobStore, makeId = () => crypto.randomUUID() } = {}) {
  const find = id => { const matters = storage.listMatters(), matter = matters.find(m => m.id === id); if (!matter) throw new Error('Dosya bulunamadı.'); return { matters, matter }; };
  function writer(matter, context) {
    if (context.role !== 'lawyer' || !context.actorId || isArchived(matter)) throw new Error('Belge yüklemek için açık dosya ve avukat hesabı gereklidir.');
  }
  function uploader(matter, input, context) {
    if (context.role === 'lawyer') { writer(matter, context); return; }
    const request = (matter.tasks || []).find(t => t.id === input.requestId && t.kind === 'client_document_request' && t.sharedWithClient && (!t.status || t.status === 'open') && !t.done);
    if (context.role !== 'client' || !context.actorId || matter.client !== context.clientName || !matter.shared || isArchived(matter) || !request || input.documentId) throw new Error('Yalnız açık belge talebine, paylaşılan dosyada yükleme yapılabilir.');
  }
  return {
    async upload(matterId, file, input, context) {
      const { matter } = find(matterId); uploader(matter, input, context);
      const extension = String(file.name || '').split('.').at(-1).toLowerCase();
      const types = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', udf: 'application/octet-stream' };
      if (!types[extension] || !file.size || file.size > 20 * 1024 * 1024 || file.name.length > 200) throw new Error('PDF, PNG, JPEG, DOCX veya UDF; en fazla 20 MB yükleyin.');
      const bytes = await file.arrayBuffer(), hash = await crypto.subtle.digest('SHA-256', bytes), sha256 = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
      const id = makeId(), now = new Date().toISOString();
      await blobs.add(id, new Blob([bytes], { type: types[extension] }));
      try {
        // Reload after hashing/upload: another command or tab may have changed the aggregate.
        const fresh = find(matterId); uploader(fresh.matter, input, context);
        const docs = fresh.matter.documents || [], previous = input.documentId ? docs.find(d => d.id === input.documentId) : null;
        if (input.documentId && !previous) throw new Error('Sürümlenecek belge bulunamadı.');
        if (input.sourceEventId && !trackingMatter(fresh.matter).events.some(e => e.id === input.sourceEventId)) throw new Error('Kaynak safahat bulunamadı.');
        const version = { id, sha256, sizeBytes: bytes.byteLength, mediaType: types[extension], name: file.name, number: (previous?.versions.length || 0) + 1, createdAt: now, uploadedBy: context.actorId };
        const document = previous ? { ...previous, versions: [...previous.versions, version] } : { id: makeId(), name: file.name, category: input.category || 'Diğer', shared: context.role === 'client', requestId: input.requestId || null, sourceEventId: input.sourceEventId || null, versions: [version] };
        const updated = { ...fresh.matter, documents: previous ? docs.map(d => d.id === previous.id ? document : d) : [...docs, document],
          tasks: context.role === 'client' ? fresh.matter.tasks.map(t => t.id === input.requestId ? { ...t, status: 'review', uploadedDocumentId: document.id } : t) : fresh.matter.tasks, lastActivityAt: now,
          auditHistory: [...(fresh.matter.auditHistory || []), { id: makeId(), action: 'document_version_added', entityId: document.id, versionId: id, actorId: context.actorId, occurredAt: now }] };
        const next = fresh.matters.map(m => m.id === matterId ? updated : m); storage.saveMatters(next); return next;
      } catch (error) { try { await blobs.discard(id); } catch {} throw error; }
    },
    share(matterId, documentId, shared, context) {
      const { matters, matter } = find(matterId); writer(matter, context);
      if (!(matter.documents || []).some(d => d.id === documentId)) throw new Error('Belge bulunamadı.');
      const next = matters.map(m => m.id === matterId ? { ...m, documents: m.documents.map(d => d.id === documentId ? { ...d, shared: shared === true } : d),
        auditHistory: [...(m.auditHistory || []), { id: makeId(), action: 'document_sharing_changed', entityId: documentId, actorId: context.actorId, occurredAt: new Date().toISOString() }] } : m);
      storage.saveMatters(next); return next;
    },
    async download(matterId, documentId, versionId, context) {
      const { matter } = find(matterId), doc = (matter.documents || []).find(d => d.id === documentId);
      const allowed = context.role === 'lawyer' || context.role === 'client' && matter.client === context.clientName && matter.shared && doc?.shared && !isArchived(matter);
      if (!allowed || !doc?.versions.some(v => v.id === versionId)) throw new Error('Belge erişimi kapalı.');
      const blob = await blobs.get(versionId); if (!blob) throw new Error('Bu sürüm bu tarayıcıda bulunamadı.');
      return blob;
    },
  };
}
export const demoDocumentRepository = createDemoDocumentRepository();
