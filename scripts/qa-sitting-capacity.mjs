// Local transport capacity check; does not claim production or database capacity.
import assert from 'node:assert/strict'
const base=process.env.QA_BASE || 'http://127.0.0.1:3000'
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Local only')
const target=Number(process.env.QA_PLAYERS || 1000)
assert(Number.isInteger(target)&&target>=2&&target<=1000)
const delay=ms=>new Promise(r=>setTimeout(r,ms))
const peers=[], rooms=[], errors=[], latency=[]
let delivered=0
async function until(fn){for(let i=0;i<1200;i++){if(fn())return;await delay(50)}throw Error('Transport timed out')}
async function openRoom(size){
 const r=await fetch(base+'/api/sitting',{method:'POST'});assert(r.ok)
 const {code}=await r.json(), room=[];rooms.push(room)
 for(let i=0;i<size;i++){
  const id=crypto.randomUUID(),token=crypto.randomUUID()
  const ws=new WebSocket(`${base.replace(/^http/,'ws')}/api/sitting/${code}/ws?${new URLSearchParams({playerId:id,token,name:'Capacity '+i})}`)
  const p={ws,id,state:null,sent:0,pong:false};room.push(p);peers.push(p)
  ws.onmessage=e=>{if(e.data==='pong'){p.pong=true;latency.push(performance.now()-p.sent);return}const m=JSON.parse(e.data);if(m.type==='state')p.state=m;if(m.type==='pet-motion'&&m.action==='jump')delivered++}
  ws.onerror=()=>errors.push('socket error')
  await until(()=>p.state?.players.some(x=>x.id===id))
 }
 return room
}
const started=performance.now()
try {
 for(let count=0;count<target;count+=100){
  await Promise.all(Array.from({length:Math.ceil(Math.min(100,target-count)/10)},(_,i)=>openRoom(Math.min(10,target-count-i*10))))
  console.log('CONNECTED',peers.length)
 }
 assert.equal(peers.length,target)
 await until(()=>rooms.every(room=>room.every(p=>p.state?.players.filter(x=>x.connected).length===room.length)))
 const connectMs=performance.now()-started
 for(const p of peers){p.sent=performance.now();p.ws.send('ping')}
 await until(()=>peers.every(p=>p.pong))
 for(const room of rooms)for(const p of room)p.ws.send(JSON.stringify({type:'pet-motion',action:'jump',actor:p.id,seq:0,x:0,y:0,vx:0,vy:0}))
 const expected=rooms.reduce((n,room)=>n+room.length**2,0)
 await until(()=>delivered>=expected)
 await delay(2000)
 assert.equal(peers.filter(p=>p.ws.readyState===1).length,target)
 assert.equal(errors.length,0)
 latency.sort((a,b)=>a-b)
 console.log(JSON.stringify({players:target,rooms:rooms.length,connectMs:Math.round(connectMs),heartbeatP50ms:Math.round(latency[Math.floor(latency.length*.5)]),heartbeatP95ms:Math.round(latency[Math.floor(latency.length*.95)]),motionDeliveries:delivered,errors:errors.length,scope:'local WebSocket transport only; no audio, D1 queries or production load'}))
} finally {for(const p of peers)if(p.ws.readyState===1)p.ws.close(1000,'Capacity QA complete')}
