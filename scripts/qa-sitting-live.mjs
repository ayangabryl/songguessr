// Creates an isolated QA table. Override QA_BASE to explicitly test a deployed endpoint.
import assert from 'node:assert/strict'
const base=process.env.QA_BASE || 'http://127.0.0.1:3000'
const {code}=await fetch(base+'/api/sitting',{method:'POST'}).then(r=>r.json())
const delay=ms=>new Promise(r=>setTimeout(r,ms))
const until=async fn=>{for(let i=0;i<300;i++){if(fn())return;await delay(50)}throw new Error('Timed out waiting for peer event')}
const peers=[]
function peer(i){const events=[];let state,closeCode;const url=`${base.replace(/^http/,'ws')}/api/sitting/${code}/ws?playerId=release-qa-${i}&token=release-qa-token-${i}-12345678901234567890&name=Release%20QA%20${i}&points=0`;const ws=new WebSocket(url)
const p={ws,events,url,get state(){return state},get closeCode(){return closeCode}}
ws.onmessage=e=>{if(e.data==='pong'){events.push({type:'pong'});return}const m=JSON.parse(e.data);events.push(m);if(m.type==='state')state=m};ws.onclose=e=>{closeCode=e.code;console.log('CLOSE',i,e.code,e.reason,Date.now())};ws.onerror=e=>console.log('ERROR',i,e.message,e.error?.message,Date.now());peers.push(p);return p}
console.log('TABLE',code,Date.now());const a=peer(0),b=peer(1),c=peer(2)
try {
 await until(()=>peers.every(p=>p.state?.players.filter(x=>x.connected).length===3))
 a.ws.send('ping');await until(()=>a.events.some(e=>e.type==='pong'))
 const send=(p,action,seq,actor='release-qa-1')=>p.ws.send(JSON.stringify({type:'pet-motion',action,seq,actor,x:-1,y:2,vx:.2,vy:0}))
 const boards=peers.map(p=>p.events.filter(e=>e.type==='state').length)
 send(a,'lift',0);await until(()=>peers.every(p=>p.events.some(e=>e.type==='pet-motion'&&e.action==='lift')))
 for(let seq=1;seq<=6;seq++){await delay(80);send(a,'drag',seq)}
 await until(()=>peers.every(p=>p.events.some(e=>e.type==='pet-motion'&&e.seq===6)))
 assert.deepEqual(peers.map(p=>p.events.filter(e=>e.type==='state').length),boards,'drag must not broadcast/re-render the match board')
 send(c,'lift',0);await until(()=>c.events.some(e=>e.type==='pet-motion'&&e.from==='server'&&e.action==='drop'))
 send(a,'drop',7);await until(()=>peers.every(p=>p.events.some(e=>e.type==='pet-motion'&&e.from==='release-qa-0'&&e.action==='drop')))
 send(b,'jump',0);await until(()=>peers.every(p=>p.events.some(e=>e.type==='pet-motion'&&e.action==='jump')))
 a.ws.send(JSON.stringify({type:'pet-pulse'}));await until(()=>peers.every(p=>p.events.some(e=>e.type==='pet-social')))
 const social=peers.map(p=>p.events.find(e=>e.type==='pet-social'));assert.deepEqual(social[0],social[1]);assert.deepEqual(social[1],social[2])
 send(a,'lift',8);await delay(100);a.ws.close(1000,'QA reconnect');await until(()=>b.events.some(e=>e.type==='pet-motion'&&e.seq===8&&e.action==='drop'))
 await until(()=>a.closeCode===1000);const back=peer(0);await until(()=>back.state);send(back,'lift',0);await until(()=>b.events.some(e=>e.type==='pet-motion'&&e.seq===0&&e.at>social[0].at&&e.action==='lift'))
 const replacement=peer(0);await until(()=>replacement.state&&back.closeCode===4001)
 if(process.env.QA_SOAK==='1') {
  for(let cycle=0;cycle<3;cycle++) {
   await delay(21000);
   const current=[b,c,replacement];
   const counts=current.map(p=>p.events.filter(e=>e.type==='pong').length);
   current.forEach(p=>p.ws.send('ping'));
   await until(()=>current.every((p,i)=>p.events.filter(e=>e.type==='pong').length>counts[i]));
   console.log('HEARTBEAT_CYCLE',cycle+1);
  }
 }
 for(const p of peers)if(p.ws.readyState===1)p.ws.close(1000,'QA complete');
 await until(()=>peers.every(p=>p.closeCode===1000||p.closeCode===4001));
 console.log(JSON.stringify({code,cleanClose:true,peers:3,heartbeat:'pong',drag:'all peers received positions; no board broadcasts',ownership:'conflicting grab rejected',jump:'relayed',social:'same event on all peers',disconnect:'held actor released',reconnect:'sequence restarted',replacement:back.closeCode}))
} catch(error) {console.log('FAILED_TABLE',code);console.log(JSON.stringify(peers.map(p=>({close:p.closeCode,events:p.events.map(e=>({type:e.type,action:e.action,from:e.from,error:e.error,message:e.message,players:e.players?.map(x=>({id:x.id,connected:x.connected}))}))})),null,2));throw error} finally {for(const p of peers)p.ws.close()}
