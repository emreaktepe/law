import {sanitizeMatterView} from '../domain/matter-views.js';
const clone=value=>structuredClone(value);
const nameOf=value=>String(value??'').trim();

/** Local demo store only. Ownership is a browser namespace, not server authorization. */
export function createSavedViewRepository({storage,ownerId,makeId=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}){
  if(typeof ownerId!=='string'||!ownerId.trim()||ownerId.length>180)throw new TypeError('Görünüm sahibi gereklidir.');
  const key='lawroom-saved-views-v1:'+encodeURIComponent(ownerId);
  function read(){try{const parsed=JSON.parse(storage.getItem(key));if(parsed?.version!==1||parsed.ownerId!==ownerId||!Array.isArray(parsed.views))return[];
    return parsed.views.filter(v=>v&&typeof v.id==='string'&&typeof v.name==='string'&&v.name.length<=80).map(v=>({id:v.id,name:v.name,view:sanitizeMatterView(v.view??{}),pinned:Boolean(v.pinned),isDefault:Boolean(v.isDefault),createdAt:v.createdAt,updatedAt:v.updatedAt,deletedAt:typeof v.deletedAt==='string'?v.deletedAt:null}));
  }catch{return[]}}
  function write(views){storage.setItem(key,JSON.stringify({version:1,ownerId,views}))}
  function list(){return clone(read().filter(v=>!v.deletedAt).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||a.name.localeCompare(b.name,'tr')))}
  function save(input){
    const name=nameOf(input.name);if(!name||name.length>80)throw new Error('Görünüm adı 1–80 karakter olmalıdır.');
    const views=read(),previous=input.id?views.find(v=>v.id===input.id&&!v.deletedAt):null;
    if(input.id&&!previous)throw new Error('Görünüm bulunamadı.');
    if(views.some(v=>!v.deletedAt&&v.id!==previous?.id&&v.name.toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')))throw new Error('Bu adla bir görünüm zaten var.');
    const result={id:previous?.id??makeId(),name,view:sanitizeMatterView(input.view),pinned:Boolean(input.pinned),isDefault:Boolean(input.isDefault),createdAt:previous?.createdAt??now(),updatedAt:now(),deletedAt:null};
    const next=views.filter(v=>v.id!==result.id).map(v=>result.isDefault?{...v,isDefault:false}:v);next.push(result);write(next);return clone(result);
  }
  function remove(id){const views=read(),found=views.find(v=>v.id===id&&!v.deletedAt);if(!found)throw new Error('Görünüm bulunamadı.');write(views.map(v=>v.id===id?{...v,deletedAt:now(),isDefault:false}:v));return clone(found)}
  function restore(id){const views=read(),found=views.find(v=>v.id===id&&v.deletedAt);if(!found)throw new Error('Geri alınacak görünüm bulunamadı.');
    if(views.some(v=>!v.deletedAt&&v.name.toLocaleLowerCase('tr-TR')===found.name.toLocaleLowerCase('tr-TR')))throw new Error('Aynı adla yeni bir görünüm var; geri alma yapılamadı.');
    const result={...found,deletedAt:null,isDefault:false,updatedAt:now()};write(views.map(v=>v.id===id?result:v));return clone(result);
  }
  return {list,save,remove,restore,listDeleted:()=>clone(read().filter(v=>v.deletedAt)),getDefault:()=>list().find(v=>v.isDefault)??null};
}

export function browserSavedViewRepository(ownerId){
  return createSavedViewRepository({ownerId,storage:{getItem:key=>globalThis.localStorage.getItem(key),setItem:(key,value)=>globalThis.localStorage.setItem(key,value)}});
}
