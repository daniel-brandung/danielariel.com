import * as THREE from "three";

const POOL = 256;
const PER_BURST = 18;
const LIFETIME = 0.7;
const PARTICLE_GRAVITY = 14;
const PARKED = 9999; // dead particles wait far outside the scene

/**
 * Pooled feather burst renderer: one THREE.Points for every burst, slots
 * recycled round-robin. No allocations in update() — spec's hot-path rule.
 */
export class FeatherParticles {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private cursor = 0;

  constructor() {
    this.positions = new Float32Array(POOL * 3).fill(PARKED);
    this.velocities = new Float32Array(POOL * 3);
    this.colors = new Float32Array(POOL * 3);
    this.life = new Float32Array(POOL); // 0 = dead
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false; // positions mutate every frame
    this.points.name = "feathers";
  }

  burst(
    pos: { x: number; y: number; z: number },
    golden: boolean,
    rand: () => number = Math.random,
  ): void {
    const palette: [THREE.Color, THREE.Color] = golden
      ? [new THREE.Color(0xf5c542), new THREE.Color(0xfff2c0)]
      : [new THREE.Color(0xb98a56), new THREE.Color(0xe8e2d8)];
    for (let n = 0; n < PER_BURST; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % POOL;
      this.positions[i * 3] = pos.x;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 2 - 1);
      const speed = 3 + rand() * 5;
      this.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * speed;
      this.velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      const c = palette[n % 2];
      this.colors[i * 3] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;
      this.life[i] = LIFETIME;
    }
    this.markDirty();
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = PARKED;
        continue;
      }
      this.velocities[i * 3 + 1] -= PARTICLE_GRAVITY * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
    }
    if (any) this.markDirty();
  }

  private markDirty(): void {
    (this.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
