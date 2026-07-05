"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BURST_SECONDS,
  CHICKEN_HEIGHT,
  CHICKEN_WIDTH,
  LAYERS,
  MAX_SHELLS,
  POPUP_SECONDS,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  createInitialState,
  pause,
  resume,
  shoot,
  startReload,
  startRound,
  update,
  type GameState,
  type Phase,
  type Tick,
} from "@/components/game/engine";
import { loadChickenSprites, type ChickenSprites } from "@/components/game/sprites";
import { Sfx } from "@/components/game/audio";
import { loadBest, saveBest } from "@/components/game/storage";

const HORIZON_Y = 560;
const MAX_FRAME_DT = 0.05; // clamp frame spikes so physics stays stable
// Clicking/tapping the shell readout reloads instead of shooting (spec)
const SHELL_HUD = { x: 16, y: VIRTUAL_HEIGHT - 88, w: 232, h: 64 };

// mulberry32 — deterministic scenery layout (stars, hill ridges)
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS = (() => {
  const rand = seeded(7);
  return Array.from({ length: 70 }, () => ({
    x: rand() * VIRTUAL_WIDTH,
    y: rand() * (HORIZON_Y - 120),
    r: 0.6 + rand() * 1.3,
    phase: rand() * Math.PI * 2,
  }));
})();

const HILLS = (() => {
  const rand = seeded(21);
  return [
    { color: "#0c1712", baseY: 470, amplitude: 70, drift: 14 },
    { color: "#0a1310", baseY: 520, amplitude: 50, drift: 26 },
    { color: "#07100c", baseY: 565, amplitude: 35, drift: 42 },
  ].map((spec) => ({ ...spec, ridge: Array.from({ length: 16 }, () => rand()) }));
})();

interface SceneInput {
  state: GameState;
  time: number;
  pointer: { x: number; y: number; inside: boolean };
  sprites: ChickenSprites | null;
  reduce: boolean;
  flash: number;
  monoFont: string;
}

function drawScene(ctx: CanvasRenderingContext2D, s: SceneInput): void {
  const { state, time, pointer, sprites, reduce, flash, monoFont } = s;

  // Sky and ground, overscanned ±24 so screen shake never reveals gaps
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
  sky.addColorStop(0, "#0a0a0a");
  sky.addColorStop(0.65, "#0a1410");
  sky.addColorStop(1, "#0f2b1f");
  ctx.fillStyle = sky;
  ctx.fillRect(-24, -24, VIRTUAL_WIDTH + 48, HORIZON_Y + 24);
  ctx.fillStyle = "#050a07";
  ctx.fillRect(-24, HORIZON_Y, VIRTUAL_WIDTH + 48, VIRTUAL_HEIGHT - HORIZON_Y + 48);

  // Stars
  for (const star of STARS) {
    const twinkle = reduce ? 0.7 : 0.5 + 0.5 * Math.sin(time * 1.3 + star.phase);
    ctx.globalAlpha = 0.25 + 0.45 * twinkle;
    ctx.fillStyle = "#e8f5ee";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon with a soft emerald glow
  ctx.save();
  ctx.shadowColor = "rgba(110, 231, 183, 0.35)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = "#dcefe6";
  ctx.beginPath();
  ctx.arc(1040, 130, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Parallax hill silhouettes (each ridge drawn twice for seamless wraparound)
  for (const hill of HILLS) {
    const offset = reduce ? 0 : -((time * hill.drift) % VIRTUAL_WIDTH);
    ctx.fillStyle = hill.color;
    for (const shift of [0, VIRTUAL_WIDTH]) {
      ctx.beginPath();
      ctx.moveTo(offset + shift, VIRTUAL_HEIGHT + 48);
      const seg = VIRTUAL_WIDTH / 16;
      for (let i = 0; i <= 16; i++) {
        ctx.lineTo(offset + shift + i * seg, hill.baseY - hill.ridge[i % 16] * hill.amplitude);
      }
      ctx.lineTo(offset + shift + VIRTUAL_WIDTH, VIRTUAL_HEIGHT + 48);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Chickens, far layer first so near ones draw on top
  const byDepth = [...state.chickens].sort((a, b) => LAYERS[a.layer].scale - LAYERS[b.layer].scale);
  for (const c of byDepth) {
    const spec = LAYERS[c.layer];
    const w = CHICKEN_WIDTH * spec.scale;
    const h = CHICKEN_HEIGHT * spec.scale;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.falling) ctx.rotate(Math.min(1.4, c.fallVy / 500));
    if (c.vx > 0) ctx.scale(-1, 1); // art faces left
    const frame = sprites ? sprites.frames[Math.floor(time * 8) % 2] : null;
    if (frame) {
      ctx.drawImage(frame, -w / 2, -h / 2, w, h);
    } else {
      // Sprites still loading — body-colored placeholder keeps the game playable
      ctx.fillStyle = "#8a5a33";
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Feather bursts
  for (const b of state.bursts) {
    const t = b.age / BURST_SECONDS;
    ctx.globalAlpha = 1 - t;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 10 + t * 44;
      ctx.fillStyle = i % 2 ? "#b98a56" : "#e8e2d8";
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(angle) * dist, b.y + Math.sin(angle) * dist, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Score popups
  ctx.textAlign = "center";
  for (const p of state.popups) {
    const t = p.age / POPUP_SECONDS;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = "#6ee7b7";
    ctx.font = `600 26px ${monoFont}`;
    ctx.fillText(`+${p.points}`, p.x, p.y - 18 - t * 40);
    ctx.globalAlpha = 1;
  }

  if (state.phase === "playing" || state.phase === "paused") {
    // Timer, top center
    const total = Math.ceil(state.timeLeft);
    const clock = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    ctx.fillStyle = "#ededed";
    ctx.font = `600 24px ${monoFont}`;
    ctx.textAlign = "center";
    ctx.fillText(clock, VIRTUAL_WIDTH / 2, 44);

    // Score, top right
    ctx.textAlign = "right";
    ctx.fillStyle = "#34d399";
    ctx.fillText(`SCORE ${state.score}`, VIRTUAL_WIDTH - 24, 44);

    // Shells, bottom left
    for (let i = 0; i < MAX_SHELLS; i++) {
      const x = 24 + i * 26;
      ctx.globalAlpha = i < state.shells ? 1 : 0.18;
      ctx.fillStyle = "#d84f42";
      ctx.fillRect(x, VIRTUAL_HEIGHT - 64, 14, 8);
      ctx.fillStyle = "#b98a56";
      ctx.fillRect(x, VIRTUAL_HEIGHT - 56, 14, 24);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.font = `600 18px ${monoFont}`;
    if (state.reloading) {
      ctx.fillStyle = "#6ee7b7";
      ctx.fillText("RELOADING…", 24, VIRTUAL_HEIGHT - 76);
    } else if (state.shells === 0) {
      // Empty-chamber hint (spec) — blinks until the player reloads
      ctx.globalAlpha = reduce ? 1 : 0.6 + 0.4 * Math.sin(time * 10);
      ctx.fillStyle = "#d84f42";
      ctx.fillText("RELOAD! [R]", 24, VIRTUAL_HEIGHT - 76);
      ctx.globalAlpha = 1;
    }
  }

  if (state.phase === "playing" && pointer.inside) {
    // Crosshair
    const { x: px, y: py } = pointer;
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - 22, py);
    ctx.lineTo(px - 8, py);
    ctx.moveTo(px + 8, py);
    ctx.lineTo(px + 22, py);
    ctx.moveTo(px, py - 22);
    ctx.lineTo(px, py - 8);
    ctx.moveTo(px, py + 8);
    ctx.lineTo(px, py + 22);
    ctx.stroke();

    // Muzzle flash
    if (flash > 0) {
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 90);
      glow.addColorStop(0, `rgba(255, 240, 200, ${0.55 * (flash / 0.07)})`);
      glow.addColorStop(1, "rgba(255, 240, 200, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(px - 90, py - 90, 180, 180);
    }
  }
}

export function MoorhuhnGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const spritesRef = useRef<ChickenSprites | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const pointerRef = useRef({ x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2, inside: false });
  const flashRef = useRef(0);
  const shakeRef = useRef(0);
  const reduceRef = useRef(false);
  const timeRef = useRef(0);
  const monoFontRef = useRef("monospace");

  const [phase, setPhase] = useState<Phase>("ready");
  const [muted, setMutedState] = useState(true);
  const [endScore, setEndScore] = useState(0);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const applyTick = useCallback((tick: Tick) => {
    stateRef.current = tick.state;
    const sfx = sfxRef.current;
    for (const event of tick.events) {
      switch (event.type) {
        case "shot":
          sfx?.shot();
          flashRef.current = 0.07;
          if (!reduceRef.current) shakeRef.current = 0.15;
          break;
        case "empty":
          sfx?.empty();
          break;
        case "hit":
          sfx?.squawk();
          break;
        case "reloadStart":
          sfx?.reload();
          break;
        case "reloadEnd":
          break;
        case "roundEnd": {
          sfx?.jingle();
          const previousBest = loadBest();
          const newBest = event.score > previousBest;
          if (newBest) saveBest(event.score);
          setBest(newBest ? event.score : previousBest);
          setEndScore(event.score);
          setIsNewBest(newBest);
          setPhase("ended");
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    sfxRef.current = new Sfx();
    setMutedState(sfxRef.current.muted);
    setBest(loadBest());
    loadChickenSprites()
      .then((sprites) => {
        spritesRef.current = sprites;
      })
      .catch(() => {
        // placeholder blobs keep the game playable
      });
    monoFontRef.current =
      getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() ||
      "monospace";

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceRef.current = media.matches;
    const onMedia = (event: MediaQueryListEvent) => {
      reduceRef.current = event.matches;
    };
    media.addEventListener("change", onMedia);

    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");

    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(wrap.clientWidth * dpr);
      canvas.height = Math.round(wrap.clientWidth * (9 / 16) * dpr);
    };
    size();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(size);
      observer.observe(wrap);
    }

    const pauseGame = () => {
      if (phaseRef.current === "playing") {
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
        if (phaseRef.current === "playing") {
          pauseGame();
        } else if (phaseRef.current === "paused") {
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
    const loop = (now: number) => {
      const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
      last = now;
      timeRef.current += dt;
      applyTick(update(stateRef.current, dt, Math.random));
      flashRef.current = Math.max(0, flashRef.current - dt);
      shakeRef.current = Math.max(0, shakeRef.current - dt);

      if (ctx) {
        const scale = canvas.width / VIRTUAL_WIDTH;
        const shake = reduceRef.current ? 0 : shakeRef.current;
        const ox = shake > 0 ? (Math.random() - 0.5) * 10 * (shake / 0.15) : 0;
        const oy = shake > 0 ? (Math.random() - 0.5) * 8 * (shake / 0.15) : 0;
        ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
        drawScene(ctx, {
          state: stateRef.current,
          time: timeRef.current,
          pointer: pointerRef.current,
          sprites: spritesRef.current,
          reduce: reduceRef.current,
          flash: flashRef.current,
          monoFont: monoFontRef.current,
        });
      }
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
    };
  }, [applyTick]);

  const toVirtual = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIRTUAL_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = { ...toVirtual(event), inside: true };
  };

  const onPointerLeave = () => {
    pointerRef.current.inside = false;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "playing") return;
    const p = toVirtual(event);
    pointerRef.current = { ...p, inside: true };
    const inShellHud =
      p.x >= SHELL_HUD.x &&
      p.x <= SHELL_HUD.x + SHELL_HUD.w &&
      p.y >= SHELL_HUD.y &&
      p.y <= SHELL_HUD.y + SHELL_HUD.h;
    applyTick(inShellHud ? startReload(stateRef.current) : shoot(stateRef.current, p.x, p.y));
  };

  const begin = () => {
    stateRef.current = startRound(stateRef.current);
    setPhase("playing");
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

  return (
    <div
      ref={wrapRef}
      className="relative w-full max-w-[1100px] overflow-hidden rounded-xl border border-line bg-surface"
    >
      <canvas
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerLeave={onPointerLeave}
        className={`block w-full touch-none ${phase === "playing" ? "cursor-none" : ""}`}
      />

      <button
        type="button"
        onClick={toggleMute}
        aria-pressed={!muted}
        className="absolute left-3 top-3 rounded border border-line bg-bg/70 px-2 py-1 font-mono text-xs text-muted hover:text-ink"
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
          <h2 className="text-3xl font-semibold tracking-tight">🎯 Moorhuhn</h2>
          <p className="max-w-md text-sm text-muted">
            90 seconds. 8 shells. Far chickens score more. Click or tap to shoot, press R (or the
            button) to reload, Esc to pause. Aiming needs a mouse or touch.
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
          <p aria-live="polite" className="font-mono text-lg">
            Score: <span className="text-accent">{endScore}</span> · Best: {best}
            {isNewBest && <span className="ml-2 text-accent-soft">New personal best!</span>}
          </p>
          <ActionButton onClick={begin}>Play again</ActionButton>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/70 p-6 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-accent bg-accent/10 px-6 py-2 font-mono text-sm text-accent hover:bg-accent/20"
    >
      {children}
    </button>
  );
}
