import React from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider,useAuth} from '../../src/features/auth/AuthContext.jsx';
import {Routes} from '../../src/app/Root.jsx';
import '../../src/style.css';
const callbacks=new Set();let hold=false,pending=[];
const client={auth:{
 onAuthStateChange(fn){callbacks.add(fn);return{data:{subscription:{unsubscribe(){callbacks.delete(fn);}}}};},
 async getSession(){return{data:{session:null}};},
 async getUser(token){return{data:{user:{id:token}}};},
 async signOut(){for(const callback of callbacks)callback('SIGNED_OUT',null);return{};}
}};
const identity=id=>({account:{user_id:id,display_name:id,role:id==='Yeni müvekkil'?'client':'lawyer',status:'pending'},application:{status:'pending',kind:id==='Yeni müvekkil'?'client':'lawyer'},memberships:[]});
const repository={getIdentity(id){if(hold){hold=false;return new Promise(resolve=>pending.push(()=>resolve(identity(id))));}return Promise.resolve(identity(id));}};
function enter(id){history.replaceState({},'',location.pathname);for(const callback of callbacks)callback('SIGNED_IN',{user:{id},access_token:id});}
function Controls(){const auth=useAuth();return <div role="region" aria-label="Sentetik oturum kontrolleri" style={{padding:16,background:'#eef4f1',display:'flex',gap:8,flexWrap:'wrap'}}><strong>Yalnız sentetik oturum testi</strong><button onClick={()=>enter('Önceki avukat')}>Kod temizlendikten sonra giriş</button><button onClick={()=>{hold=true;enter('Bekleyen avukat');}}>Hesap yanıtını beklet</button><button onClick={()=>auth.signOut()}>Çıkış yap</button><button onClick={()=>enter('Yeni müvekkil')}>Yeni hesapla giriş</button><button onClick={()=>{pending.forEach(resolve=>resolve());pending=[];}}>Eski yanıtı bırak</button><button onClick={()=>{location.hash='error=access_denied&error_code=otp_expired';}}>Süresi dolan bağlantı</button><output aria-label="Oturum durumu">{JSON.stringify({user:auth.session?.user.id||null,identity:auth.identity?.account.user_id||null,loading:auth.loading,error:auth.error})}</output></div>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><AuthProvider client={client} repository={repository}><Controls/><Routes/></AuthProvider></React.StrictMode>);
