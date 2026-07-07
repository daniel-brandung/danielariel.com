import * as THREE from "three";

/** mulberry32 — deterministic world layout across mounts. */
export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rolling hills that stay flat near the camera so the near field reads clean. */
export function terrainHeight(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  const hills =
    Math.sin(x * 0.045) * Math.cos(z * 0.038) * 2.2 + Math.sin(x * 0.011 + z * 0.014) * 3.5;
  const lift = Math.min(1, Math.max(0, (d - 18) / 40));
  return hills * lift + 0;
}

export function createSkyDome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(300, 24, 12);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0.1, 0.16, 0.3) },
      horizonColor: { value: new THREE.Color(0.95, 0.52, 0.24) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      varying vec3 vDir;
      void main() {
        float h = smoothstep(0.0, 0.4, vDir.y);
        gl_FragColor = vec4(mix(horizonColor, topColor, h), 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = "sky";
  return dome;
}

export function createStars(rand: () => number): THREE.Points {
  const count = 300;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // upper hemisphere of a radius-280 sphere, kept off the horizon line
    const theta = rand() * Math.PI * 2;
    const y = 0.15 + rand() * 0.85;
    const r = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(theta) * r * 280;
    positions[i * 3 + 1] = y * 280;
    positions[i * 3 + 2] = Math.sin(theta) * r * 280;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xe8f5ee,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = "stars";
  return stars;
}

export function createTerrain(rand: () => number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(400, 400, 48, 48);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const lift = Math.min(1, Math.max(0, (Math.sqrt(x * x + z * z) - 18) / 40));
    pos.setY(i, terrainHeight(x, z) + (rand() - 0.5) * 0.35 * lift);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ color: 0x14351f, flatShading: true });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = "terrain";
  return terrain;
}

export function createTrees(rand: () => number): THREE.Group {
  const count = 70;
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3020, flatShading: true });
  const canopyGeo = new THREE.ConeGeometry(1.6, 4.2, 6);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x0f4a2a, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    // polar scatter across the -z half where the camera looks, near field kept clear
    const angle = (rand() * 2 - 1) * Math.PI * 0.75;
    const dist = 20 + rand() * 130;
    const x = Math.sin(angle) * dist;
    const z = -Math.cos(angle) * dist;
    const ground = terrainHeight(x, z);
    const s = 0.8 + rand() * 1.6;
    m.makeScale(s, s, s);
    m.setPosition(x, ground + 0.8 * s, z);
    trunks.setMatrixAt(i, m);
    m.makeScale(s, s, s);
    m.setPosition(x, ground + (1.6 + 2.1) * s, z);
    canopies.setMatrixAt(i, m);
  }
  const group = new THREE.Group();
  group.name = "trees";
  group.add(trunks, canopies);
  return group;
}

export function createWindmill(): THREE.Group {
  const group = new THREE.Group();
  group.name = "windmill";
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.2, 9, 8),
    new THREE.MeshLambertMaterial({ color: 0x6b5a4a, flatShading: true }),
  );
  tower.position.y = 4.5;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 2.2, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a2f28, flatShading: true }),
  );
  roof.position.y = 10.1;
  const blades = new THREE.Group();
  blades.name = "blades";
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xd8cfc0, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.5, 0.12), bladeMat);
    blade.position.y = 2.4;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
  }
  blades.position.set(0, 8.6, 2.4); // in front of the tower, facing the camera side
  group.add(tower, roof, blades);
  return group;
}
