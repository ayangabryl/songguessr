import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSittingConnection } from './sitting-connection.ts'
class Socket {
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((e: {data:string}) => void) | null = null
  onclose: ((e: {code:number;reason:string}) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  send(s:string) { this.sent.push(s) }
  close() { this.readyState = 3 }
  open() { this.readyState=1; this.onopen?.() }
  message(value:string) { this.onmessage?.({data:value}) }
  lost(code=1006, reason='') { this.readyState=3; this.onclose?.({code,reason}) }
}
function setup() {
  const sockets: Socket[] = [], failures:string[] = [], payloads:unknown[] = []
  let online=true
  const connection = createSittingConnection({url:'ws://localhost/test', isOnline:()=>online,
    makeSocket:()=>{const s=new Socket(); sockets.push(s); return s as unknown as WebSocket},
    onSocket:()=>{},onOpen:()=>{},onConnecting:()=>{},onSlow:()=>{},
    onFailure:r=>failures.push(r),onPayload:p=>payloads.push(p)})
  return {connection,sockets,failures,payloads,setOnline:(v:boolean)=>{online=v}}
}
test('failed handshakes retry repeatedly, rather than stopping after the first reconnect', t => {
  t.mock.timers.enable({apis:['setTimeout']})
  const x=setup()
  x.sockets[0].lost();t.mock.timers.tick(500);assert.equal(x.sockets.length,2)
  x.sockets[1].lost();t.mock.timers.tick(1000);assert.equal(x.sockets.length,3)
  x.sockets[2].open();x.sockets[2].message('{"type":"state"}')
  x.sockets[2].lost();t.mock.timers.tick(500);assert.equal(x.sockets.length,4)
  assert.deepEqual(x.failures,[]);x.connection.dispose()
})
test('heartbeat detects a silent socket and reconnects; pong is not application state', t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const x=setup();const s=x.sockets[0];s.open();s.message('{"type":"state"}')
  t.mock.timers.tick(20000);assert.deepEqual(s.sent,['ping'])
  s.message('pong');assert.equal(x.payloads.length,1)
  t.mock.timers.tick(20000);assert.deepEqual(s.sent,['ping','ping'])
  t.mock.timers.tick(8000);t.mock.timers.tick(500);assert.equal(x.sockets.length,2)
  x.connection.dispose()
})
test('malformed packets cannot clear the initial state timeout',t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const x=setup();x.sockets[0].open();x.sockets[0].message('garbage')
  t.mock.timers.tick(15000);t.mock.timers.tick(500);assert.equal(x.sockets.length,2)
  x.connection.dispose()
})
test('leaving cancels scheduled retries and ignores stale socket callbacks',t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const x=setup(), stale=x.sockets[0].onmessage!;x.sockets[0].lost();x.connection.dispose()
  t.mock.timers.tick(60000);stale({data:'{"type":"state"}'})
  assert.equal(x.sockets.length,1);assert.equal(x.payloads.length,0)
})
test('duplicate tabs cannot fight over one seat through automatic reconnects',t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const x=setup();x.sockets[0].lost(4001,'replaced');x.connection.resume();t.mock.timers.tick(60000)
  assert.deepEqual(x.failures,['replaced']);assert.equal(x.sockets.length,1);x.connection.dispose()
})
test('offline transitions preserve a recoverable connection for online/resume',t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const x=setup();x.setOnline(false);x.connection.offline();t.mock.timers.tick(60000)
  assert.equal(x.sockets.length,1);assert.deepEqual(x.failures,['offline'])
  x.setOnline(true);x.connection.resume();assert.equal(x.sockets.length,2);x.connection.dispose()
})
