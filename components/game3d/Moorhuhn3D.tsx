"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  MAX_SHELLS,
  ROUND_SECONDS,
  createInitialState,
  pause,
  resume,
  shoot,
  startReload,
  startRound,
  update,
  type GameState3D,
  type Phase,
  type Tick3D,
  type Vec3,
} from "@/components/game3d/engine3d";
import { skyColorsAt } from "@/components/game3d/daynight";
import {
  createSkyDome,
  createStars,
  createTerrain,
  createTrees,
  createWindmill,
  seeded,
  terrainHeight,
} from "@/components/game3d/world";
import { createChickenTemplate, flapChicken, makeGolden } from "@/components/game3d/chicken";
import { FeatherParticles } from "@/components/game3d/particles";
import { Sfx } from "@/components/game/audio";
import { BEST_3D_KEY, loadBest, saveBest } from "@/components/game/storage";
import { ActionButton, Overlay } from "@/components/game/ui";

const MAX_FRAME_DT = 0.05; // clamp frame spikes so physics stays stable
const YAW_LIMIT = 1.31; // ≈75° each way — a panorama, not a full turn
const PITCH_MIN = -0.17;
const PITCH_MAX = 0.52;
const EDGE_ZONE = 0.15; // outer viewport fraction that edge-pans (desktop)
const PAN_SPEED = 1.4; // rad/s at full edge strength
const DRAG_THRESHOLD_PX = 8; // touch: less movement than this within the window is a tap
const TAP_MAX_MS = 300;
const POPUP_MS = 800; // keep in sync with the popup3d keyframes duration

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface Popup {
  id: number;
  left: number; // viewport %
  top: number;
  text: string;
  golden: boolean;
}

export function Moorhuhn3D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState3D>(createInitialState());
  const sfxRef = useRef<Sfx | null>(null);
  const particlesRef = useRef<FeatherParticles | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
  } | null>(null);
  const reduceRef = useRef(false);
  const popupIdRef = useRef(0);

  // camera + input state, mutated from the loop and handlers without re-rendering
  const camRef = useRef({ yaw: 0, pitch: 0.08 });
  const pointerRef = useRef({ nx: 0.5, ny: 0.5, inside: false });
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startYaw: number;
    startPitch: number;
    moved: boolean;
    t0: number;
  } | null>(null);

  // HUD nodes written straight from the render loop, bypassing React
  const clockRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const multiplierRef = useRef<HTMLSpanElement>(null);
  const shellsRef = useRef<HTMLDivElement>(null);
  const reloadHintRef = useRef<HTMLSpanElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [muted, setMutedState] = useState(true);
  const [failed, setFailed] = useState(false);
  const [endScore, setEndScore] = useState(0);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [popups, setPopups] = useState<Popup[]>([]);

  const spawnPopup = useCallback((pos: Vec3, text: string, golden: boolean) => {
    const three = threeRef.current;
    if (!three) return;
    const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(three.camera);
    if (v.z > 1) return; // behind the camera
    const id = ++popupIdRef.current;
    setPopups((prev) => [
      ...prev,
      { id, left: (v.x * 0.5 + 0.5) * 100, top: (0.5 - v.y * 0.5) * 100, text, golden },
    ]);
    window.setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), POPUP_MS);
  }, []);

  const applyTick = useCallback(
    (tick: Tick3D) => {
      stateRef.current = tick.state;
      const sfx = sfxRef.current;
      for (const event of tick.events) {
        switch (event.type) {
          case "shot":
            sfx?.shot();
            break;
          case "empty":
            sfx?.empty();
            break;
          case "hit":
            sfx?.squawk();
            if (event.golden) sfx?.fanfare();
            particlesRef.current?.burst(event.pos, event.golden);
            spawnPopup(event.pos, `+${event.points}`, event.golden);
            break;
          case "combo":
            sfx?.combo(event.multiplier);
            break;
          case "goldenSpawn":
            setAnnouncement("Golden chicken on the field!");
            break;
          case "reloadStart":
            sfx?.reload();
            break;
          case "reloadEnd":
            break;
          case "roundEnd": {
            sfx?.jingle();
            const previousBest = loadBest(BEST_3D_KEY);
            const newBest = event.score > previousBest;
            if (newBest) saveBest(BEST_3D_KEY, event.score);
            setBest(newBest ? event.score : previousBest);
            setEndScore(event.score);
            setIsNewBest(newBest);
            setPhase("ended");
            setAnnouncement(
              `Round over. Score ${event.score}.${newBest ? " New personal best!" : ""}`,
            );
            break;
          }
          default:
            event satisfies never;
        }
      }
    },
    [spawnPopup],
  );

  useEffect(() => {
    sfxRef.current = new Sfx();
    setMutedState(sfxRef.current.muted);
    setBest(loadBest(BEST_3D_KEY));

    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x453028, 30, 180);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 600);
    camera.position.set(0, 1.5, 0);
    camera.rotation.order = "YXZ";

    const rand = seeded(42);
    const sky = createSkyDome();
    const stars = createStars(rand);
    const terrain = createTerrain(rand);
    const trees = createTrees(rand);
    const windmill = createWindmill();
    windmill.position.set(-26, terrainHeight(-26, -48), -48);
    const sun = new THREE.DirectionalLight(0xffd9a0, 1);
    sun.position.set(-40, 60, -30);
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const particles = new FeatherParticles();
    particlesRef.current = particles;
    scene.add(sky, stars, terrain, trees, windmill, sun, ambient, particles.points);

    const chickenTemplate = createChickenTemplate();
    const chickenMeshes = new Map<number, THREE.Group>();

    raycasterRef.current = new THREE.Raycaster();
    threeRef.current = { renderer, scene, camera };

    const size = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(size);
      observer.observe(wrap);
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceRef.current = media.matches;
    const onMedia = (event: MediaQueryListEvent) => {
      reduceRef.current = event.matches;
    };
    media.addEventListener("change", onMedia);

    const pauseGame = () => {
      if (stateRef.current.phase === "playing") {
        stateRef.current = pause(stateRef.current);
        setPhase("paused");
      }
    };
    const onVisibility = () => {
      if (document.hidden) pauseGame();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "r" || event.key === "R") {
        applyTick(startReload(stateRef.current));
      } else if (event.key === "Escape") {
        if (stateRef.current.phase === "playing") {
          pauseGame();
        } else if (stateRef.current.phase === "paused") {
          stateRef.current = resume(stateRef.current);
          setPhase("playing");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pauseGame);
    window.addEventListener("keydown", onKey);

    let raf = 0;
    let last = performance.now();
    let time = 0;
    const loop = (now: number) => {
      const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
      last = now;
      time += dt;

      if (stateRef.current.phase === "playing") {
        applyTick(update(stateRef.current, dt, Math.random));
      }
      const state = stateRef.current;

      // desktop edge panning (touch pans via drag in the pointer handlers)
      const ptr = pointerRef.current;
      const cam = camRef.current;
      if (state.phase === "playing" && ptr.inside && !dragRef.current) {
        if (ptr.nx < EDGE_ZONE) cam.yaw += PAN_SPEED * dt * (1 - ptr.nx / EDGE_ZONE);
        if (ptr.nx > 1 - EDGE_ZONE) cam.yaw -= PAN_SPEED * dt * ((ptr.nx - (1 - EDGE_ZONE)) / EDGE_ZONE);
        if (ptr.ny < EDGE_ZONE) cam.pitch += PAN_SPEED * 0.5 * dt * (1 - ptr.ny / EDGE_ZONE);
        if (ptr.ny > 1 - EDGE_ZONE) cam.pitch -= PAN_SPEED * 0.5 * dt * ((ptr.ny - (1 - EDGE_ZONE)) / EDGE_ZONE);
        cam.yaw = clamp(cam.yaw, -YAW_LIMIT, YAW_LIMIT);
        cam.pitch = clamp(cam.pitch, PITCH_MIN, PITCH_MAX);
      }
      camera.rotation.y = cam.yaw;
      camera.rotation.x = cam.pitch;

      // sync chicken meshes to engine state
      const seen = new Set<number>();
      for (const c of state.chickens) {
        seen.add(c.id);
        let mesh = chickenMeshes.get(c.id);
        if (!mesh) {
          mesh = chickenTemplate.clone();
          if (c.golden) {
            makeGolden(mesh);
            mesh.scale.setScalar(1.15);
          }
          scene.add(mesh);
          chickenMeshes.set(c.id, mesh);
        }
        mesh.position.set(c.pos.x, c.pos.y, c.pos.z);
        mesh.rotation.y = c.vx >= 0 ? 0 : Math.PI;
        mesh.rotation.z = c.falling ? Math.min(1.4, c.fallVy / 12) : 0;
        flapChicken(mesh, time + c.id, c.falling); // id offset desyncs the flaps
      }
      for (const [id, mesh] of chickenMeshes) {
        if (!seen.has(id)) {
          scene.remove(mesh);
          chickenMeshes.delete(id);
        }
      }

      // day/night: the sky darkens as the round progresses
      const progress = state.phase === "ready" ? 0 : 1 - state.timeLeft / ROUND_SECONDS;
      const colors = skyColorsAt(progress);
      const skyMat = sky.material as THREE.ShaderMaterial;
      (skyMat.uniforms.topColor.value as THREE.Color).setRGB(...colors.top);
      (skyMat.uniforms.horizonColor.value as THREE.Color).setRGB(...colors.horizon);
      (scene.fog as THREE.Fog).color.setRGB(...colors.fog);
      (stars.material as THREE.PointsMaterial).opacity = colors.starAlpha;
      sun.color.setRGB(...colors.light);
      sun.intensity = colors.lightIntensity;
      ambient.intensity = colors.ambientIntensity;

      const blades = windmill.getObjectByName("blades");
      if (blades && !reduceRef.current) blades.rotation.z += dt * 0.8;

      particles.update(dt);

      // HUD via refs — no React re-render per frame
      const total = Math.ceil(state.timeLeft);
      if (clockRef.current) {
        clockRef.current.textContent = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
      }
      if (scoreRef.current) scoreRef.current.textContent = `SCORE ${state.score}`;
      if (multiplierRef.current) {
        multiplierRef.current.textContent = state.multiplier > 1 ? ` ×${state.multiplier}` : "";
      }
      if (shellsRef.current) {
        const nodes = shellsRef.current.children;
        for (let i = 0; i < nodes.length; i++) {
          (nodes[i] as HTMLElement).style.opacity = i < state.shells ? "1" : "0.18";
        }
      }
      if (reloadHintRef.current) {
        reloadHintRef.current.textContent = state.reloading
          ? "RELOADING…"
          : state.shells === 0
            ? "RELOAD! [R]"
            : "";
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      media.removeEventListener("change", onMedia);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pauseGame);
      window.removeEventListener("keydown", onKey);
      particles.dispose();
      particlesRef.current = null;
      const disposeObject = (obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) (m as THREE.Material).dispose();
        }
      };
      scene.traverse(disposeObject);
      chickenTemplate.traverse(disposeObject);
      chickenMeshes.clear();
      renderer.dispose();
      threeRef.current = null;
    };
  }, [applyTick]);

  const toLocal = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      nx: (event.clientX - rect.left) / rect.width,
      ny: (event.clientY - rect.top) / rect.height,
    };
  };

  const shootAt = useCallback(
    (nx: number, ny: number) => {
      const three = threeRef.current;
      const raycaster = raycasterRef.current;
      if (!three || !raycaster) return;
      raycaster.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), three.camera);
      const { origin, direction } = raycaster.ray;
      applyTick(
        shoot(stateRef.current, {
          origin: { x: origin.x, y: origin.y, z: origin.z },
          dir: { x: direction.x, y: direction.y, z: direction.z },
        }),
      );
    },
    [applyTick],
  );

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toLocal(event);
    pointerRef.current = { nx: p.nx, ny: p.ny, inside: true };
    const drag = dragRef.current;
    if (drag && event.pointerId === drag.pointerId) {
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) drag.moved = true;
      if (drag.moved) {
        const rect = event.currentTarget.getBoundingClientRect();
        camRef.current.yaw = clamp(drag.startYaw + (dx / rect.width) * 2.4, -YAW_LIMIT, YAW_LIMIT);
        camRef.current.pitch = clamp(
          drag.startPitch + (dy / rect.height) * 1.2,
          PITCH_MIN,
          PITCH_MAX,
        );
      }
    }
    const cross = crosshairRef.current;
    if (cross) {
      cross.style.left = `${(p.nx * 100).toFixed(2)}%`;
      cross.style.top = `${(p.ny * 100).toFixed(2)}%`;
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const p = toLocal(event);
    pointerRef.current = { nx: p.nx, ny: p.ny, inside: true };
    if (event.pointerType === "touch") {
      // tap-vs-drag is decided on pointerup
      dragRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startYaw: camRef.current.yaw,
        startPitch: camRef.current.pitch,
        moved: false,
        t0: performance.now(),
      };
      return;
    }
    if (stateRef.current.phase === "playing") shootAt(p.nx, p.ny);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (
      !drag.moved &&
      performance.now() - drag.t0 < TAP_MAX_MS &&
      stateRef.current.phase === "playing"
    ) {
      const p = toLocal(event);
      shootAt(p.nx, p.ny);
    }
  };

  const onPointerLeave = () => {
    pointerRef.current.inside = false;
  };

  const begin = () => {
    stateRef.current = startRound(stateRef.current);
    setPhase("playing");
    setAnnouncement("");
  };

  const resumeGame = () => {
    stateRef.current = resume(stateRef.current);
    setPhase("playing");
  };

  const toggleMute = () => {
    const sfx = sfxRef.current;
    if (!sfx) return;
    sfx.setMuted(!sfx.muted);
    setMutedState(sfx.muted);
  };

  if (failed) {
    return (
      <div className="flex aspect-video w-full max-w-[1100px] flex-col items-center justify-center gap-4 rounded-xl border border-line bg-surface p-6 text-center">
        <h2 className="text-2xl font-semibold">3D not available</h2>
        <p className="max-w-md text-sm text-muted">
          Your browser couldn&apos;t start WebGL, which this game needs.
        </p>
        <Link
          href="/play/classic"
          className="font-mono text-sm text-accent underline underline-offset-4 hover:text-accent-soft"
        >
          Play Moorhuhn Classic instead →
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative aspect-video w-full max-w-[1100px] overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <canvas
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        className={`block h-full w-full touch-none ${phase === "playing" ? "cursor-none" : ""}`}
      />

      {(phase === "playing" || phase === "paused") && (
        <div className="pointer-events-none absolute inset-0 font-mono">
          <span
            ref={clockRef}
            className="absolute left-1/2 top-3 -translate-x-1/2 text-lg font-semibold text-ink"
          />
          <span className="absolute right-4 top-3 text-lg font-semibold text-accent">
            <span ref={scoreRef} />
            <span ref={multiplierRef} className="text-accent-soft" />
          </span>
          <div ref={shellsRef} className="absolute bottom-4 left-4 flex gap-2">
            {Array.from({ length: MAX_SHELLS }, (_, i) => (
              <span
                key={i}
                className="block h-7 w-3.5 rounded-sm bg-gradient-to-b from-[#d84f42] from-25% to-[#b98a56] to-25%"
              />
            ))}
          </div>
          <span
            ref={reloadHintRef}
            className="absolute bottom-12 left-4 text-xs font-semibold text-accent-soft"
          />
        </div>
      )}

      {popups.map((p) => (
        <span
          key={p.id}
          className={`pointer-events-none absolute font-mono text-lg font-semibold ${
            p.golden ? "text-amber-300" : "text-accent"
          }`}
          style={{ left: `${p.left}%`, top: `${p.top}%`, animation: "popup3d 0.8s ease-out forwards" }}
        >
          {p.text}
        </span>
      ))}

      {phase === "playing" && (
        <div
          ref={crosshairRef}
          className="pointer-events-none absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent"
          style={{ left: "50%", top: "50%" }}
        >
          <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
        </div>
      )}

      <button
        type="button"
        onClick={toggleMute}
        aria-pressed={!muted}
        className="absolute left-3 top-3 z-10 rounded border border-line bg-bg/70 px-2 py-1 font-mono text-xs text-muted hover:text-ink"
      >
        {muted ? "🔇 sound off" : "🔊 sound on"}
      </button>

      {phase === "playing" && (
        <button
          type="button"
          onClick={() => applyTick(startReload(stateRef.current))}
          className="absolute bottom-3 right-3 min-h-11 min-w-11 rounded border border-accent/40 bg-bg/70 px-4 py-2 font-mono text-xs text-accent hover:bg-bg"
        >
          RELOAD [R]
        </button>
      )}

      {phase === "ready" && (
        <Overlay>
          <h2 className="text-3xl font-semibold tracking-tight">🌄 Moorhuhn 3D</h2>
          <p className="max-w-md text-sm text-muted">
            90 seconds. 8 shells. Far birds score more and combos multiply — don&apos;t miss.
            Push the mouse to the screen edges to look around (drag on touch), click or tap to
            shoot, R reloads, Esc pauses. One golden chicken is out there.
          </p>
          <ActionButton onClick={begin}>Start round</ActionButton>
        </Overlay>
      )}

      {phase === "paused" && (
        <Overlay>
          <h2 className="text-2xl font-semibold">Paused</h2>
          <ActionButton onClick={resumeGame}>Resume</ActionButton>
        </Overlay>
      )}

      {phase === "ended" && (
        <Overlay>
          <h2 className="text-2xl font-semibold">Round over</h2>
          <p className="font-mono text-lg">
            Score: <span className="text-accent">{endScore}</span> · Best: {best}
            {isNewBest && <span className="ml-2 text-accent-soft">New personal best!</span>}
          </p>
          <ActionButton onClick={begin}>Play again</ActionButton>
        </Overlay>
      )}
    </div>
  );
}
