import test from 'node:test';
import assert from 'node:assert/strict';
import {createSavedViewRepository} from '../src/data/savedViewRepository.js';
const fixture=()=>{const map=new Map();let n=0;return{storage:{getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)},makeId:()=>String(++n),now:()=> '2026-11-01T09:00:00Z'}};
test('kaydetme, yeniden oluşturulan store ve kullanıcı namespace ayrılığı',()=>{
  const f=fixture(),a=createSavedViewRepository({...f,ownerId:'lawyer-a'});a.save({name:'İş dosyaları',view:{types:['İş']},pinned:true});
  const reloaded=createSavedViewRepository({...f,ownerId:'lawyer-a'}),b=createSavedViewRepository({...f,ownerId:'lawyer-b'});
  assert.equal(reloaded.list()[0].view.types[0],'İş');assert.equal(b.list().length,0);
});
test('yalnız bir varsayılan görünüm kalır; sabitler önce sıralanır',()=>{
  const store=createSavedViewRepository({...fixture(),ownerId:'a'});
  store.save({name:'A',view:{},isDefault:true});store.save({name:'Z',view:{shared:'yes'},isDefault:true,pinned:true});
  assert.equal(store.list().filter(v=>v.isDefault).length,1);assert.equal(store.getDefault().name,'Z');assert.equal(store.list()[0].name,'Z');
});
test('silme geri alınabilir; geri alma yeni varsayılanı değiştirmez',()=>{
  const store=createSavedViewRepository({...fixture(),ownerId:'a'}),first=store.save({name:'A',view:{},isDefault:true});
  store.remove(first.id);assert.equal(store.list().length,0);store.save({name:'B',view:{},isDefault:true});store.restore(first.id);
  assert.equal(store.list().length,2);assert.equal(store.getDefault().name,'B');
});
test('boş/tekrar ad, başka owner id ve quota hatası sessiz başarı olmaz',()=>{
  const f=fixture(),store=createSavedViewRepository({...f,ownerId:'a'});assert.throws(()=>store.save({name:'   ',view:{}}));
  store.save({name:'Duruşmalar',view:{}});assert.throws(()=>store.save({name:'DURUŞMALAR',view:{}}));
  assert.throws(()=>store.save({id:'unknown',name:'B',view:{}}));
  const broken=createSavedViewRepository({...f,ownerId:'broken',storage:{getItem:()=>null,setItem:()=>{throw new Error('quota')}}});
  assert.throws(()=>broken.save({name:'A',view:{}}),/quota/);
});
test('dönen kayıt kopyaları kalıcı kaydı değiştirmaz',()=>{
  const store=createSavedViewRepository({...fixture(),ownerId:'a'}),view=store.save({name:'A',view:{types:['İş']}});
  view.view.types.push('Ceza');const list=store.list();list[0].view.types=[];
  assert.deepEqual(store.list()[0].view.types,['İş']);
});
