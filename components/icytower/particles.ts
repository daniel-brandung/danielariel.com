import * as THREE from "three";
import { particleFragment, particleVertex } from "@/components/icytower/shaders";

function pointsMaterial(blending: THREE.Blending): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending,
  });
}

function pointsGeometry(count: number) {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  return { geometry, position, color, size, alpha };
}

export interface BurstOptions {
  x: number;
  y: number;
  z?: number;
  count: number;
  color: THREE.Color;
  intensity?: number; // HDR multiplier, >1 blooms
  speed: [number, number];
  angle?: [number, number]; // radians; default: all directions
  size?: [number, number];
  life?: [number, number];
  gravity?: number;
  drag?: number;
  spreadZ?: number;
}

/** Pooled additive sparks: landing snow, wall sparks, combo fountains, debris. */
export class Sparks {
  readonly points: THREE.Points;
  private readonly max: number;
  private readonly buf: ReturnType<typeof pointsGeometry>;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private cursor = 0;
  budget = 1; // scaled down on slow devices

  constructor(max = 900) {
    this.max = max;
    this.buf = pointsGeometry(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.points = new THREE.Points(this.buf.geometry, pointsMaterial(THREE.AdditiveBlending));
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  get material(): THREE.ShaderMaterial {
    return this.points.material as THREE.ShaderMaterial;
  }

  burst(o: BurstOptions): void {
    const count = Math.max(1, Math.round(o.count * this.budget));
    const [a0, a1] = o.angle ?? [0, Math.PI * 2];
    const [s0, s1] = o.speed;
    const [z0, z1] = o.size ?? [6, 14];
    const [l0, l1] = o.life ?? [0.4, 0.9];
    const k = o.intensity ?? 1.5;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = a0 + Math.random() * (a1 - a0);
      const s = s0 + Math.random() * (s1 - s0);
      this.buf.position[i * 3] = o.x;
      this.buf.position[i * 3 + 1] = o.y;
      this.buf.position[i * 3 + 2] = (o.z ?? 0) + (Math.random() - 0.5) * (o.spreadZ ?? 30);
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = Math.sin(a) * s;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * s * 0.4;
      const tint = 0.75 + Math.random() * 0.25;
      this.buf.color[i * 3] = o.color.r * k * tint;
      this.buf.color[i * 3 + 1] = o.color.g * k * tint;
      this.buf.color[i * 3 + 2] = o.color.b * k * tint;
      this.baseSize[i] = z0 + Math.random() * (z1 - z0);
      this.maxLife[i] = this.life[i] = l0 + Math.random() * (l1 - l0);
      this.gravity[i] = o.gravity ?? 900;
      this.drag[i] = o.drag ?? 1.5;
    }
  }

  update(dt: number): void {
    const { position, size, alpha } = this.buf;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= d;
      position[i * 3] += this.vel[i * 3] * dt;
      position[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      position[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      alpha[i] = t;
      size[i] = this.baseSize[i] * (0.4 + 0.6 * t);
    }
    const geo = this.buf.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
  }

  dispose(): void {
    this.buf.geometry.dispose();
    this.material.dispose();
  }
}

/** Snowfall that lives in a box around the camera and wraps as you climb. */
export class Snow {
  readonly points: THREE.Points;
  private readonly count: number;
  private readonly buf: ReturnType<typeof pointsGeometry>;
  private readonly speed: Float32Array;
  private readonly phase: Float32Array;
  private readonly xMin: number;
  private readonly xMax: number;

  constructor(count = 260, xMin = -420, xMax = 940) {
    this.count = count;
    this.xMin = xMin;
    this.xMax = xMax;
    this.buf = pointsGeometry(count);
    this.speed = new Float32Array(count);
    this.phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.buf.position[i * 3] = xMin + Math.random() * (xMax - xMin);
      this.buf.position[i * 3 + 1] = Math.random() * 1400;
      this.buf.position[i * 3 + 2] = -320 + Math.random() * 520;
      this.speed[i] = 30 + Math.random() * 60;
      this.phase[i] = Math.random() * Math.PI * 2;
      this.buf.size[i] = 3 + Math.random() * 5;
      this.buf.alpha[i] = 0.35 + Math.random() * 0.5;
      this.buf.color[i * 3] = 0.85;
      this.buf.color[i * 3 + 1] = 0.93;
      this.buf.color[i * 3 + 2] = 1;
    }
    this.points = new THREE.Points(this.buf.geometry, pointsMaterial(THREE.AdditiveBlending));
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
  }

  get material(): THREE.ShaderMaterial {
    return this.points.material as THREE.ShaderMaterial;
  }

  update(dt: number, time: number, bottom: number, height: number, wind: number, tint: THREE.Color): void {
    const pos = this.buf.position;
    const span = this.xMax - this.xMin;
    const lo = bottom - 80;
    const range = height + 160;
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] += (Math.sin(time * 0.8 + this.phase[i]) * 14 + wind) * dt;
      pos[i * 3 + 1] -= this.speed[i] * dt;
      if (pos[i * 3] < this.xMin) pos[i * 3] += span;
      else if (pos[i * 3] > this.xMax) pos[i * 3] -= span;
      const rel = pos[i * 3 + 1] - lo;
      if (rel < 0 || rel > range) pos[i * 3 + 1] = lo + (((rel % range) + range) % range);
      this.buf.color[i * 3] = tint.r;
      this.buf.color[i * 3 + 1] = tint.g;
      this.buf.color[i * 3 + 2] = tint.b;
    }
    this.buf.geometry.attributes.position.needsUpdate = true;
    this.buf.geometry.attributes.aColor.needsUpdate = true;
  }

  dispose(): void {
    this.buf.geometry.dispose();
    this.material.dispose();
  }
}
