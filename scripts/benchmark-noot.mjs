// CPU benchmark of the actual GLB, mixer and accessory updates; GPU is reviewed separately.
import { readFile, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { createRequire } from 'node:module'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createNootFromAsset } from '../src/lib/noot/asset.ts'
const {PNG}=createRequire(import.meta.url)('pngjs')
Object.assign(globalThis,{self:globalThis,createImageBitmap:async blob=>({...PNG.sync.read(Buffer.from(await blob.arrayBuffer())),close(){}})})
const data=await readFile(new URL('../public/mascot/noot.glb',import.meta.url))
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'')
const pointer=new THREE.Vector2(), results=[]
for(const count of [1,2,6]) {
 const start=performance.now(), models=Array.from({length:count},(_,i)=>createNootFromAsset(gltf,`benchmark-${i}`)), creationMs=performance.now()-start
 models.forEach(model=>model.setCompact(count>=4))
 const states=models.map((_,i)=>({pose:['groove','body-roll','charleston','hip-sway'][i%4],difficulty:'easy',headgear:'headphones',clothing:i%2?'shirt':'none',directed:true,danceTime:0}))
 const frames=[]
 for(let frame=0;frame<360;frame++) {
  const before=performance.now()
  models.forEach((model,i)=>{states[i].danceTime=frame/60;model.update(frame/60,1/60,states[i],pointer,false);model.root.updateMatrixWorld(true)})
  if(frame>=60)frames.push(performance.now()-before)
 }
 frames.sort((a,b)=>a-b)
 results.push({characters:count,creationMs:+creationMs.toFixed(2),medianCpuMs:+frames[150].toFixed(3),p95CpuMs:+frames[285].toFixed(3)})
 models.forEach(m=>m.dispose())
}
const report={assetBytes:data.length,clips:gltf.animations.length,results,note:'Node CPU timings on the development Mac; excludes browser rendering and GPU time.'}
console.log(JSON.stringify(report,null,2))
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n')
