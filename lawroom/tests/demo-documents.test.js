import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocumentRepository } from '../src/data/demoDocumentRepository.js';
function fixture() {
  let rows = [{ id: 'm', shared: true, client: 'Demo', tasks: [], events: [], messages: [] }], i = 0;
  const blobs = new Map(), storage = { listMatters: () => structuredClone(rows), saveMatters: value => { rows = value; } };
  const repo = createDemoDocumentRepository({ storage, blobs: { add: async (id, blob) => blobs.set(id, blob), get: async id => blobs.get(id), discard: async id => blobs.delete(id) }, makeId: () => 'id-' + ++i });
  return { repo, storage, blobs, rows: () => rows };
}
const context = { actorId: 'lawyer', role: 'lawyer' };
const file = text => new File([text], 'ornek.pdf', { type: 'application/pdf' });
test('gerçek blob hash ile saklanır; yeni sürüm önceki byte içeriğini korur', async () => {
  const f = fixture(); await f.repo.upload('m', file('v1'), {}, context); const doc = f.rows()[0].documents[0];
  await f.repo.upload('m', file('v2'), { documentId: doc.id }, context);
  const versions = f.rows()[0].documents[0].versions; assert.equal(versions.length, 2); assert.notEqual(versions[0].sha256, versions[1].sha256);
  assert.equal(await (await f.repo.download('m', doc.id, versions[0].id, context)).text(), 'v1');
});
test('belge paylaşımı veya dosya ilişkisi kapanınca bilinen demo sürüm ID si indirilemez', async () => {
  const f = fixture(); await f.repo.upload('m', file('private'), {}, context); const doc = f.rows()[0].documents[0], version = doc.versions[0].id;
  const client = { role: 'client', clientName: 'Demo' };
  await assert.rejects(f.repo.download('m', doc.id, version, client), /erişimi/);
  f.repo.share('m', doc.id, true, context); assert.equal(await (await f.repo.download('m', doc.id, version, client)).text(), 'private');
  f.repo.share('m', doc.id, false, context); await assert.rejects(f.repo.download('m', doc.id, version, client), /erişimi/);
  await assert.rejects(f.repo.download('m', doc.id, version, { role: 'admin' }), /erişimi/);
});
test('metadata kaydı başarısızsa yeni geçici blob temizlenir; arşive veya istemci rolüne yükleme yok', async () => {
  const f = fixture(); f.storage.saveMatters = () => { throw new Error('quota'); };
  await assert.rejects(f.repo.upload('m', file('v1'), {}, context), /quota/); assert.equal(f.blobs.size, 0);
  await assert.rejects(f.repo.upload('m', file('v1'), {}, { role: 'client' }), /açık belge talebine/);
});
test('müvekkil yalnız açık paylaşılan talebe yükler; görev incelemeye geçer, başka talebe yüklenmez', async () => {
  const f = fixture(); f.storage.saveMatters([{...f.rows()[0], tasks:[{id:'request',kind:'client_document_request',title:'Bordro',sharedWithClient:true,status:'open'}]}]);
  const client = {role:'client',actorId:'demo',clientName:'Demo'};
  await assert.rejects(f.repo.upload('m',file('v1'),{requestId:'other'},client),/açık belge/);
  await f.repo.upload('m',file('v1'),{requestId:'request'},client);
  assert.equal(f.rows()[0].tasks[0].status,'review'); assert.equal(f.rows()[0].documents[0].requestId,'request');
  await assert.rejects(f.repo.upload('m',file('v2'),{requestId:'request'},client),/açık belge/);
});
