import * as THREE from 'three'
import { frontSurface, HEAD_Y, surfaceOval } from './geometry.ts'

export function createFace(head: THREE.Bone, skin: THREE.MeshPhysicalMaterial) {
  const eyeUniforms = {
    nootGaze: { value: new THREE.Vector2() },
    nootBlink: { value: 0 },
    nootSquint: { value: 0 },
    nootSkin: { value: skin.color },
  }
  const eyeMaterial = new THREE.MeshPhysicalMaterial({ color: '#fffdf3', roughness: 0.42, clearcoat: 0.08, clearcoatRoughness: 0.4, envMapIntensity: .35 })
  // Iris, pupil and catchlights share one curved surface; no stacked eyeball disks.
  eyeMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, eyeUniforms)
    shader.vertexShader = 'varying vec2 nootUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nnootUv = uv;')
    shader.fragmentShader = `varying vec2 nootUv;
      uniform vec2 nootGaze;
      uniform float nootBlink;
      uniform float nootSquint;
      uniform vec3 nootSkin;\n` + shader.fragmentShader


    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 eye = (nootUv - .5) * 2.;
      vec2 iris = (eye - nootGaze - vec2(.015,-.02)) * vec2(1.,1.02);
      float r = length(iris);
      float angle = atan(iris.y, iris.x);
      float fibers = sin(angle * 57. + r * 22.) * sin(angle * 91. - r * 18.) * .018;
      vec3 amber = mix(vec3(.028,.010,.003), vec3(.22,.092,.022), smoothstep(.32,.60,r));
      amber += fibers * smoothstep(.3,.6,r);
      amber = mix(amber, vec3(.025,.012,.005), smoothstep(.60,.69,r));
      vec3 eyeColor = mix(amber, vec3(.96,.95,.90), smoothstep(.69,.72,r));
      eyeColor = mix(vec3(.005,.004,.003), eyeColor, smoothstep(.43,.46,r));
      float glint = 1. - smoothstep(.17,.195,length(iris-vec2(.25,.33)));
      float smallGlint = (1. - smoothstep(.025,.04,length(iris-vec2(-.22,-.28)))) * .55;
      eyeColor = mix(eyeColor, vec3(1.), max(glint,smallGlint));
      float upper = 1.05 - nootBlink * 1.25 - nootSquint * .28 + .10*nootBlink*(1.-eye.x*eye.x);
      float lower = -1.05 + nootBlink * .85 + nootSquint * .3 + .10*nootBlink*(1.-eye.x*eye.x);
      if (eye.y > upper || eye.y < lower) discard;
      diffuseColor.rgb = eyeColor;
    `)
  }
  eyeMaterial.customProgramCacheKey = () => 'noot-surface-eye-v3'
  const lidMaterial = skin.clone()
  lidMaterial.color = skin.color
  lidMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, eyeUniforms)
    shader.vertexShader = 'varying vec2 lidUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nlidUv = uv;')
    shader.fragmentShader = 'varying vec2 lidUv; uniform float nootBlink; uniform float nootSquint;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 eye = (lidUv-.5)*2.;
      float upper=1.05-nootBlink*1.25-nootSquint*.28+.10*nootBlink*(1.-eye.x*eye.x);
      float lower=-1.05+nootBlink*.85+nootSquint*.3+.10*nootBlink*(1.-eye.x*eye.x);
      if(eye.y < upper && eye.y > lower) discard;
      float fold=(1.-smoothstep(.008,.032,abs(eye.y-upper)))*smoothstep(.65,1.,nootBlink);
      diffuseColor.rgb *= 1.-fold*.22;
    `)
  }
  lidMaterial.customProgramCacheKey = () => 'noot-skin-eyelid-v1'
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(surfaceOval(side * 0.42, 2.015, 0.235, 0.275, 0.022, 0.009), eyeMaterial)
    eye.name = `eye-${side < 0 ? 'left' : 'right'}`
    eye.position.y = -HEAD_Y; head.add(eye)
    const lid = new THREE.Mesh(surfaceOval(side*.42,2.015,.235,.275,.022,.010),lidMaterial)
    lid.name = `skin-eyelid-${side}`; lid.position.y=-HEAD_Y; head.add(lid)
  }
  const ink = new THREE.MeshStandardMaterial({ color: '#244716', roughness: 0.8 })
  const pink = new THREE.MeshStandardMaterial({ color: '#dc9276', roughness: 0.85 })
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(surfaceOval(side * 0.63, 1.67, 0.095, 0.061, 0, 0.008), pink)
    cheek.position.y = -HEAD_Y; head.add(cheek)
  }
  function ribbon(name: string, count = 40) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((count + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage))
    const indices = []
    for (let i = 0; i < count; i++) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
    geometry.setIndex(indices)
    const mesh = new THREE.Mesh(geometry, ink); mesh.name = name; mesh.position.y = -HEAD_Y; mesh.frustumCulled = false; head.add(mesh)
    return geometry
  }
  const mouth = ribbon('expressive-smile')
  const brows = [ribbon('left-brow'), ribbon('right-brow')]
  const tongueMaterial = new THREE.MeshStandardMaterial({ color: '#e99897', roughness: 0.8 })
  const tongue = new THREE.Mesh(surfaceOval(0, 1.68, 0.065, 0.026, 0, 0.014), tongueMaterial)
  tongue.position.y = -HEAD_Y; tongue.visible = false; head.add(tongue)

  const expression = { smile: 1, open: 0, sad: 0 }
  function update(dt: number, blink: number, squint: number, smile: number, open: number, sad: number, gaze: THREE.Vector2) {
    const smooth = 1 - Math.exp(-dt * 12)
    expression.smile = THREE.MathUtils.lerp(expression.smile, smile, smooth)
    expression.open = THREE.MathUtils.lerp(expression.open, open, smooth)
    expression.sad = THREE.MathUtils.lerp(expression.sad, sad, smooth)
    eyeUniforms.nootBlink.value = blink
    eyeUniforms.nootSquint.value = squint
    eyeUniforms.nootGaze.value.lerp(gaze, 1 - Math.exp(-dt * 11))
    const p = mouth.getAttribute('position')
    for (let i = 0; i <= 40; i++) {
      const raw = i / 40 * 1.2 - .1, u = THREE.MathUtils.clamp(raw, 0, 1)
      const x = (raw - .5) * .22 * (1 + expression.open * .55)
      const cap = raw < 0 ? Math.sqrt(Math.max(0,1-(raw/.1)**2)) : raw > 1 ? Math.sqrt(Math.max(0,1-((raw-1)/.1)**2)) : 1
      const curve = Math.sin(Math.PI * u)
      const y = 1.78 - curve * .065 * expression.smile
      const width = .022 * cap + expression.open * .062 * Math.sqrt(Math.max(0,1-(u*2-1)**2))
      for (let edge = 0; edge < 2; edge++) {
        const yy = y + (edge === 0 ? -width : width)
        p.setXYZ(i * 2 + edge, x, yy, frontSurface(x, yy) + .011)
      }
    }
    p.needsUpdate = true; mouth.computeVertexNormals()
    tongue.visible = expression.open > .65
    for (let side = 0; side < 2; side++) {
      const p = brows[side].getAttribute('position'), sign = side === 0 ? -1 : 1
      for (let i = 0; i <= 40; i++) {
        const raw = i / 40 * 1.24 - .12, u = THREE.MathUtils.clamp(raw,0,1), x = sign * (.32 + raw * .20)
        const cap = raw < 0 ? Math.sqrt(Math.max(0,1-(raw/.12)**2)) : raw > 1 ? Math.sqrt(Math.max(0,1-((raw-1)/.12)**2)) : 1
        const y = 2.455 + Math.sin(u * Math.PI) * .055 - u * .06 + expression.sad * (.055 - .1 * u)
        const width = (.029 - .006*u) * cap
        for (let edge = 0; edge < 2; edge++) {
          const yy = y + (edge === 0 ? -width : width)
          p.setXYZ(i * 2 + edge, x, yy, frontSurface(x, yy) + .011)
        }
      }
      p.needsUpdate = true; brows[side].computeVertexNormals()
      // Mirroring x reverses the winding on the left eyebrow.
    }
  }
  ink.side = THREE.DoubleSide
  update(1, 0, 0, 1, 0, 0, new THREE.Vector2())
  return { update, pink }
}
