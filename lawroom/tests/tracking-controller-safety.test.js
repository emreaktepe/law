import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrackingWorkspaceController} from '../src/data/trackingWorkspaceController.js';
import {createTrackingDocumentBridge} from '../src/data/trackingDocumentBridge.js';
import {lawyerFixture,clientFixture,fixtureIds} from './fixtures/tracking-workspace-fixture.js';
const options={userId:fixtureIds.lawyer,role:'lawyer',organizationId:fixtureIds.org};
test('istek ve yanıt dosya kimliği uyuşmazsa hiçbir içerik kalmaz',async()=>{
 const c=createTrackingWorkspaceController({list:async()=>[lawyerFixture()],get:async()=>lawyerFixture(fixtureIds.other)},options);
 await c.load();assert.equal(await c.open(fixtureIds.matter),false);assert.equal(c.getSnapshot().status,'access-denied');assert.deepEqual(c.getSnapshot().items,[]);c.dispose();
});
test('Storage yanıtı kaybolunca aynı rezervasyon korunur; 409 sonrası yalnız o sürüm finalize edilir',async()=>{
 let reserves=0,uploads=0,finalizes=0;
 const repository={get:async()=>lawyerFixture(),reserveDocument:async()=>{reserves++;return{versionId:'same-version'};},upload:async()=>{uploads++;throw uploads===1?{code:'NETWORK'}:{statusCode:'409'};},finalizeDocument:async id=>{assert.equal(id,'same-version');finalizes++;}};
 const c=createTrackingWorkspaceController(repository,options);await c.open(fixtureIds.matter);
 assert.equal(await c.upload(new File(['fixture'],'proof.pdf',{type:'application/pdf'})),false);assert.equal(c.getSnapshot().canRetry,true);
 assert.equal(await c.retry(),true);assert.equal(reserves,1);assert.equal(uploads,2);assert.equal(finalizes,1);c.dispose();
});
test('yetki reddinden sonraki retry mutasyonu tekrar göndermek yerine listeyi yeniden yükler',async()=>{
 let writes=0,loads=0;
 const c=createTrackingWorkspaceController({get:async()=>lawyerFixture(),command:async()=>{writes++;throw{code:'42501'};},list:async()=>{loads++;return[];}},options);
 await c.open(fixtureIds.matter);await c.save('add_note',{body:'blocked'});await c.retry();assert.equal(writes,1);assert.equal(loads,1);assert.equal(c.getSnapshot().selected,null);c.dispose();
});
test('belge köprüsü başka seçili dosyanın sürümünü yerel depodan aramaz',async()=>{
 const c=createTrackingWorkspaceController({get:async()=>lawyerFixture()},options);await c.open(fixtureIds.matter);
 const bridge=createTrackingDocumentBridge(c);await assert.rejects(bridge.download(fixtureIds.other,'d','v'),/Açık dosya değişti/);
 await assert.rejects(bridge.download(fixtureIds.matter,'d','stale-version'),/açık dosyada bulunamadı/);c.dispose();
});
test('müvekkil bağlantı, dosya türetme ve belge paylaşımını avukat RPC sine gönderemez',async()=>{
 let writes=0;const blocked=async()=>{writes++;throw new Error('must not run');};
 const c=createTrackingWorkspaceController({get:async()=>clientFixture(),link:blocked,derive:blocked,shareDocument:blocked},{...options,userId:fixtureIds.client,role:'client'});
 for(const invoke of [()=>c.link(fixtureIds.other,'related'),()=>c.derive({linkKind:'related'}),()=>c.shareDocument('document',true)]){await c.open(fixtureIds.matter);assert.equal(await invoke(),false);assert.equal(c.getSnapshot().status,'access-denied');}
 assert.equal(writes,0);c.dispose();
});
