import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrackingSupabaseRepository} from '../src/data/trackingSupabaseRepository.js';
import {decodeTrackingDTO,clientTrackingDTO} from '../src/domain/tracking-contract.js';
import {EXPECTED_SUPABASE_ORIGIN} from '../src/domain/project-identity.js';
const clientDTO=()=>({schemaVersion:2,audience:'client',matter:{id:'fixture-id',title:'Shared title',number:null,stage:'Shared stage',summary:'Shared summary',events:[],agendaItems:[],requests:[],messages:[],documents:[]}});
function fake(reply=clientDTO()){
 const calls=[],storageCalls=[];
 const client={supabaseUrl:EXPECTED_SUPABASE_ORIGIN,
  rpc:async(name,args)=>{calls.push({name,args});return{data:structuredClone(reply),error:null};},
  storage:{from(bucket){return{
   upload:async(path,blob,options)=>{storageCalls.push({method:'upload',bucket,path,options});return{error:null};},
   download:async path=>{storageCalls.push({method:'download',bucket,path});return{data:new Blob(['fixture']),error:null};}
  };}}
 };
 return{client,calls,storageCalls,repo:createTrackingSupabaseRepository(client)};
}
test('tracking factory rejects another Supabase project before invoking any RPC',()=>{
 assert.throws(()=>createTrackingSupabaseRepository({supabaseUrl:'https://wrong-project.supabase.co',rpc(){throw new Error('must not run');}}),/Lawroom/);
});
test('client DTO rejects internal fields at root and every nested surface',()=>{
 for(const mutate of [m=>m.internalNotes=[],m=>m.events=[{id:'e',title:'ok',occurredOn:'2026-01-01',note:'private'}],m=>m.documents=[{id:'d',name:'a.pdf',category:'diger',shared:true,versions:[{id:'v',objectPath:'private-path'}]}],m=>m.requests=[{id:'r',title:'request',dueOn:null,status:'open',assigneeId:'private'}]]){
  const dto=clientDTO();mutate(dto.matter);assert.throws(()=>decodeTrackingDTO(dto),/sözleşmesi/);
 }
 assert.throws(()=>decodeTrackingDTO({...clientDTO(),actorId:'forged'}),/sözleşmesi/);
 const original=clientDTO(),copy=clientTrackingDTO(original);copy.title='changed';assert.equal(original.matter.title,'Shared title');
});
test('adapter keeps server-selected audience and calls only RPCs; database error never falls back to demo',async()=>{
 const {repo,calls,client}=fake();const dto=await repo.get('fixture-id');assert.equal(dto.audience,'client');assert.equal(calls[0].name,'lr_get_tracking_matter');assert.deepEqual(calls[0].args,{p_matter:'fixture-id'});
 const error={code:'42501',message:'denied'};client.rpc=async()=>({error});await assert.rejects(repo.get('fixture-id'),x=>x===error);
});
test('proceeding suggestions are selected once and sent in one atomic RPC without actor or role',async()=>{
 const {repo,calls}=fake();await repo.addProceeding({id:'m',type:'İcra'},{eventType:'tebligat_alindi',occurredOn:'2026-11-01',taskIndexes:[0,0,1],requestDeadlineReview:true},'retry-key');
 const {name,args}=calls[0];assert.equal(name,'lr_add_proceeding');assert.equal(args.p_tasks.length,2);assert.equal(args.p_deadlines[0].proposedDueAt,null);assert.equal(args.p_key,'retry-key');assert.ok(!('taskIndexes'in args.p_event));assert.ok(!('actorId'in args));
 await assert.rejects(repo.addProceeding({id:'m',type:'İcra'},{eventType:'tebligat_alindi',taskIndexes:[99]}),/önerisi/);assert.equal(calls.length,1);
});
test('version upload uses immutable reservation with upsert false and finalizes only after Storage succeeds',async()=>{
 const {repo,calls,storageCalls,client}=fake();const reservation={bucket:'lr-matter-files',objectPath:'synthetic/path/version-uuid',versionId:'v'};
 await repo.upload(reservation,new Blob(['fixture'],{type:'application/pdf'}));assert.equal(storageCalls[0].options.upsert,false);assert.equal(calls[0].name,'lr_finalize_tracking_document');
 const error=new Error('upload denied');client.storage.from=()=>({upload:async()=>({error})});await assert.rejects(repo.upload(reservation,new Blob(['fixture'])),/upload denied/);assert.equal(calls.length,1);
});
test('download requests fresh authorization then authenticated Storage GET without signed URL',async()=>{
 const {repo,client,calls,storageCalls}=fake();client.rpc=async(name,args)=>{calls.push({name,args});return{data:'synthetic/current/path',error:null};};
 assert.ok(await repo.download('v') instanceof Blob);assert.equal(calls[0].name,'lr_tracking_document_path');assert.equal(storageCalls[0].method,'download');assert.equal(storageCalls[0].path,'synthetic/current/path');
});
