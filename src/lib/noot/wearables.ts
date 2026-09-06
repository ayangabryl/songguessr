import * as THREE from "three";
import { HEAD_Y, frontSurface } from "./geometry.ts";
import type { NootState } from "./types.ts";
import { spring } from "./motion.ts";
/** Accessories follow the head anchor; fabric has bounded secondary motion. */
export function createWearables(head: THREE.Bone) {
  const mount = new THREE.Group();
  mount.position.y = -HEAD_Y;
  head.add(mount);
  const fabric = new THREE.MeshStandardMaterial({
    color: "#698da4",
    roughness: 0.95,
  });
  const patternUniform = { value: 0 };
  fabric.onBeforeCompile = (shader) => {
    shader.uniforms.nootPattern = patternUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 fabricPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfabricPosition = position;",
      );
    // Use the mesh-local position so motifs move with Noot, never swim in world space.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nuniform float nootPattern; varying vec3 fabricPosition;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec2 p=fabricPosition.xy*18.0;
      vec2 cell=fract(p)-0.5;
      float aa=max(fwidth(p.x),fwidth(p.y));
      float motif=0.0;
      if(nootPattern>0.5 && nootPattern<1.5) motif=1.0-smoothstep(.32-aa,.32+aa,abs(fract((p.x+p.y)*.5)-.5));
      else if(nootPattern<2.5 && nootPattern>1.5) motif=1.0-smoothstep(.16-aa,.16+aa,length(cell));
      else if(nootPattern<3.5 && nootPattern>2.5) motif=(step(.5,fract(p.x*.5))+step(.5,fract(p.y*.5)))*.5;
      else if(nootPattern>3.5) {float h=fract(sin(dot(floor(p),vec2(127.1,311.7)))*43758.5453);motif=(1.0-smoothstep(.12-aa,.12+aa,length(cell)))*step(.35,h);}
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(diffuseColor.rgb,vec3(1.0),.65),motif*.65);
    `,
    );
  };
  fabric.customProgramCacheKey = () => "noot-fabric-pattern-v1";
  const frame = new THREE.MeshStandardMaterial({
    color: "#454b48",
    roughness: 0.6,
  });
  const scarf = new THREE.Group(),
    bow = new THREE.Group(),
    bandana = new THREE.Group(),
    glasses = new THREE.Group(),
    sunny = new THREE.Group();
  scarf.name = "scarf";
  bow.name = "bow";
  bandana.name = "bandana";
  glasses.name = "round-glasses";
  sunny.name = "sunglasses";
  mount.add(scarf, bow, bandana, glasses, sunny);
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  function oval(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    const m = new THREE.Mesh(sphere.clone().scale(sx, sy, sz), fabric);
    m.position.set(x, y, z);
    // Geometry uses garment units, keeping the pattern scale consistent.
    parent.add(m);
    return m;
  }
  const collar = new THREE.CatmullRomCurve3(
    Array.from({ length: 33 }, (_, i) => {
      const x = -0.69 + (i / 32) * 1.38;
      return new THREE.Vector3(x, 1.57, frontSurface(x, 1.57) + 0.025);
    }),
  );
  scarf.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(collar, 32, 0.065, 12, false),
      fabric,
    ),
  );
  const tail = oval(
    scarf,
    0.29,
    1.4,
    frontSurface(0.29, 1.4) + 0.06,
    0.09,
    0.22,
    0.035,
  );
  oval(bow, -0.12, 1.57, frontSurface(-0.12, 1.57) + 0.06, 0.14, 0.09, 0.045);
  oval(bow, 0.12, 1.57, frontSurface(0.12, 1.57) + 0.06, 0.14, 0.09, 0.045);
  oval(bow, 0, 1.57, frontSurface(0, 1.57) + 0.09, 0.055, 0.065, 0.05);
  for (const group of [glasses, sunny]) {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 65 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2,
            x = side * 0.42 + Math.cos(a) * 0.25,
            y = 2.015 + Math.sin(a) * 0.29;
          return new THREE.Vector3(x, y, frontSurface(x, y) + 0.065);
        }),
      );
      group.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, 64, 0.018, 8, false),
          frame,
        ),
      );
      if (group === sunny) {
        const lens = new THREE.Mesh(
          new THREE.SphereGeometry(1, 32, 24),
          new THREE.MeshStandardMaterial({
            color: "#4a6a60",
            transparent: true,
            opacity: 0.6,
            roughness: 0.3,
          }),
        );
        lens.position.set(
          side * 0.42,
          2.015,
          frontSurface(side * 0.42, 2.015) + 0.06,
        );
        lens.scale.set(0.22, 0.25, 0.024);
        group.add(lens);
      }
    }
    const bridge = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.17, 2.06, frontSurface(-0.17, 2.06) + 0.065),
      new THREE.Vector3(0, 2.1, frontSurface(0, 2.1) + 0.065),
      new THREE.Vector3(0.17, 2.06, frontSurface(0.17, 2.06) + 0.065),
    ]);
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(bridge, 16, 0.018, 8, false),
        frame,
      ),
    );
  }
  // A curved triangular panel follows the actual chest instead of a flat plane.
  const vertices: number[] = [],
    triangles: number[] = [];
  for (let row = 0; row <= 16; row++) {
    const t = row / 16,
      y = 1.56 - t * 0.39,
      width = 0.43 * (1 - t) + 0.012;
    for (let col = 0; col <= 24; col++) {
      const x = ((col / 24) * 2 - 1) * width;
      vertices.push(x, y, frontSurface(x, y) + 0.025);
    }
  }
  for (let row = 0; row < 16; row++)
    for (let col = 0; col < 24; col++) {
      const a = row * 25 + col,
        b = a + 25;
      triangles.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const panel = new THREE.BufferGeometry();
  panel.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  panel.setIndex(triangles);
  panel.computeVertexNormals();
  bandana.add(new THREE.Mesh(panel, fabric));
  const flutter = spring(0, 3, 0.8);
  return {
    update(dt: number, drive: number, state: NootState, reduced: boolean) {
      patternUniform.value = [
        "plain",
        "stripes",
        "dots",
        "gingham",
        "confetti",
      ].indexOf(state.pattern ?? "plain");
      scarf.visible = state.clothing === "scarf";
      bow.visible = state.clothing === "bow";
      bandana.visible = state.clothing === "bandana";
      glasses.visible = state.eyewear === "round";
      sunny.visible = state.eyewear === "sunny";
      fabric.color.set(
        {
          blue: "#698da4",
          rose: "#b87985",
          gold: "#c5a05c",
          mint: "#71a58e",
          lavender: "#9c88b6",
          coral: "#c77d65",
          navy: "#4e647c",
        }[state.accessoryColor ?? "blue"],
      );
      tail.rotation.z = flutter.step(
        reduced ? 0 : THREE.MathUtils.clamp(drive * 0.12, -0.13, 0.13),
        dt,
      );
    },
  };
}
