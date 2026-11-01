import test,{beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {demoRepository} from '../src/data/demoRepository.js';
const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
let storage;
beforeEach(()=>{
  storage=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))}});
});
after(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage});

test('demo dosyaları kaydedilip yeniden okunur; açıkça boş liste korunur',()=>{
  const matters=[{id:'local-test',title:'Fixture',tasks:[],events:[],messages:[]}];
  demoRepository.saveMatters(matters);assert.deepEqual(demoRepository.listMatters(),matters);
  demoRepository.saveMatters([]);assert.deepEqual(demoRepository.listMatters(),[]);
});
test('bozuk kayıt varsayılanı geri getirir; dönen kopyalar ortak seed verisini değiştirmez',()=>{
  storage.set('lawroom-demo-v1','invalid-json');
  const first=demoRepository.listMatters();assert.ok(first.length);
  const originalTitle=first[0].title;first[0].title='changed';first[0].tasks.push({id:'not-persisted'});
  const second=demoRepository.listMatters();assert.equal(second[0].title,originalTitle);assert.equal(second[0].tasks.some(t=>t.id==='not-persisted'),false);
  storage.set('lawroom-demo-v1',JSON.stringify({not:'a list'}));assert.ok(demoRepository.listMatters().length);
});
test('ajanda deposu dosya deposundan ayrıdır; yeniden yüklemede kalır',()=>{
  const agenda=[{id:'a',lawyer:'fixture-lawyer',kind:'hearing',date:'2026-11-01',title:'Fixture',status:'planned'}];
  demoRepository.saveMatters([]);demoRepository.saveAgenda(agenda);
  assert.deepEqual(demoRepository.listMatters(),[]);assert.deepEqual(demoRepository.listAgenda(),agenda);
});
test('tarayıcı yazma hatası sessiz başarı sayılmaz',()=>{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{throw new Error('quota fixture')}}});
  assert.throws(()=>demoRepository.saveMatters([]),/quota fixture/);
});
test('UI modülleri kalıcı browser verisini veya Supabase satır API sini doğrudan açmaz',async()=>{
  const root=new URL('../src/',import.meta.url),violations=[];
  async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory()){await walk(path);continue}
    if(!/\.[jt]sx?$/u.test(entry.name))continue;
    const relative=path.href.slice(root.href.length);
    if(relative.startsWith('data/'))continue;
    const content=await readFile(path,'utf8');
    if(/\b(?:localStorage|sessionStorage)\s*\./u.test(content))violations.push(relative+': direct browser persistence');
    if(/\bsupabase\s*\.\s*(?:from|rpc|storage)\b/u.test(content))violations.push(relative+': direct row/storage API');
    if(relative!=='lib/supabase.js'&&/\bcreateClient\s*\(/u.test(content))violations.push(relative+': creates data client outside lib');
  }}
  await walk(root);assert.deepEqual(violations,[]);
});
