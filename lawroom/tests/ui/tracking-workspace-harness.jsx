import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TrackingWorkspaceView} from '../../src/features/workspace/TrackingLiveWorkspace.jsx';
import {createTrackingSupabaseRepository} from '../../src/data/trackingSupabaseRepository.js';
import {createTrackingFixtureClient,fixtureIds,lawyerFixture,clientFixture} from '../fixtures/tracking-workspace-fixture.js';
import '../../src/style.css';

function Harness(){
 const [mode,setMode]=useState('lawyer'),[generation,setGeneration]=useState(0),[requestCount,setRequestCount]=useState(0),[release,setRelease]=useState(null);
 const active=useMemo(()=>{
  const role=mode==='client'?'client':'lawyer',dto=role==='client'?clientFixture():lawyerFixture();
  if(mode==='viewer'){dto.matter.readonly=true;dto.matter.members[0].role='viewer';}
  if(mode==='archived'){dto.matter.status='archived';dto.matter.archivedAt='2026-11-01T12:00:00Z';dto.matter.closedReason='Sentetik kapanış';dto.matter.closedOn='2026-11-01';dto.matter.readonly=true;dto.matter.shared=false;dto.matter.clients.forEach(c=>{c.shared=false;});}
  const fixture=createTrackingFixtureClient({role,matters:mode==='empty'?[]:[dto]});
  if(mode==='missing')fixture.alwaysFail({code:'PGRST202',message:'synthetic missing RPC'});
  if(mode==='denied')fixture.alwaysFail({code:'42501',message:'synthetic access denial'});
  const original=fixture.client.rpc.bind(fixture.client);fixture.client.rpc=async(...args)=>{const result=await original(...args);setRequestCount(fixture.requests.length);return result;};
  return{...fixture,repository:createTrackingSupabaseRepository(fixture.client),session:{user:{id:fixtureIds[role]}},identity:{account:{user_id:fixtureIds[role],display_name:role==='client'?'Sentetik Müvekkil':'Sentetik Avukat',role,status:'active'},memberships:role==='lawyer'?[{organization_id:fixtureIds.org,active:true,role:'owner'}]:[]}};
 },[mode,generation]);
 return <><div role="region" aria-label="Sentetik test kontrolleri" style={{padding:16,background:'#eef4f1',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><strong>Yalnız sentetik test — gerçek Supabase bağlantısı yok</strong><label>Senaryo<select value={mode} onChange={e=>{setMode(e.target.value);setRequestCount(0);setRelease(null);}}>{['lawyer','client','viewer','archived','empty','missing','denied'].map(x=><option key={x}>{x}</option>)}</select></label><button onClick={()=>setGeneration(n=>n+1)}>Testi sıfırla</button><button onClick={()=>active.failNext({code:'42501',message:'synthetic revoked'})}>Sonraki istekte erişimi iptal et</button><button onClick={()=>active.loseNextMutationReply()}>Sonraki kayıt yanıtını kaybet</button><button onClick={()=>{const finish=active.holdNext();setRelease(()=>finish);}}>Sonraki isteği beklet</button>{release&&<button onClick={()=>{release();setRelease(null);}}>Bekleyen isteği bırak</button>}<output aria-label="Mock RPC sayısı">{requestCount}</output></div>
 <React.StrictMode><TrackingWorkspaceView key={mode+'-'+generation} repository={active.repository} session={active.session} identity={active.identity} onSignOut={()=>{setMode('client');setGeneration(n=>n+1);}}/></React.StrictMode></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);
