import assert from 'node:assert/strict'
import {test} from 'node:test'
import * as THREE from 'three'
import {createFashion,loadFashionData} from './fashion.ts'
import {fashionBones} from './fashion-data.ts'

test('lazy wearables respect the newest selection, wake static scenes, and do not remount after disposal',async()=>{
  const skeleton=new THREE.Skeleton(fashionBones.map(name=>{const b=new THREE.Bone();b.name=name;return b}))
  const root=new THREE.Group();let wakes=0
  const fashion=createFashion(root,skeleton,()=>{wakes++})
  fashion.update({pose:'idle',footwear:'boots',paused:true})
  fashion.update({pose:'idle',footwear:'sandals',paused:true})
  assert.equal(root.children.length,0,'meshes load only when requested')
  await loadFashionData(['boots','sandals']); await Promise.resolve()
  assert(wakes>0,'a paused or reduced-motion scene needs a render after the download')
  assert(root.children.some(o=>o.visible&&o.userData.fashion==='sandals'))
  assert(!root.children.some(o=>o.visible&&o.userData.fashion==='boots'),'a late response cannot restore an old selection')
  fashion.update({pose:'idle',headgear:'crown',footwear:'sandals'})
  fashion.dispose();const before=wakes
  await loadFashionData(['crown']);await Promise.resolve()
  assert.equal(root.children.length,0);assert.equal(wakes,before)
  skeleton.dispose()
})
