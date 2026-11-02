import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrackingWorkspaceController} from '../src/data/trackingWorkspaceController.js';
import {createTrackingSupabaseRepository} from '../src/data/trackingSupabaseRepository.js';
import {createTrackingFixtureClient,fixtureIds,lawyerFixture,clientFixture} from './fixtures/tracking-workspace-fixture.js';

function setup(role='lawyer',matters){
 const fixture=createTrackingFixtureClient({role,...(matters?{matters}:{})}),repository=createTrackingSupabaseRepository(fixture.client);
 const session=createTrackingWorkspaceController(repository,{userId:fixtureIds[role],role,organizationId:fixtureIds.org});
 return{...fixture,repository,session};
}
test('controller→real adapter→synthetic RPC loads role-selected DTO without browser storage or demo fallback',async()=>{
 const {session,requests}=setup();await session.load();assert.equal(session.getSnapshot().status,'ready');assert.equal(session.getSnapshot().items.length,1);await session.open(fixtureIds.matter);
 assert.equal(session.getSnapshot().selected.audience,'lawyer');assert.ok(requests.some(r=>r.name==='lr_get_tracking_matter'));assert.ok(Object.isFrozen(session.getSnapshot()));session.dispose();
});
test('lost mutation response retries the same UUID and does not duplicate the committed note',async()=>{
 const {session,requests,loseNextMutationReply,inspect}=setup();await session.load();await session.open(fixtureIds.matter);loseNextMutationReply();
 assert.equal(await session.save('add_note',{body:'Synthetic once-only note'}),false);assert.equal(session.getSnapshot().status,'error');assert.equal(session.getSnapshot().canRetry,true);
 await session.retry();const writes=requests.filter(r=>r.name==='lr_tracking_command');assert.equal(writes.length,2);assert.equal(writes[0].args.p_key,writes[1].args.p_key);
 assert.equal(inspect()[0].matter.internalNotes.filter(n=>n.body==='Synthetic once-only note').length,1);session.dispose();
});
test('access revocation and audience mismatch clear every cached dossier',async()=>{
 const {session,failNext,setMatters}=setup();await session.load();await session.open(fixtureIds.matter);failNext({code:'42501',message:'synthetic denial'});
 assert.equal(await session.save('add_note',{body:'blocked'}),false);assert.equal(session.getSnapshot().status,'access-denied');assert.deepEqual(session.getSnapshot().items,[]);assert.equal(session.getSnapshot().selected,null);
 setMatters([clientFixture()]);assert.equal(await session.load(),false);assert.equal(session.getSnapshot().selected,null);assert.deepEqual(session.getSnapshot().items,[]);session.dispose();
});
test('missing migration RPC selects setup-required and never tries a raw table or demo repository',async()=>{
 const {session,failNext,requests}=setup();failNext({code:'PGRST202',message:'synthetic v2 RPC missing'});assert.equal(await session.load(),false);
 assert.equal(session.getSnapshot().status,'setup-required');assert.equal(session.getSnapshot().selected,null);assert.deepEqual(session.getSnapshot().items,[]);assert.ok(requests.every(r=>r.name.startsWith('lr_')));session.dispose();
});
test('older open response and disposed account cannot overwrite newer selected dossier',async()=>{
 const {session,holdNext}=setup('lawyer',[lawyerFixture(),lawyerFixture(fixtureIds.other)]);await session.load();const release=holdNext();const old=session.open(fixtureIds.matter);await session.open(fixtureIds.other);release();await old;
 assert.equal(session.getSnapshot().selected.matter.id,fixtureIds.other);
 const release2=holdNext();const pending=session.open(fixtureIds.matter);session.dispose();release2();await pending;assert.equal(session.getSnapshot().selected,null);assert.deepEqual(session.getSnapshot().items,[]);
});
test('separate client account renders only server client DTO and cannot issue lawyer writes',async()=>{
 const client=setup('client');await client.session.load();await client.session.open(fixtureIds.matter);const state=client.session.getSnapshot();assert.equal(state.selected.audience,'client');assert.ok(!JSON.stringify(state).includes('INTERNAL_ONLY_SENTINEL'));
 assert.equal(await client.session.save('add_note',{body:'forged'}),false);assert.ok(!client.requests.some(r=>r.name==='lr_tracking_command'));client.session.dispose();
});
test('HTML proceeding transport keys are removed before the strict atomic RPC boundary',async()=>{
 const {session,requests}=setup();await session.load();await session.open(fixtureIds.matter);
 await session.save('add_event',{eventType:'tebligat_alindi',title:'Sentetik tebliğ',occurredOn:'2026-11-01',servedOn:'2026-11-01',serviceMethod:'Fixture',sourceReference:'Fixture source',suggestion:'1',taskIndexes:[0,1],requestDeadlineReview:true});
 const r=requests.find(r=>r.name==='lr_add_proceeding');assert.ok(r);assert.ok(!('suggestion'in r.args.p_event));assert.equal(r.args.p_tasks.length,2);assert.equal(r.args.p_deadlines[0].proposedDueAt,null);session.dispose();
});
test('wrong selected id, duplicate list ids and unexpected nested client fields fail closed',async()=>{
 const wrong=setup();await wrong.session.load();wrong.client.rpc=async()=>({data:lawyerFixture(fixtureIds.other),error:null});assert.equal(await wrong.session.open(fixtureIds.matter),false);assert.equal(wrong.session.getSnapshot().selected,null);assert.deepEqual(wrong.session.getSnapshot().items,[]);wrong.session.dispose();
 const duplicate=setup('lawyer',[lawyerFixture(),lawyerFixture()]);assert.equal(await duplicate.session.load(),false);assert.deepEqual(duplicate.session.getSnapshot().items,[]);duplicate.session.dispose();
 const c=clientFixture();c.matter.documents=[{id:'doc',name:'fixture.pdf',category:'diger',shared:true,versions:[{id:'v',objectPath:'PRIVATE_PATH'}]}];
 const malformed=setup('client',[c]);assert.equal(await malformed.session.load(),false);assert.deepEqual(malformed.session.getSnapshot().items,[]);assert.equal(malformed.session.getSnapshot().selected,null);malformed.session.dispose();
});
test('creating after a lost response keeps the same command key and never duplicates its private dossier',async()=>{
 const {session,requests,loseNextMutationReply,inspect}=setup();await session.load();loseNextMutationReply();
 assert.equal(await session.create({type:'icra',subtype:'İlamsız takip',title:'Once-only created fixture',stageKey:'hazirlik',clientMode:'none'}),false);assert.equal(session.getSnapshot().canRetry,true);
 await session.retry();assert.equal(inspect().filter(x=>x.matter.title==='Once-only created fixture').length,1);const writes=requests.filter(r=>r.name==='lr_create_matter');assert.equal(writes[0].args.p_key,writes[1].args.p_key);assert.equal(session.getSnapshot().selected.matter.shared,false);session.dispose();
});
