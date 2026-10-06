// "Frost" — the climber: an orange parka (it has to pop against all that ice),
// a white beanie, a visor with two glowing eyes, and a long golden scarf that
// streams behind like a light trail.
import * as THREE from "three";
import { MAX_VX } from "@/components/icytower/engine";

const BODY_RADIUS = 13;
const BODY_LENGTH = 16;
export const BODY_CENTER = BODY_RADIUS + BODY_LENGTH / 2; // feet sit at y = 0
const SPIN_SPEED = 15; // rad/s while super-jumping
const SCARF_POINTS = 22;
const SCARF_SEGMENT = 4.2;
const SCARF_GRAVITY = 700;
const SCARF_COLOR = new THREE.Color(1, 0.72, 0.16);

const TAU = Math.PI * 2;
const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export interface PoseInput {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  superJump: boolean;
  facing: 1 | -1;
  flow: number;
  dt: number;
  time: number;
}

export class Climber {
  readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly eyes: THREE.Mesh[] = [];
  private readonly feet: THREE.Mesh[] = [];
  private readonly hands: THREE.Mesh[] = [];
  private readonly eyeMaterial: THREE.MeshBasicMaterial;
  private spin = 0;
  private squash = 1;
  private squashVel = 0;
  private runPhase = 0;
  private turn = 0;
  private nextBlink = 2;
  private blinkUntil = 0;
  private wasGrounded = true;

  constructor() {
    const parka = new THREE.MeshStandardMaterial({
      color: 0xff5a2a,
      roughness: 0.5,
      emissive: 0xff3a10,
      emissiveIntensity: 0.28,
    });
    const white = new THREE.MeshStandardMaterial({
      color: 0xf2f8ff,
      roughness: 0.6,
      emissive: 0x7a95b5,
      emissiveIntensity: 0.3,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffc83d,
      roughness: 0.5,
      emissive: 0xffa000,
      emissiveIntensity: 0.4,
    });
    const navy = new THREE.MeshStandardMaterial({ color: 0x0c1430, roughness: 0.6 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x070b18, roughness: 0.12, metalness: 0.7 });
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3.2, 4) });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 8, 18), parka);
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(BODY_RADIUS + 0.8, 18, 8, 0, TAU, 0, Math.PI / 2),
      white,
    );
    beanie.position.y = BODY_LENGTH / 2 + 1;
    const brim = new THREE.Mesh(new THREE.TorusGeometry(BODY_RADIUS + 0.6, 2.2, 8, 24), white);
    brim.rotation.x = Math.PI / 2;
    brim.position.y = BODY_LENGTH / 2 + 1.5;
    const pompom = new THREE.Mesh(new THREE.IcosahedronGeometry(4.6, 1), gold);
    pompom.position.y = BODY_LENGTH / 2 + BODY_RADIUS + 3;
    const visor = new THREE.Mesh(new THREE.CapsuleGeometry(5.6, 13, 4, 12), visorMat);
    visor.rotation.z = Math.PI / 2;
    visor.position.set(0, 3.5, BODY_RADIUS - 2.6);
    this.pivot.add(body, beanie, brim, pompom, visor);

    const eyeGeo = new THREE.SphereGeometry(2.1, 10, 8);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
      eye.position.set(side * 4.3, 3.8, BODY_RADIUS + 2.2);
      this.eyes.push(eye);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(5.6, 12, 8), navy);
      foot.scale.set(1.15, 0.8, 1.2);
      foot.position.set(side * 6.5, -BODY_CENTER + 3.5, 2);
      this.feet.push(foot);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(4.1, 10, 8), white);
      hand.position.set(side * (BODY_RADIUS + 2), -3, 1);
      this.hands.push(hand);
    }
    this.pivot.add(...this.eyes, ...this.feet, ...this.hands);
    this.pivot.position.y = BODY_CENTER;
    this.root.add(this.pivot);
  }

  /** Bump the squash spring: >1 stretches (jump), <1 squashes (landing). */
  kick(amount: number): void {
    this.squash = amount;
    this.squashVel = 0;
  }

  update(pose: PoseInput): void {
    const { dt, time } = pose;
    this.root.position.set(pose.x, pose.y, 0);

    // squash & stretch spring
    this.squashVel += (1 - this.squash) * 420 * dt - this.squashVel * 18 * dt;
    this.squash += this.squashVel * dt;
    const sq = THREE.MathUtils.clamp(this.squash, 0.55, 1.5);
    this.pivot.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.pivot.position.y = BODY_CENTER * sq;

    // spin through super jumps, then settle upright on the nearest turn
    if (!pose.grounded && pose.superJump) {
      this.spin -= pose.facing * SPIN_SPEED * dt;
    } else {
      const target = Math.round(this.spin / TAU) * TAU;
      this.spin = damp(this.spin, target, 22, dt);
      if (Math.abs(this.spin - target) < 0.01) this.spin = 0;
    }
    const lean = pose.grounded ? -(pose.vx / MAX_VX) * 0.22 : -(pose.vx / MAX_VX) * 0.12;
    this.pivot.rotation.z = this.spin + lean;

    // turn the visor towards the direction of travel
    const moving = Math.abs(pose.vx) > 40;
    this.turn = damp(this.turn, moving ? pose.facing * 0.62 : 0, 10, dt);
    this.pivot.rotation.y = this.turn;

    // limbs
    const speed = Math.abs(pose.vx) / MAX_VX;
    if (pose.grounded) {
      this.runPhase += dt * (6 + speed * 16) * (moving ? 1 : 0);
      for (let i = 0; i < 2; i++) {
        const phase = this.runPhase + i * Math.PI;
        const lift = moving ? Math.max(0, Math.sin(phase)) * (3 + speed * 4) : 0;
        this.feet[i].position.y = -BODY_CENTER + 3.5 + lift;
        this.feet[i].position.z = 2 + (moving ? Math.cos(phase) * 4 : 0);
        const swing = moving ? Math.sin(phase + Math.PI) * 4 : Math.sin(time * 2 + i) * 0.8;
        this.hands[i].position.set((i ? 1 : -1) * (BODY_RADIUS + 2), -3 + swing * 0.3, 1 + swing);
      }
    } else {
      const rising = pose.vy > 0;
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        this.feet[i].position.y = damp(this.feet[i].position.y, -BODY_CENTER + 7, 16, dt);
        this.feet[i].position.z = damp(this.feet[i].position.z, 2, 16, dt);
        const hy = rising ? 12 : 2;
        const hx = side * (BODY_RADIUS + (rising ? 3 : 6));
        this.hands[i].position.set(
          damp(this.hands[i].position.x, hx, 14, dt),
          damp(this.hands[i].position.y, hy, 14, dt),
          1,
        );
      }
    }
    if (pose.grounded && !this.wasGrounded) this.runPhase = 0;
    this.wasGrounded = pose.grounded;

    // blink every few seconds; eyes burn brighter in a combo
    if (time > this.nextBlink) {
      this.blinkUntil = time + 0.11;
      this.nextBlink = time + 2.2 + Math.random() * 3.5;
    }
    const blink = time < this.blinkUntil ? 0.15 : 1;
    for (const eye of this.eyes) eye.scale.y = blink;
    const glow = 1 + pose.flow * 1.8;
    this.eyeMaterial.color.setRGB(0.6 * glow, 3.2 * glow, 4 * glow);
  }

  /** World-space point the scarf hangs from (just under the beanie, behind). */
  neck(target: THREE.Vector3): THREE.Vector3 {
    return target.set(this.root.position.x, this.root.position.y + BODY_CENTER * this.squash + 8, -6);
  }

  dispose(): void {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
  }
}

/** Verlet rope rendered as a tapered ribbon that fades out towards the tip. */
export class Scarf {
  readonly mesh: THREE.Mesh;
  private readonly pts: Float32Array; // x, y pairs
  private readonly prev: Float32Array;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private initialised = false;

  constructor() {
    this.pts = new Float32Array(SCARF_POINTS * 2);
    this.prev = new Float32Array(SCARF_POINTS * 2);
    this.positions = new Float32Array(SCARF_POINTS * 2 * 3);
    this.colors = new Float32Array(SCARF_POINTS * 2 * 4);
    const indices: number[] = [];
    for (let i = 0; i < SCARF_POINTS - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }

  update(anchor: THREE.Vector3, dt: number, wind: number, glow: number): void {
    const p = this.pts;
    const q = this.prev;
    if (!this.initialised) {
      for (let i = 0; i < SCARF_POINTS; i++) {
        p[i * 2] = q[i * 2] = anchor.x - i * SCARF_SEGMENT;
        p[i * 2 + 1] = q[i * 2 + 1] = anchor.y;
      }
      this.initialised = true;
    }
    const step = Math.min(dt, 1 / 30);
    p[0] = anchor.x;
    p[1] = anchor.y;
    for (let i = 1; i < SCARF_POINTS; i++) {
      const x = p[i * 2];
      const y = p[i * 2 + 1];
      const vx = (x - q[i * 2]) * 0.94;
      const vy = (y - q[i * 2 + 1]) * 0.94;
      q[i * 2] = x;
      q[i * 2 + 1] = y;
      const flutter = Math.sin(i * 0.9 + performance.now() * 0.012) * 18;
      p[i * 2] = x + vx + wind * step * step * 60;
      p[i * 2 + 1] = y + vy - SCARF_GRAVITY * step * step + flutter * step * step * 60;
    }
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 1; i < SCARF_POINTS; i++) {
        const dx = p[i * 2] - p[(i - 1) * 2];
        const dy = p[i * 2 + 1] - p[(i - 1) * 2 + 1];
        const len = Math.hypot(dx, dy) || 1;
        if (len > SCARF_SEGMENT) {
          p[i * 2] = p[(i - 1) * 2] + (dx / len) * SCARF_SEGMENT;
          p[i * 2 + 1] = p[(i - 1) * 2 + 1] + (dy / len) * SCARF_SEGMENT;
        }
      }
    }

    const intensity = 1.1 + glow * 2.6;
    for (let i = 0; i < SCARF_POINTS; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(SCARF_POINTS - 1, i + 1);
      let tx = p[a * 2] - p[b * 2];
      let ty = p[a * 2 + 1] - p[b * 2 + 1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const u = i / (SCARF_POINTS - 1);
      const half = 3.6 * (1 - u * 0.55);
      const nx = -ty * half;
      const ny = tx * half;
      const o = i * 6;
      this.positions[o] = p[i * 2] + nx;
      this.positions[o + 1] = p[i * 2 + 1] + ny;
      this.positions[o + 2] = anchor.z;
      this.positions[o + 3] = p[i * 2] - nx;
      this.positions[o + 4] = p[i * 2 + 1] - ny;
      this.positions[o + 5] = anchor.z;
      const alpha = Math.pow(1 - u, 1.3);
      for (let k = 0; k < 2; k++) {
        const c = i * 8 + k * 4;
        this.colors[c] = SCARF_COLOR.r * intensity;
        this.colors[c + 1] = SCARF_COLOR.g * intensity;
        this.colors[c + 2] = SCARF_COLOR.b * intensity;
        this.colors[c + 3] = alpha;
      }
    }
    const geo = this.mesh.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** A translucent, glowing silhouette of the climber for the daily ghost. */
export function createGhost(): { group: THREE.Group; material: THREE.MeshBasicMaterial } {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.35, 0.9, 1.4),
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 6, 14), material);
  body.position.y = BODY_CENTER;
  const pompom = new THREE.Mesh(new THREE.IcosahedronGeometry(4.6, 1), material);
  pompom.position.y = BODY_CENTER + BODY_LENGTH / 2 + BODY_RADIUS + 3;
  group.add(body, pompom);
  group.renderOrder = 5;
  return { group, material };
}
