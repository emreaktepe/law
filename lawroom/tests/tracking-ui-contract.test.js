import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingCommandPayload,trackingCreatePayload,trackingV2Enabled}from'../src/domain/tracking-ui-contract.js';
test('yeni takip gate varsayılan kapalıdır; yalnız açık true değeri etkinleştirir',()=>{
 for(const value of [undefined,'','false','1',true,'TRUE'])assert.equal(trackingV2Enabled({VITE_TRACKING_V2_ENABLED:value}),false);
 assert.equal(trackingV2Enabled({VITE_TRACKING_V2_ENABLED:'true'}),true);
});
test('safahat, ajanda ve duruşma yardımcı form alanları strict RPC ye girmez',()=>{
 const event=trackingCommandPayload('add_event',{eventType:'tebligat_alindi',suggestion:'1',taskIndexes:[0,1]});assert.equal(event.suggestion,undefined);assert.deepEqual(event.taskIndexes,[0,1]);
 const agenda=trackingCommandPayload('add_agenda',{date:'2026-11-02',time:'10:00',startsAt:'2026-11-02T10:00:00+03:00'});assert.equal(agenda.date,undefined);assert.equal(agenda.time,undefined);
 const hearing=trackingCommandPayload('hearing_outcome',{id:'h',taskDue:'2026-11-02',nextDate:'2026-12-01',location:'UI only',tasks:[{title:'İncele',dueOn:'2026-11-03',extra:'not sent'}],nextHearing:{title:'Duruşma',startsAt:'future',date:'UI only'}});
 assert.equal(hearing.taskDue,undefined);assert.equal(hearing.location,undefined);assert.equal(hearing.tasks[0].extra,undefined);assert.equal(hearing.nextHearing.date,undefined);
});
test('yetki alanları reddedilir; belge talebinde açık istemci gerekir; org sunucu kimliğinden gelir',()=>{
 assert.throws(()=>trackingCommandPayload('add_note',{body:'test',role:'admin'}),/yetkisi/);
 assert.deepEqual(trackingCommandPayload('add_party',{name:'Sentetik taraf',role:'Borçlu'}),{name:'Sentetik taraf',role:'Borçlu'});
 assert.throws(()=>trackingCommandPayload('add_task',{title:'Belge',kind:'client_document_request'}),/müvekkili/);
 assert.equal(trackingCommandPayload('add_task',{kind:'client_document_request',requestedClientId:'accepted'}).requestedClientId,'accepted');
 assert.equal(trackingCreatePayload({title:'Private'},'trusted-org').organizationId,'trusted-org');
 assert.throws(()=>trackingCreatePayload({organizationId:'forged'},'trusted-org'),/formdan/);
});
