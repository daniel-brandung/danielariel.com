// The renderer: everything Three.js lives here, driven once per frame by the
// component with a read-only view of the engine state. Gameplay happens on the
// z = 0 plane; a perspective camera adds depth — slabs show their tops, the
// walls recede, and distant crystals drift by with real parallax.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  BRITTLE_DELAY,
  VIEW_H,
  isCrumbled,
  type TowerEvent,
  type TowerState,
} from "@/components/icytower/engine";
import {
  FIELD_W,
  FLOOR_GAP,
  STRATA,
  platformAt,
  platformLeft,
  stratumIndexAt,
} from "@/components/icytower/tower";
import { PALETTES, paletteBlend } from "@/components/icytower/palette";
import {
  FinishShader,
  platformFragment,
  skyFragment,
  skyVertex,
  wallFragment,
  worldVertex,
} from "@/components/icytower/shaders";
import { BODY_CENTER, Climber, Scarf, createGhost } from "@/components/icytower/character";
import { Snow, Sparks } from "@/components/icytower/particles";
import type { GhostPose } from "@/components/icytower/ghost";

const FOV = 32;
const FRAME_W = FIELD_W + 40; // always keep the whole playfield plus a sliver of wall in view
const WALL_T = 70;
const WALL_DEPTH = 120;
const PLATFORM_T = 20;
const PLATFORM_DEPTH = 90;
const POOL = 26;
const SHARDS = 42;
const RINGS = 4;

export type Quality = 0 | 1 | 2;

export interface FrameView {
  dt: number; // seconds of animation to advance (already slowed in bullet time)
  state: TowerState;
  px: number; // interpolated player position
  py: number;
  cameraY: number; // interpolated
  ghost: GhostPose | null;
  flow: number; // 0..1, how hot the current combo is
  danger: number; // 0..1, how close to the bottom edge
  reduceMotion: boolean;
}

interface Slot {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  label: THREE.Mesh;
  labelMaterial: THREE.MeshBasicMaterial;
  floor: number;
}

interface Shard {
  x: number;
  y: number;
  z: number;
  scale: number;
  stretch: number;
  rot: THREE.Euler;
  spin: THREE.Vector3;
}

const COLOR_KEYS = [
  "skyTop",
  "skyBottom",
  "auroraA",
  "auroraB",
  "mountain",
  "wall",
  "seam",
  "platform",
  "rim",
  "accent",
  "ambient",
] as const;
const NUMBER_KEYS = ["aurora", "stars", "planet", "wind", "lightning"] as const;
type ColorKey = (typeof COLOR_KEYS)[number];
type NumberKey = (typeof NUMBER_KEYS)[number];

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

function platformMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: worldVertex,
    fragmentShader: platformFragment,
    uniforms: {
      uColor: { value: new THREE.Color() },
      uRim: { value: new THREE.Color() },
      uSize: { value: new THREE.Vector3(1, 1, 1) },
      uKind: { value: 0 },
      uCrack: { value: 0 },
      uTime: { value: 0 },
      uFlow: { value: 0 },
    },
  });
}

function wallMaterial(side: number, innerX: number, alpha: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: worldVertex,
    fragmentShader: wallFragment,
    transparent: alpha < 1,
    depthWrite: alpha >= 1,
    uniforms: {
      uColor: { value: new THREE.Color() },
      uSeam: { value: new THREE.Color() },
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uSide: { value: side },
      uInnerX: { value: innerX },
      uAlpha: { value: alpha },
    },
  });
}

export class TowerScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 10, 4000);
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly finish: ShaderPass;

  private readonly sky: THREE.Mesh;
  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly wallMaterials: THREE.ShaderMaterial[] = [];
  private readonly walls: THREE.Mesh[] = [];
  private readonly backWall: THREE.Mesh;
  private readonly groundMaterial: THREE.ShaderMaterial;
  private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly planeGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly slots: Slot[] = [];
  private readonly slotByFloor = new Map<number, Slot>();
  private readonly labels = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>();
  private readonly climber = new Climber();
  private readonly scarf = new Scarf();
  private readonly ghost: ReturnType<typeof createGhost>;
  private readonly sparks = new Sparks();
  private readonly snow = new Snow();
  private readonly shardMesh: THREE.InstancedMesh;
  private readonly shards: Shard[] = [];
  private readonly rings: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; life: number }[] = [];
  private readonly ambient = new THREE.HemisphereLight(0xffffff, 0x223355, 1.4);
  private readonly key = new THREE.DirectionalLight(0xffffff, 2.2);

  private readonly palettes: Record<ColorKey, THREE.Color>[];
  private readonly mix: Record<ColorKey, THREE.Color> & Record<NumberKey, number>;
  private readonly tmp = new THREE.Vector3();
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpColor = new THREE.Color();

  private visibleH = VIEW_H;
  private dist = 1000;
  private width = 1;
  private height = 1;
  private quality: Quality = 2;
  private time = 0;
  private trauma = 0;
  private roll = 0;
  private flash = 0;
  private readonly flashColor = new THREE.Color(1, 1, 1);
  private lightning = 0;
  private lastFlow = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    this.palettes = PALETTES.map((p) => {
      const out = {} as Record<ColorKey, THREE.Color>;
      for (const k of COLOR_KEYS) out[k] = new THREE.Color(p[k]);
      return out;
    });
    const mix = {} as Record<ColorKey, THREE.Color> & Record<NumberKey, number>;
    for (const k of COLOR_KEYS) mix[k] = new THREE.Color();
    for (const k of NUMBER_KEYS) mix[k] = 0;
    this.mix = mix;

    // sky: a full-screen quad drawn first, behind everything
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color() },
        uBottom: { value: new THREE.Color() },
        uAuroraA: { value: new THREE.Color() },
        uAuroraB: { value: new THREE.Color() },
        uMountain: { value: new THREE.Color() },
        uAurora: { value: 0 },
        uStars: { value: 0 },
        uPlanet: { value: 0 },
        uTime: { value: 0 },
        uAlt: { value: 0 },
        uFlow: { value: 0 },
        uLightning: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
    });
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.skyMaterial);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    this.scene.add(this.sky);

    // the tower: two ice-brick walls, a smoked-glass back wall, and the ground block
    for (const side of [-1, 1]) {
      const material = wallMaterial(side, side < 0 ? 0 : FIELD_W, 1);
      const wall = new THREE.Mesh(this.boxGeometry, material);
      wall.scale.set(WALL_T, 1, WALL_DEPTH);
      wall.position.x = side < 0 ? -WALL_T / 2 : FIELD_W + WALL_T / 2;
      this.wallMaterials.push(material);
      this.walls.push(wall);
      this.scene.add(wall);
    }
    const backMaterial = wallMaterial(0, -1e5, 0.22);
    this.wallMaterials.push(backMaterial);
    this.backWall = new THREE.Mesh(this.planeGeometry, backMaterial);
    this.backWall.position.set(FIELD_W / 2, 0, -WALL_DEPTH / 2);
    this.backWall.scale.set(FIELD_W, 1, 1);
    this.backWall.renderOrder = -10;
    this.scene.add(this.backWall);

    this.groundMaterial = platformMaterial();
    const ground = new THREE.Mesh(this.boxGeometry, this.groundMaterial);
    ground.scale.set(FIELD_W, 900, WALL_DEPTH);
    ground.position.set(FIELD_W / 2, -450, 0);
    this.groundMaterial.uniforms.uSize.value.set(FIELD_W, 900, WALL_DEPTH);
    this.groundMaterial.uniforms.uKind.value = 3;
    this.scene.add(ground);

    for (let i = 0; i < POOL; i++) {
      const material = platformMaterial();
      const mesh = new THREE.Mesh(this.boxGeometry, material);
      const labelMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
      const label = new THREE.Mesh(this.planeGeometry, labelMaterial);
      mesh.visible = label.visible = false;
      this.slots.push({ mesh, material, label, labelMaterial, floor: -1 });
      this.scene.add(mesh, label);
    }

    // the climber, its scarf, and the ghost
    this.scene.add(this.climber.root, this.scarf.mesh);
    this.ghost = createGhost();
    this.ghost.group.visible = false;
    this.scene.add(this.ghost.group);

    // drifting background crystals
    const shardMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.25,
      metalness: 0.3,
      emissive: 0x0a1830,
    });
    this.shardMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), shardMaterial, SHARDS);
    this.shardMesh.frustumCulled = false;
    for (let i = 0; i < SHARDS; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -260 - Math.random() * 1500;
      const spreadX = 380 + (-z) * 0.55;
      this.shards.push({
        x: FIELD_W / 2 + side * (FIELD_W / 2 + 80 + Math.random() * spreadX),
        y: Math.random() * 3000,
        z,
        scale: 10 + Math.random() * 38,
        stretch: 1 + Math.random() * 2.4,
        rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.5),
      });
      this.shardMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.scene.add(this.shardMesh);

    for (let i = 0; i < RINGS; i++) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 72), material);
      mesh.visible = false;
      mesh.renderOrder = 11;
      this.rings.push({ mesh, material, life: 0 });
      this.scene.add(mesh);
    }

    this.scene.add(this.sparks.points, this.snow.points);
    this.key.position.set(-300, 600, 900);
    this.scene.add(this.ambient, this.key, this.key.target);

    // post: bloom → grade → tone-map
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.38, 0.78);
    this.composer.addPass(this.bloom);
    this.finish = new ShaderPass(FinishShader);
    this.composer.addPass(this.finish);
    this.composer.addPass(new OutputPass());
  }

  get viewHeight(): number {
    return this.visibleH;
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    const aspect = width / height;
    this.visibleH = Math.max(VIEW_H, FRAME_W / aspect);
    const halfFov = THREE.MathUtils.degToRad(FOV / 2);
    this.dist = this.visibleH / 2 / Math.tan(halfFov);
    this.camera.aspect = aspect;
    this.camera.far = this.dist + 2400;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const scale = buffer.y / (2 * Math.tan(halfFov));
    this.sparks.material.uniforms.uScale.value = scale;
    this.snow.material.uniforms.uScale.value = scale;
    this.skyMaterial.uniforms.uRes.value.set(buffer.x, buffer.y);
    const wallH = this.visibleH * 1.6;
    for (const wall of this.walls) wall.scale.y = wallH;
    this.backWall.scale.y = wallH;
  }

  setQuality(quality: Quality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(quality === 2 ? Math.min(2, dpr) : quality === 1 ? Math.min(1.25, dpr) : 1);
    this.bloom.enabled = quality > 0;
    this.sparks.budget = quality === 0 ? 0.5 : 1;
    this.resize(this.width, this.height);
  }

  get currentQuality(): Quality {
    return this.quality;
  }

  /** World point → percentage position inside the canvas, for DOM popups. */
  toScreen(x: number, y: number): { left: number; top: number } {
    const v = this.tmp.set(x, y, 0).project(this.camera);
    return { left: (v.x * 0.5 + 0.5) * 100, top: (0.5 - v.y * 0.5) * 100 };
  }

  // ------------------------------------------------------------------ events

  handle(event: TowerEvent, state: TowerState, reduceMotion: boolean): void {
    const p = state.player;
    const accent = this.mix.accent;
    switch (event.type) {
      case "jump": {
        this.climber.kick(1.22 + event.power * 0.18);
        this.sparks.burst({
          x: event.x, y: event.y + 2, count: 8 + event.power * 16, color: accent, intensity: 1.1,
          speed: [60, 160 + event.power * 140], angle: [Math.PI * 0.05, Math.PI * 0.95], gravity: 500,
          size: [5, 11], life: [0.25, 0.55],
        });
        if (event.superJump) this.ring(event.x, event.y + 10, accent, 0.45, 160);
        break;
      }
      case "land": {
        this.climber.kick(0.92 - event.impact * 0.3);
        this.sparks.burst({
          x: event.x, y: event.y + 2, count: 6 + event.impact * 26, color: this.mix.platform, intensity: 1.2,
          speed: [40, 120 + event.impact * 220], angle: [Math.PI * 0.02, Math.PI * 0.98], gravity: 800,
          size: [4, 10], life: [0.3, 0.6],
        });
        this.trauma = Math.min(1, this.trauma + event.impact * event.impact * 0.3);
        break;
      }
      case "wallBounce": {
        const away = event.side < 0 ? 0 : Math.PI;
        this.sparks.burst({
          x: event.side < 0 ? 0 : FIELD_W, y: event.y + BODY_CENTER, count: 10 + event.speed / 30,
          color: this.mix.seam, intensity: 2.6, speed: [120, 420], angle: [away - 1.1, away + 1.1],
          gravity: 600, size: [4, 9], life: [0.2, 0.5], drag: 3,
        });
        if (!reduceMotion) this.roll = -event.side * 0.018 * Math.min(1, event.speed / 600);
        this.trauma = Math.min(1, this.trauma + 0.1);
        break;
      }
      case "comboStep": {
        this.sparks.burst({
          x: p.x, y: p.y + BODY_CENTER, count: 6 + event.jumps * 3, color: accent, intensity: 2.2,
          speed: [80, 260], size: [5, 12], life: [0.35, 0.8], gravity: 120,
        });
        break;
      }
      case "comboEnd": {
        if (event.tier < 0) break;
        const t = event.tier;
        this.sparks.burst({
          x: p.x, y: p.y + BODY_CENTER, count: 30 + t * 24, color: accent, intensity: 2.6 + t * 0.2,
          speed: [160, 520 + t * 60], size: [6, 16 + t], life: [0.6, 1.3], gravity: 260, drag: 1.2,
        });
        this.sparks.burst({
          x: p.x, y: p.y + BODY_CENTER, count: 12 + t * 8, color: this.mix.rim, intensity: 3,
          speed: [300, 700], angle: [Math.PI * 0.3, Math.PI * 0.7], size: [8, 18], life: [0.5, 1], gravity: 500,
        });
        this.ring(p.x, p.y + BODY_CENTER, accent, 0.7, 260 + t * 50);
        if (t >= 2) this.ring(p.x, p.y + BODY_CENTER, this.mix.rim, 0.9, 420 + t * 60);
        if (!reduceMotion) {
          this.flash = Math.min(0.32, 0.06 + t * 0.03);
          this.flashColor.copy(accent);
        }
        this.trauma = Math.min(1, this.trauma + 0.18 + t * 0.05);
        break;
      }
      case "crumble": {
        const platform = platformAt(state.seed, event.floor);
        const left = platformLeft(platform, state.time);
        const colors = this.palettes[stratumIndexAt(event.floor)];
        for (let i = 0; i < 5; i++) {
          this.sparks.burst({
            x: left + (platform.width * (i + 0.5)) / 5, y: platform.y - PLATFORM_T / 2, count: 6,
            color: colors.platform, intensity: 1.4, speed: [20, 140], angle: [Math.PI * 1.1, Math.PI * 1.9],
            gravity: 1200, size: [8, 16], life: [0.6, 1.1], drag: 0.5,
          });
        }
        break;
      }
      case "crack":
        break;
      case "stratum": {
        const next = this.palettes[event.index];
        this.ring(p.x, p.y + BODY_CENTER, next.accent, 1.1, 900);
        if (!reduceMotion) {
          this.flash = 0.3;
          this.flashColor.copy(next.accent);
        }
        break;
      }
      case "hurryUp": {
        if (!reduceMotion) {
          this.flash = 0.12;
          this.flashColor.setRGB(1, 0.15, 0.3);
        }
        this.trauma = Math.min(1, this.trauma + 0.25);
        break;
      }
      case "gameOver": {
        this.sparks.burst({
          x: p.x, y: state.cameraY + 10, count: 60, color: new THREE.Color(1, 0.25, 0.4), intensity: 2.4,
          speed: [200, 700], angle: [Math.PI * 0.15, Math.PI * 0.85], size: [6, 16], life: [0.6, 1.4], gravity: 700,
        });
        this.trauma = 0.7;
        break;
      }
      case "scrollStart":
        break;
      default:
        event satisfies never;
    }
  }

  private ring(x: number, y: number, color: THREE.Color, life: number, radius: number): void {
    const ring = this.rings.find((r) => r.life <= 0) ?? this.rings[0];
    ring.life = life;
    ring.mesh.userData = { life, radius };
    ring.mesh.position.set(x, y, 20);
    ring.material.color.copy(color).multiplyScalar(3);
    ring.mesh.visible = true;
  }

  // ------------------------------------------------------------------ frame

  private mixPalette(floor: number): void {
    const { from, to, t } = paletteBlend(floor);
    const a = this.palettes[from];
    const b = this.palettes[to];
    for (const k of COLOR_KEYS) this.mix[k].copy(a[k]).lerp(b[k], t);
    for (const k of NUMBER_KEYS) this.mix[k] = PALETTES[from][k] + (PALETTES[to][k] - PALETTES[from][k]) * t;
  }

  render(view: FrameView): void {
    const { dt, state, reduceMotion } = view;
    this.time += dt;
    const time = this.time;
    const flow = view.flow;
    const camCenter = view.cameraY + this.visibleH / 2;
    this.mixPalette(Math.max(0, camCenter / FLOOR_GAP));
    const m = this.mix;

    // camera, with trauma-based shake and a little roll on wall bounces
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const shake = reduceMotion ? 0 : this.trauma * this.trauma;
    const sx = Math.sin(time * 47.3) * Math.cos(time * 23.1) * 16 * shake;
    const sy = Math.sin(time * 39.7 + 1.3) * Math.cos(time * 17.9) * 12 * shake;
    this.roll = damp(this.roll, 0, 5, dt);
    this.camera.position.set(FIELD_W / 2 + sx, camCenter + sy, this.dist);
    this.camera.rotation.set(0, 0, this.roll);

    // sky
    const su = this.skyMaterial.uniforms;
    su.uTop.value.copy(m.skyTop);
    su.uBottom.value.copy(m.skyBottom);
    su.uAuroraA.value.copy(m.auroraA);
    su.uAuroraB.value.copy(m.auroraB);
    su.uMountain.value.copy(m.mountain);
    su.uAurora.value = m.aurora;
    su.uStars.value = m.stars;
    su.uPlanet.value = m.planet;
    su.uTime.value = time;
    su.uAlt.value = Math.max(0, view.cameraY);
    su.uFlow.value = flow;
    if (!reduceMotion && m.lightning > 0 && Math.random() < m.lightning * dt) this.lightning = 0.35;
    this.lightning = Math.max(0, this.lightning - dt * 2.2);
    su.uLightning.value = this.lightning * (0.6 + 0.4 * Math.sin(time * 70));

    // walls follow the camera; their bricks are pinned to world space
    for (const wall of this.walls) wall.position.y = camCenter;
    this.backWall.position.y = camCenter;
    for (let i = 0; i < this.wallMaterials.length; i++) {
      const u = this.wallMaterials[i].uniforms;
      const back = i === 2;
      u.uColor.value.copy(m.wall).multiplyScalar(back ? 0.4 : 1);
      u.uSeam.value.copy(m.seam).multiplyScalar(back ? 0.3 - flow * 0.15 : 1);
      u.uTime.value = time;
      u.uFlow.value = flow;
    }

    // ground block
    const gu = this.groundMaterial.uniforms;
    gu.uColor.value.copy(this.palettes[0].platform).multiplyScalar(0.6);
    gu.uRim.value.copy(this.palettes[0].rim);
    gu.uTime.value = time;

    this.syncPlatforms(view);

    // the climber
    const p = state.player;
    this.climber.update({
      x: view.px,
      y: view.py,
      vx: p.vx,
      vy: p.vy,
      grounded: p.grounded,
      superJump: p.superJump,
      facing: p.facing,
      flow,
      dt,
      time,
    });
    const breeze = m.wind - p.facing * 40 - p.vx * 0.15;
    this.scarf.update(this.climber.neck(this.tmp), dt, breeze, Math.max(flow, p.superJump ? 0.6 : 0));
    if (state.phase === "playing" && dt > 0) {
      if (p.superJump && !p.grounded) {
        this.sparks.burst({
          x: view.px, y: view.py + BODY_CENTER, count: 2, color: m.accent, intensity: 2.2,
          speed: [10, 50], size: [6, 12], life: [0.25, 0.5], gravity: 0, spreadZ: 10,
        });
      }
      if (p.grounded && Math.abs(p.vx) > 520 && Math.random() < 0.6) {
        this.sparks.burst({
          x: view.px - Math.sign(p.vx) * 10, y: view.py + 2, count: 1, color: m.platform, intensity: 1.1,
          speed: [40, 120], angle: [Math.PI * 0.2, Math.PI * 0.8], gravity: 600, size: [4, 8], life: [0.2, 0.4],
        });
      }
    }

    // ghost
    const g = view.ghost;
    if (g && state.phase !== "ready") {
      this.ghost.group.visible = true;
      this.ghost.group.position.set(g.x, g.y, -4);
      this.ghost.group.rotation.z = -Math.max(-0.25, Math.min(0.25, g.vx / 40));
      this.ghost.material.opacity = g.done ? Math.max(0, this.ghost.material.opacity - dt * 0.8) : 0.3;
    } else {
      this.ghost.group.visible = false;
    }

    // effects
    this.sparks.update(dt);
    this.tmpColor.copy(m.accent).lerp(new THREE.Color(1, 1, 1), 0.6);
    this.snow.update(dt, time, view.cameraY, this.visibleH, m.wind, this.tmpColor);
    this.updateShards(dt, camCenter);
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const { life, radius } = r.mesh.userData as { life: number; radius: number };
      const k = 1 - Math.max(0, r.life) / life;
      const ease = 1 - Math.pow(1 - k, 3);
      r.mesh.scale.setScalar(12 + radius * ease);
      r.material.opacity = (1 - k) * 0.9;
      if (r.life <= 0) r.mesh.visible = false;
    }

    // lights follow the palette
    this.ambient.color.copy(m.ambient);
    this.ambient.groundColor.copy(m.skyBottom);
    this.key.color.copy(m.ambient).lerp(new THREE.Color(1, 1, 1), 0.5);
    this.key.position.set(FIELD_W / 2 - 400, camCenter + 500, 900);
    this.key.target.position.set(FIELD_W / 2, camCenter, 0);

    // post
    this.lastFlow = flow;
    this.bloom.strength = 0.55 + flow * 0.5 + this.flash * 1.2;
    this.flash = Math.max(0, this.flash - dt * 1.6);
    const fu = this.finish.uniforms;
    fu.uAberration.value = reduceMotion ? 0 : 0.0015 + flow * 0.006 + shake * 0.012;
    fu.uDanger.value = view.danger;
    fu.uFlash.value = this.flash;
    fu.uFlashColor.value.copy(this.flashColor);
    fu.uTime.value = time;
    fu.uGrain.value = reduceMotion ? 0 : 0.03;

    this.composer.render(dt);
  }

  private syncPlatforms(view: FrameView): void {
    const { state } = view;
    const first = Math.max(1, Math.floor((view.cameraY - PLATFORM_T - 60) / FLOOR_GAP));
    const last = Math.ceil((view.cameraY + this.visibleH + 60) / FLOOR_GAP);

    for (const [floor, slot] of this.slotByFloor) {
      if (floor < first || floor > last) {
        slot.mesh.visible = slot.label.visible = false;
        slot.floor = -1;
        this.slotByFloor.delete(floor);
      }
    }

    for (let floor = first; floor <= last; floor++) {
      let slot = this.slotByFloor.get(floor);
      if (!slot) {
        slot = this.slots.find((s) => s.floor === -1);
        if (!slot) break;
        slot.floor = floor;
        this.slotByFloor.set(floor, slot);
        this.assignLabel(slot, floor);
      }
      const platform = platformAt(state.seed, floor);
      const crack = state.cracks.find((c) => c.floor === floor);
      const gone = isCrumbled(state, floor);
      slot.mesh.visible = !gone;
      slot.label.visible = !gone && slot.labelMaterial.map !== null;
      if (gone) continue;

      const left = platformLeft(platform, state.time);
      const cx = left + platform.width / 2;
      const top = platform.y;
      slot.mesh.scale.set(platform.width, PLATFORM_T, PLATFORM_DEPTH);
      slot.mesh.position.set(cx, top - PLATFORM_T / 2, 0);
      const colors = this.palettes[stratumIndexAt(floor)];
      const u = slot.material.uniforms;
      u.uColor.value.copy(colors.platform);
      u.uRim.value.copy(colors.rim);
      u.uSize.value.set(platform.width, PLATFORM_T, PLATFORM_DEPTH);
      u.uKind.value = platform.full ? 3 : platform.kind === "drift" ? 1 : platform.kind === "brittle" ? 2 : 0;
      u.uCrack.value = crack ? Math.min(1, (state.time - crack.at) / BRITTLE_DELAY) : 0;
      u.uTime.value = this.time;
      u.uFlow.value = this.lastFlow;
      if (crack) slot.mesh.position.x += Math.sin(this.time * 90) * 1.5 * u.uCrack.value;

      if (slot.label.visible) {
        const entry = slot.label.userData as { aspect: number };
        const h = platform.full ? 13 : 12;
        slot.label.scale.set(h * entry.aspect, h, 1);
        slot.label.position.set(platform.full ? FIELD_W / 2 : cx, top - PLATFORM_T / 2, PLATFORM_DEPTH / 2 + 0.6);
        slot.labelMaterial.color.copy(colors.rim).multiplyScalar(1.6);
      }
    }
  }

  private assignLabel(slot: Slot, floor: number): void {
    const gate = floor % 50 === 0;
    if (floor % 10 !== 0) {
      slot.labelMaterial.map = null;
      slot.labelMaterial.needsUpdate = true;
      return;
    }
    const text = gate ? `${floor}  ·  ${STRATA[stratumIndexAt(floor)].name.toUpperCase()}` : String(floor);
    let entry = this.labels.get(text);
    if (!entry) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const font = "600 52px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.font = font;
      const w = Math.ceil(ctx.measureText(text).width) + 24;
      canvas.width = w;
      canvas.height = 64;
      ctx.font = font;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, 34);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      entry = { texture, aspect: w / 64 };
      this.labels.set(text, entry);
    }
    slot.labelMaterial.map = entry.texture;
    slot.labelMaterial.needsUpdate = true;
    slot.label.userData = { aspect: entry.aspect };
  }

  private updateShards(dt: number, camCenter: number): void {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const m = this.mix;
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i];
      const half = (this.dist - s.z) * tanHalf * 1.25;
      const range = half * 2;
      const rel = s.y - (camCenter - half);
      if (rel < 0 || rel > range) s.y = camCenter - half + (((rel % range) + range) % range);
      s.rot.x += s.spin.x * dt;
      s.rot.y += s.spin.y * dt;
      s.rot.z += s.spin.z * dt;
      this.tmpQuat.setFromEuler(s.rot);
      this.tmpScale.set(s.scale, s.scale * s.stretch, s.scale);
      this.tmpMatrix.compose(this.tmp.set(s.x, s.y, s.z), this.tmpQuat, this.tmpScale);
      this.shardMesh.setMatrixAt(i, this.tmpMatrix);
      const depth = Math.min(1, (-s.z - 260) / 1500);
      this.tmpColor.copy(m.wall).lerp(m.skyBottom, 0.3 + depth * 0.6);
      this.shardMesh.setColorAt(i, this.tmpColor);
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
    if (this.shardMesh.instanceColor) this.shardMesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.sparks.dispose();
    this.snow.dispose();
    this.climber.dispose();
    this.scarf.dispose();
    for (const { texture } of this.labels.values()) texture.dispose();
    this.labels.clear();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) (mat as THREE.Material).dispose();
      }
    });
    this.composer.dispose();
    this.renderer.dispose();
  }
}
