"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMBO_TIERS,
  COMBO_WINDOW,
  HURRY_INTERVAL,
  NO_INPUT,
  SCROLL_START_FLOOR,
  STEP,
  VIEW_H,
  createInitialState,
  pause,
  resume,
  scoreOf,
  startRun,
  step,
  type Input,
  type Phase,
  type TowerEvent,
  type TowerState,
} from "@/components/icytower/engine";
import { FIELD_W, STRATA } from "@/components/icytower/tower";
import {
  dailyNumber,
  dailySeed,
  ghostPoseAt,
  loadDailyBest,
  pushSample,
  saveDailyBest,
  shouldSample,
  todayKey,
  type GhostRun,
} from "@/components/icytower/ghost";
import { TowerAudio } from "@/components/icytower/audio";
import { TowerScene, type Quality } from "@/components/icytower/scene";
import { ICY_TOWER_BEST_KEY, loadBest, saveBest } from "@/components/game/storage";

type Mode = "daily" | "random";
type ToastKind = "combo" | "banner" | "hurry" | "note";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  sub?: string;
}

interface RunResult {
  mode: Mode;
  daily: number;
  score: number;
  floor: number;
  bestCombo: number;
  seconds: number;
  best: number;
  newBest: boolean;
  dailyBest: number;
  newDailyBest: boolean;
  profile: number[]; // highest floor, sampled once per second
}

const MAX_FRAME_DT = 0.1;
const SLOWMO_SCALE = 0.35;
const SLOWMO_SECONDS = 0.5;
const STEPS_PER_SECOND = Math.round(1 / STEP);
const TOAST_MS: Record<ToastKind, number> = { combo: 1700, banner: 2800, hurry: 1500, note: 2000 };
const SLOW_FRAME = 1 / 38; // sustained frames slower than this step the quality down
const RESTART_LOCK_MS = 900; // jump-mashing at the moment of death shouldn't skip the results

const SMALL_BUTTON =
  "min-h-9 rounded border border-white/15 bg-[#040814]/60 px-2.5 font-mono text-xs text-white/70 hover:text-white";

const fmt = (n: number) => n.toLocaleString("en-US");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function readPad(): { input: Input; start: boolean } {
  const none = { input: NO_INPUT, start: false };
  if (typeof navigator === "undefined" || !navigator.getGamepads) return none;
  for (const pad of navigator.getGamepads()) {
    if (!pad || !pad.connected) continue;
    const x = pad.axes[0] ?? 0;
    const pressed = (i: number) => pad.buttons[i]?.pressed ?? false;
    return {
      input: {
        left: x < -0.35 || pressed(14),
        right: x > 0.35 || pressed(15),
        jump: pressed(0) || pressed(1) || pressed(12),
      },
      start: pressed(9),
    };
  }
  return none;
}

function rumble(strength: number, ms: number): void {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return;
  for (const pad of navigator.getGamepads()) {
    const actuator = pad?.vibrationActuator as
      | { playEffect?: (type: string, params: Record<string, number>) => Promise<unknown> }
      | undefined;
    void actuator?.playEffect?.("dual-rumble", {
      duration: ms,
      strongMagnitude: strength,
      weakMagnitude: strength * 0.6,
    })?.catch(() => {});
  }
}

function canUseWebGL(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}

function buzz(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(pattern);
}

export function IcyTower() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<TowerState>(createInitialState(dailySeed(todayKey())));
  const prevRef = useRef({ x: FIELD_W / 2, y: 0, cam: 0 });
  const accRef = useRef(0);
  const flowRef = useRef(0);
  const slowmoRef = useRef(0);
  const modeRef = useRef<Mode>("daily");
  const dateRef = useRef(todayKey());
  const ghostRef = useRef<GhostRun | null>(null);
  const ghostPassedRef = useRef(false);
  const recordingRef = useRef<number[]>([]);
  const profileRef = useRef<number[]>([0]);
  const reduceRef = useRef(false);
  const touchRef = useRef<Input>({ ...NO_INPUT });
  const keysRef = useRef({ left: false, right: false, jump: false });
  const toastIdRef = useRef(0);
  const overAtRef = useRef(0);
  const toastTimersRef = useRef(new Set<number>());
  const finishRunRef = useRef<(event: Extract<TowerEvent, { type: "gameOver" }>) => void>(() => {});
  const beginRef = useRef<(mode: Mode) => void>(() => {});
  const toggleMuteRef = useRef<() => void>(() => {});

  // HUD nodes written straight from the render loop, bypassing React
  const floorRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const comboBoxRef = useRef<HTMLDivElement>(null);
  const comboFloorsRef = useRef<HTMLSpanElement>(null);
  const comboJumpsRef = useRef<HTMLSpanElement>(null);
  const comboBarRef = useRef<HTMLDivElement>(null);
  const clockHandRef = useRef<SVGLineElement>(null);
  const clockArcRef = useRef<SVGCircleElement>(null);
  const clockLabelRef = useRef<HTMLSpanElement>(null);
  const ghostTagRef = useRef<HTMLDivElement>(null);

  const [audio] = useState(() => new TowerAudio());
  const [muted, setMuted] = useState(() => audio.muted);
  const [phase, setPhase] = useState<Phase>("ready");
  const [mode, setMode] = useState<Mode>("daily");
  const [failed, setFailed] = useState(() => !canUseWebGL());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [touchUi, setTouchUi] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );
  const [best] = useState(() => loadBest(ICY_TOWER_BEST_KEY));
  const [todayBest] = useState(() => loadDailyBest(todayKey()));
  const [shared, setShared] = useState<"idle" | "copied" | "failed">("idle");

  const daily = dailyNumber(todayKey());

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.filter((t) => t.kind !== toast.kind), { ...toast, id }]);
    const timer = window.setTimeout(() => {
      toastTimersRef.current.delete(timer);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_MS[toast.kind]);
    toastTimersRef.current.add(timer);
  }, []);

  const finishRun = useCallback(
    (event: Extract<TowerEvent, { type: "gameOver" }>) => {
      const previousBest = loadBest(ICY_TOWER_BEST_KEY);
      const newBest = event.score > previousBest;
      if (newBest) saveBest(ICY_TOWER_BEST_KEY, event.score);

      let dailyBest = 0;
      let newDailyBest = false;
      if (modeRef.current === "daily") {
        const stored = loadDailyBest(dateRef.current);
        dailyBest = stored?.score ?? 0;
        if (event.score > dailyBest) {
          saveDailyBest({
            date: dateRef.current,
            score: event.score,
            floor: event.floor,
            samples: recordingRef.current.slice(),
          });
          dailyBest = event.score;
          newDailyBest = true;
        }
      }

      setResult({
        mode: modeRef.current,
        daily: dailyNumber(dateRef.current),
        score: event.score,
        floor: event.floor,
        bestCombo: event.bestCombo,
        seconds: Math.round(event.time),
        best: newBest ? event.score : previousBest,
        newBest,
        dailyBest,
        newDailyBest,
        profile: [...profileRef.current, event.floor],
      });
      overAtRef.current = performance.now();
      setShared("idle");
      setToasts([]);
      setPhase("over");
      setAnnouncement(
        `Game over on floor ${event.floor}. Score ${event.score}.${newBest ? " New personal best!" : ""}`,
      );
    },
    [],
  );

  useEffect(() => {
    finishRunRef.current = finishRun;
  }, [finishRun]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (failed || !stage || !canvas) return;

    let scene: TowerScene;
    try {
      scene = new TowerScene(canvas);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- context creation can still fail after the probe; this is a one-off switch to the fallback UI
      setFailed(true);
      return;
    }
    const timers = toastTimersRef.current;

    const size = () => scene.resize(stage.clientWidth, stage.clientHeight);
    size();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(size);
      observer.observe(stage);
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceRef.current = media.matches;
    const onMedia = (event: MediaQueryListEvent) => {
      reduceRef.current = event.matches;
    };
    media.addEventListener("change", onMedia);

    const pauseGame = () => {
      if (stateRef.current.phase !== "playing") return;
      stateRef.current = pause(stateRef.current);
      audio.stopMusic();
      setPhase("paused");
    };
    const resumeGame = () => {
      if (stateRef.current.phase !== "paused") return;
      stateRef.current = resume(stateRef.current);
      audio.startMusic();
      setPhase("playing");
    };
    const onVisibility = () => {
      if (document.hidden) pauseGame();
    };

    const KEYMAP: Record<string, "left" | "right" | "jump"> = {
      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
      Space: "jump",
      ArrowUp: "jump",
      KeyW: "jump",
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const phaseNow = stateRef.current.phase;
      const action = KEYMAP[event.code];
      if (action) {
        keysRef.current[action] = true;
        if (phaseNow === "playing") event.preventDefault();
      }
      if (event.code === "Escape" || event.code === "KeyP") {
        if (phaseNow === "playing") pauseGame();
        else if (phaseNow === "paused") resumeGame();
      } else if (event.code === "KeyM") {
        toggleMuteRef.current();
      } else if (
        (event.code === "Enter" || event.code === "Space") &&
        !event.repeat &&
        !(event.target instanceof HTMLButtonElement) // focused buttons handle their own keys
      ) {
        if (phaseNow === "ready" || (phaseNow === "over" && canRestart())) {
          event.preventDefault();
          beginRef.current(modeRef.current);
        } else if (phaseNow === "paused") {
          event.preventDefault();
          resumeGame();
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = KEYMAP[event.code];
      if (action) keysRef.current[action] = false;
    };
    const canRestart = () => performance.now() - overAtRef.current > RESTART_LOCK_MS;
    const releaseAll = () => {
      keysRef.current = { left: false, right: false, jump: false };
      touchRef.current = { ...NO_INPUT };
      pauseGame();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", releaseAll);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const handleEvent = (event: TowerEvent, state: TowerState) => {
      scene.handle(event, state, reduceRef.current);
      switch (event.type) {
        case "jump":
          audio.jump(event.power, event.superJump);
          break;
        case "land":
          audio.land(event.impact);
          if (state.combo.jumps > 0) buzz(8);
          break;
        case "wallBounce":
          audio.wall(event.speed);
          break;
        case "comboStep":
          audio.comboStep(event.jumps);
          comboBoxRef.current?.animate(
            [{ transform: "scale(1.22)" }, { transform: "scale(1)" }],
            { duration: 240, easing: "cubic-bezier(.2,.9,.3,1.4)" },
          );
          break;
        case "comboEnd": {
          if (event.tier < 0) break;
          audio.comboEnd(event.tier);
          pushToast({
            kind: "combo",
            title: COMBO_TIERS[event.tier].word,
            sub: `+${fmt(event.bonus)} · ${event.floors} floors in ${event.jumps} jumps`,
          });
          buzz(event.tier >= 3 ? [20, 40, 30] : 18);
          rumble(Math.min(1, 0.3 + event.tier * 0.1), 120 + event.tier * 30);
          if (event.tier >= 3 && !reduceRef.current) slowmoRef.current = SLOWMO_SECONDS;
          break;
        }
        case "scrollStart":
          pushToast({ kind: "note", title: "The tower is rising", sub: "don't fall off the bottom" });
          break;
        case "hurryUp":
          audio.hurry();
          pushToast({ kind: "hurry", title: "Hurry up!", sub: `speed ${event.level}` });
          buzz([30, 60, 30]);
          break;
        case "stratum": {
          const stratum = STRATA[event.index];
          audio.setMood({
            level: state.level,
            comboJumps: state.combo.jumps,
            stratum: event.index,
            altitude: clamp01(state.maxFloor / 300),
          });
          audio.stratum();
          pushToast({ kind: "banner", title: stratum.name, sub: stratum.twist });
          setAnnouncement(`Entering ${stratum.name}: ${stratum.twist}.`);
          break;
        }
        case "crack":
          audio.crack();
          break;
        case "crumble":
          audio.crumble();
          break;
        case "gameOver":
          audio.gameOver();
          buzz([60, 40, 120]);
          rumble(1, 400);
          finishRunRef.current(event);
          break;
        default:
          event satisfies never;
      }
    };

    // HUD: write only what changed
    const hud = { floor: "", score: "", comboOn: false, floors: "", jumps: "", clock: "", ghost: "" };
    const updateHud = (s: TowerState, ghostY: number | null, ghostX: number) => {
      const floor = String(s.maxFloor);
      if (floor !== hud.floor && floorRef.current) floorRef.current.textContent = hud.floor = floor;
      const score = fmt(scoreOf(s));
      if (score !== hud.score && scoreRef.current) scoreRef.current.textContent = hud.score = score;

      const comboOn = s.combo.jumps > 0;
      if (comboOn !== hud.comboOn && comboBoxRef.current) {
        comboBoxRef.current.style.opacity = comboOn ? "1" : "0";
        hud.comboOn = comboOn;
      }
      if (comboOn) {
        const floors = `${s.combo.floors}`;
        if (floors !== hud.floors && comboFloorsRef.current) comboFloorsRef.current.textContent = hud.floors = floors;
        const jumps = `${s.combo.jumps} ${s.combo.jumps === 1 ? "jump" : "jumps"}`;
        if (jumps !== hud.jumps && comboJumpsRef.current) comboJumpsRef.current.textContent = hud.jumps = jumps;
        if (comboBarRef.current) comboBarRef.current.style.transform = `scaleX(${clamp01(s.combo.timer / COMBO_WINDOW)})`;
      }

      const clockShare = s.scrolling ? s.hurryClock / HURRY_INTERVAL : 0;
      if (clockHandRef.current) clockHandRef.current.style.transform = `rotate(${clockShare * 360}deg)`;
      if (clockArcRef.current) clockArcRef.current.style.strokeDashoffset = String(100 - clockShare * 100);
      const clock = s.scrolling ? `speed ${s.level}` : `clock starts at floor ${SCROLL_START_FLOOR}`;
      if (clock !== hud.clock && clockLabelRef.current) clockLabelRef.current.textContent = hud.clock = clock;

      const tag = ghostTagRef.current;
      if (tag) {
        let text = "";
        if (ghostY !== null) {
          const pos = scene.toScreen(ghostX, ghostY + 20);
          const diff = Math.round((ghostY - s.player.y) / 80);
          if (pos.top < 6) {
            text = `▲ ghost +${Math.max(1, diff)}`;
            tag.style.top = "8px";
          } else if (pos.top > 94) {
            text = `▼ ghost ${Math.min(-1, diff)}`;
            tag.style.top = "calc(100% - 30px)";
          }
          tag.style.left = `${Math.min(88, Math.max(12, pos.left))}%`;
        }
        if (text !== hud.ghost) {
          tag.textContent = hud.ghost = text;
          tag.style.opacity = text ? "1" : "0";
        }
      }
    };

    let raf = 0;
    let last = performance.now();
    let slowTime = 0;
    let pausedDrawn = false;
    let padStartHeld = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const frameDt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
      last = now;

      let s = stateRef.current;

      // gamepad: merged with keyboard and touch; Start begins / pauses
      const pad = readPad();
      if (pad.start && !padStartHeld) {
        if (s.phase === "ready" || (s.phase === "over" && canRestart())) beginRef.current(modeRef.current);
        else if (s.phase === "playing") pauseGame();
        else if (s.phase === "paused") resumeGame();
        s = stateRef.current;
      }
      padStartHeld = pad.start;
      const k = keysRef.current;
      const t = touchRef.current;
      const input: Input = {
        left: k.left || t.left || pad.input.left,
        right: k.right || t.right || pad.input.right,
        jump: k.jump || t.jump || pad.input.jump,
      };

      // bullet time after big combos
      let scale = 1;
      if (slowmoRef.current > 0) {
        slowmoRef.current -= frameDt;
        scale = SLOWMO_SCALE;
      }
      const dt = frameDt * scale;

      if (s.phase === "playing") {
        accRef.current += dt;
        while (accRef.current >= STEP) {
          prevRef.current = { x: s.player.x, y: s.player.y, cam: s.cameraY };
          const tick = step(s, input);
          s = tick.state;
          stateRef.current = s;
          if (shouldSample(s.steps)) pushSample(recordingRef.current, s.player.x, s.player.y);
          if (s.steps % STEPS_PER_SECOND === 0) profileRef.current.push(s.maxFloor);
          for (const event of tick.events) handleEvent(event, s);
          accRef.current -= STEP;
          if (s.phase !== "playing") {
            accRef.current = 0;
            break;
          }
        }
        // quality governor: step down when frames stay slow
        slowTime = frameDt > SLOW_FRAME ? slowTime + frameDt : Math.max(0, slowTime - frameDt * 0.5);
        if (slowTime > 2 && scene.currentQuality > 0) {
          scene.setQuality((scene.currentQuality - 1) as Quality);
          slowTime = 0;
        }
      }

      if (s.phase === "paused") {
        if (pausedDrawn) return; // nothing moves; save the battery
        pausedDrawn = true;
      } else {
        pausedDrawn = false;
      }

      const alpha = s.phase === "playing" ? accRef.current / STEP : 1;
      const prev = prevRef.current;
      const px = prev.x + (s.player.x - prev.x) * alpha;
      const py = prev.y + (s.player.y - prev.y) * alpha;
      const cam = prev.cam + (s.cameraY - prev.cam) * alpha;

      const targetFlow = s.combo.jumps > 0 ? Math.min(1, 0.2 + s.combo.jumps * 0.13) : 0;
      flowRef.current += (targetFlow - flowRef.current) * (1 - Math.exp(-4 * frameDt));
      const danger =
        s.phase === "playing" && s.scrolling ? clamp01(1 - (s.player.y - s.cameraY) / (VIEW_H * 0.26)) : 0;

      const ghostRun = ghostRef.current;
      const ghost = ghostRun && s.phase !== "ready" ? ghostPoseAt(ghostRun.samples, s.steps) : null;
      if (ghostRun && !ghostPassedRef.current && s.phase === "playing" && s.maxFloor > ghostRun.floor) {
        ghostPassedRef.current = true;
        audio.ghostPassed();
        pushToast({ kind: "note", title: "Ghost passed", sub: `you beat today's best of floor ${ghostRun.floor}` });
      }

      audio.setMood({
        level: s.level,
        comboJumps: s.combo.jumps,
        stratum: s.stratum,
        altitude: clamp01(s.maxFloor / 300),
      });

      scene.render({
        dt: s.phase === "paused" ? 0 : dt,
        state: s,
        px,
        py,
        cameraY: cam,
        ghost,
        flow: flowRef.current,
        danger,
        reduceMotion: reduceRef.current,
      });
      updateHud(s, ghost && !ghost.done ? ghost.y : null, ghost?.x ?? 0);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      media.removeEventListener("change", onMedia);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", releaseAll);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      audio.dispose();
      scene.dispose();
    };
  }, [audio, failed, pushToast]);

  const begin = useCallback(
    (nextMode: Mode) => {
      const date = todayKey();
      const seed = nextMode === "daily" ? dailySeed(date) : (Math.random() * 2 ** 32) >>> 0;
      modeRef.current = nextMode;
      dateRef.current = date;
      ghostRef.current = nextMode === "daily" ? loadDailyBest(date) : null;
      ghostPassedRef.current = false;
      recordingRef.current = [];
      pushSample(recordingRef.current, FIELD_W / 2, 0);
      profileRef.current = [0];
      const state = startRun(seed);
      stateRef.current = state;
      prevRef.current = { x: state.player.x, y: state.player.y, cam: state.cameraY };
      accRef.current = 0;
      flowRef.current = 0;
      slowmoRef.current = 0;
      setMode(nextMode);
      setResult(null);
      setToasts([]);
      setPhase("playing");
      setAnnouncement("");
      audio.resetMusic();
      audio.setMood({ level: 0, comboJumps: 0, stratum: 0, altitude: 0 });
      audio.startMusic();
      wrapRef.current?.focus({ preventScroll: true });
    },
    [audio],
  );
  useEffect(() => {
    beginRef.current = begin;
  }, [begin]);

  const toggleMute = useCallback(() => {
    audio.setMuted(!audio.muted);
    setMuted(audio.muted);
    if (!audio.muted && stateRef.current.phase === "playing") audio.startMusic();
  }, [audio]);
  useEffect(() => {
    toggleMuteRef.current = toggleMute;
  }, [toggleMute]);

  const resumeFromOverlay = () => {
    stateRef.current = resume(stateRef.current);
    audio.startMusic();
    setPhase("playing");
    wrapRef.current?.focus({ preventScroll: true });
  };

  const pauseFromButton = () => {
    if (stateRef.current.phase !== "playing") return;
    stateRef.current = pause(stateRef.current);
    audio.stopMusic();
    setPhase("paused");
  };

  const setTouch = (action: keyof Input, down: boolean, event: React.PointerEvent) => {
    event.preventDefault();
    if (down) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // the pointer is already gone — the press still counts
      }
    }
    touchRef.current = { ...touchRef.current, [action]: down };
  };

  const share = async () => {
    if (!result) return;
    const where = `${window.location.origin}/play/icy-tower`;
    const heading =
      result.mode === "daily" ? `🧊 Icy Tower: Aurora — Daily #${result.daily}` : "🧊 Icy Tower: Aurora";
    const text = `${heading}\nfloor ${result.floor} · ${fmt(result.score)} pts · best combo ${result.bestCombo} floors\n${where}`;
    try {
      if (navigator.share && touchUi) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // share sheet dismissed
      setShared("failed");
    }
  };

  if (failed) {
    return (
      <div className="flex h-[min(80svh,780px)] w-full flex-col items-center justify-center gap-4 rounded-xl border border-line bg-surface p-6 text-center">
        <h2 className="text-2xl font-semibold">The tower needs WebGL</h2>
        <p className="max-w-md text-sm text-muted">
          Your browser couldn&apos;t start WebGL, which this game renders with.
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

  const playing = phase === "playing";
  const inRun = phase === "playing" || phase === "paused";

  return (
    <div
      ref={wrapRef}
      tabIndex={-1}
      onPointerDown={(event) => {
        if (event.pointerType === "touch" && !touchUi) setTouchUi(true);
      }}
      className="flex h-[min(80svh,780px)] min-h-[460px] w-full select-none flex-col overflow-hidden rounded-xl border border-line bg-[#040814] outline-none"
    >
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div ref={stageRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />

        {/* HUD */}
        <div
          className={`pointer-events-none absolute inset-0 font-mono text-white transition-opacity duration-300 ${
            inRun ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="absolute left-4 top-3 drop-shadow-[0_0_10px_rgba(0,0,0,0.6)]">
            <div className="text-[10px] tracking-[0.3em] text-white/55">FLOOR</div>
            <span
              ref={floorRef}
              className="block text-4xl font-semibold leading-none tabular-nums [text-shadow:0_0_18px_rgba(120,240,255,0.75)]"
            >
              0
            </span>
            <div className="mt-1 text-xs tabular-nums text-white/75">
              <span ref={scoreRef}>0</span> pts
            </div>
          </div>

          <div
            ref={comboBoxRef}
            className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center opacity-0 transition-opacity duration-200"
          >
            <div className="text-[10px] tracking-[0.35em] text-[#9ffcff]">COMBO</div>
            <div className="text-3xl font-semibold leading-none tabular-nums [text-shadow:0_0_20px_rgba(160,255,240,0.9)]">
              <span ref={comboFloorsRef}>0</span>
              <span className="ml-1 text-base text-white/70">floors</span>
            </div>
            <span ref={comboJumpsRef} className="mt-0.5 text-[11px] text-white/70" />
            <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-white/15">
              <div
                ref={comboBarRef}
                className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#5dffc3] to-[#ff4fd8]"
              />
            </div>
          </div>

          <div className="absolute right-4 top-3 flex flex-col items-end gap-1">
            <svg viewBox="0 0 40 40" className="h-11 w-11 drop-shadow-[0_0_8px_rgba(120,240,255,0.5)]" aria-hidden>
              <circle cx="20" cy="20" r="17" fill="rgba(4,8,20,0.55)" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
              <circle
                ref={clockArcRef}
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke="#ff4f8b"
                strokeWidth="2.5"
                pathLength={100}
                strokeDasharray="100"
                strokeDashoffset="100"
                transform="rotate(-90 20 20)"
              />
              <line
                ref={clockHandRef}
                x1="20"
                y1="20"
                x2="20"
                y2="7"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ transformOrigin: "20px 20px" }}
              />
            </svg>
            <span ref={clockLabelRef} className="text-[10px] uppercase tracking-widest text-white/60" />
          </div>

          <div
            ref={ghostTagRef}
            className="absolute -translate-x-1/2 rounded-full border border-[#7ff3ff]/40 bg-[#040814]/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#9ffcff] opacity-0"
          />
        </div>

        {/* toasts */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden font-mono text-white">
          {toasts.map((t) =>
            t.kind === "banner" ? (
              <div
                key={t.id}
                className="icy-banner absolute left-1/2 top-[38%] w-full -translate-x-1/2 -translate-y-1/2 text-center"
              >
                <div className="text-[11px] uppercase tracking-[0.5em] text-white/60">entering</div>
                <div className="text-3xl font-semibold uppercase tracking-[0.25em] [text-shadow:0_0_24px_rgba(160,255,240,0.9)] sm:text-4xl">
                  {t.title}
                </div>
                <div className="mt-1 text-xs text-white/70">{t.sub}</div>
              </div>
            ) : (
              <div
                key={t.id}
                className={`icy-pop absolute left-1/2 text-center ${
                  t.kind === "combo" ? "top-[30%]" : t.kind === "hurry" ? "top-[52%]" : "top-[22%]"
                }`}
              >
                <div
                  className={`whitespace-nowrap font-semibold uppercase ${
                    t.kind === "combo"
                      ? "bg-gradient-to-b from-white via-[#b7fff2] to-[#ff7ae0] bg-clip-text text-4xl tracking-wider text-transparent [filter:drop-shadow(0_0_16px_rgba(140,255,230,0.8))] sm:text-6xl"
                      : t.kind === "hurry"
                        ? "text-3xl tracking-[0.2em] text-[#ff5f8f] [text-shadow:0_0_20px_rgba(255,60,120,0.9)]"
                        : "text-lg tracking-[0.2em] text-[#9ffcff]"
                  }`}
                >
                  {t.title}
                </div>
                {t.sub && <div className="mt-1 whitespace-nowrap text-xs text-white/75">{t.sub}</div>}
              </div>
            ),
          )}
        </div>

        {/* sound + pause (the touch bar carries its own) */}
        {!touchUi && (
          <div className="absolute bottom-3 right-3 z-10 flex gap-2">
            {playing && (
              <button type="button" onClick={pauseFromButton} aria-label="Pause" className={SMALL_BUTTON}>
                ❚❚
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                toggleMute();
                event.currentTarget.blur();
              }}
              aria-pressed={!muted}
              className={SMALL_BUTTON}
            >
              {muted ? "🔇 sound off" : "🔊 sound on"}
            </button>
          </div>
        )}

        {/* overlays */}
        {phase === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#040814]/30 via-[#040814]/55 to-[#040814]/85 p-6 text-center text-white">
            <div className="font-mono text-[11px] uppercase tracking-[0.5em] text-[#9ffcff]/80">
              an icy tower remix
            </div>
            <h2 className="font-mono text-5xl font-semibold uppercase leading-none tracking-[0.12em] sm:text-6xl">
              <span className="block [text-shadow:0_0_30px_rgba(140,230,255,0.7)]">Icy Tower</span>
              <span className="mt-2 block bg-gradient-to-r from-[#5dffc3] via-[#7ff3ff] to-[#ff7ae0] bg-clip-text text-2xl tracking-[0.6em] text-transparent sm:text-3xl">
                Aurora
              </span>
            </h2>
            <p className="max-w-md text-sm text-white/75">
              Run to build speed — the faster you go, the higher you jump. Chain multi-floor jumps into combos,
              bounce off the walls, and keep ahead of the rising floor. Combos power the soundtrack.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => begin("daily")}
                className="rounded-full border border-[#7ff3ff] bg-[#7ff3ff]/15 px-6 py-2.5 font-mono text-sm text-[#d9fdff] shadow-[0_0_24px_rgba(127,243,255,0.35)] hover:bg-[#7ff3ff]/25"
              >
                Climb Daily #{daily}
              </button>
              <button
                type="button"
                onClick={() => begin("random")}
                className="rounded-full border border-white/25 px-5 py-2.5 font-mono text-sm text-white/80 hover:border-white/50 hover:text-white"
              >
                Random tower
              </button>
            </div>
            <p className="font-mono text-[11px] text-white/55">
              {todayBest
                ? `today's best: ${fmt(todayBest.score)} (floor ${todayBest.floor}) — race your ghost`
                : "set a score on today's tower and your ghost races you next time"}
              {best > 0 && ` · all-time best ${fmt(best)}`}
            </p>
            <p className="font-mono text-[11px] text-white/45">
              {touchUi
                ? "◀ ▶ run · hold JUMP to keep jumping"
                : "← → / A D run · Space / ↑ jump (hold to keep jumping) · Esc pause · M sound · gamepad works too"}
            </p>
          </div>
        )}

        {phase === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#040814]/70 p-6 text-center text-white backdrop-blur-sm">
            <h2 className="font-mono text-2xl font-semibold uppercase tracking-[0.3em]">Paused</h2>
            <button
              type="button"
              onClick={resumeFromOverlay}
              className="rounded-full border border-[#7ff3ff] bg-[#7ff3ff]/15 px-6 py-2.5 font-mono text-sm text-[#d9fdff] hover:bg-[#7ff3ff]/25"
            >
              Resume
            </button>
          </div>
        )}

        {phase === "over" && result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#040814]/60 to-[#040814]/90 p-6 text-center text-white">
            <div className="font-mono text-[11px] uppercase tracking-[0.5em] text-[#ff7aa8]">
              {result.mode === "daily" ? `daily #${result.daily}` : "random tower"} · fell at floor {result.floor}
            </div>
            <div className="font-mono text-6xl font-semibold tabular-nums [text-shadow:0_0_30px_rgba(140,230,255,0.6)]">
              {fmt(result.score)}
            </div>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 font-mono text-xs text-white/70">
              <span>floor {result.floor}</span>
              <span>best combo {result.bestCombo} floors</span>
              <span>
                {Math.floor(result.seconds / 60)}:{String(result.seconds % 60).padStart(2, "0")} climbed
              </span>
            </div>
            <ClimbChart profile={result.profile} />
            <div className="font-mono text-xs">
              {result.newBest ? (
                <span className="text-[#5dffc3]">New personal best!</span>
              ) : (
                <span className="text-white/60">personal best {fmt(result.best)}</span>
              )}
              {result.mode === "daily" && (
                <span className="text-white/60">
                  {" · "}
                  {result.newDailyBest ? "new best today — your ghost is saved" : `today's best ${fmt(result.dailyBest)}`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => begin(mode)}
                className="rounded-full border border-[#7ff3ff] bg-[#7ff3ff]/15 px-6 py-2.5 font-mono text-sm text-[#d9fdff] shadow-[0_0_24px_rgba(127,243,255,0.35)] hover:bg-[#7ff3ff]/25"
              >
                Climb again
              </button>
              <button
                type="button"
                onClick={() => begin(mode === "daily" ? "random" : "daily")}
                className="rounded-full border border-white/25 px-5 py-2.5 font-mono text-sm text-white/80 hover:border-white/50 hover:text-white"
              >
                {mode === "daily" ? "Random tower" : `Daily #${daily}`}
              </button>
              <button
                type="button"
                onClick={share}
                className="rounded-full border border-white/25 px-5 py-2.5 font-mono text-sm text-white/80 hover:border-white/50 hover:text-white"
              >
                {shared === "copied" ? "Copied!" : shared === "failed" ? "Couldn't copy" : "Share"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* touch controls live below the stage so they never cover the climb */}
      {touchUi && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-3 py-2.5">
          <div className="flex gap-2">
            {(["left", "right"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                aria-label={dir === "left" ? "Run left" : "Run right"}
                disabled={!playing}
                onPointerDown={(event) => setTouch(dir, true, event)}
                onPointerUp={(event) => setTouch(dir, false, event)}
                onPointerCancel={(event) => setTouch(dir, false, event)}
                onLostPointerCapture={(event) => setTouch(dir, false, event)}
                onContextMenu={(event) => event.preventDefault()}
                className="flex h-16 w-16 touch-none items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl text-white active:bg-white/25 disabled:opacity-30"
              >
                {dir === "left" ? "◀" : "▶"}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={pauseFromButton}
              disabled={!playing}
              aria-label="Pause"
              className={`${SMALL_BUTTON} disabled:opacity-30`}
            >
              ❚❚
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={!muted}
              aria-label={muted ? "Sound off" : "Sound on"}
              className={SMALL_BUTTON}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
          <button
            type="button"
            aria-label="Jump"
            disabled={!playing}
            onPointerDown={(event) => setTouch("jump", true, event)}
            onPointerUp={(event) => setTouch("jump", false, event)}
            onPointerCancel={(event) => setTouch("jump", false, event)}
            onLostPointerCapture={(event) => setTouch("jump", false, event)}
            onContextMenu={(event) => event.preventDefault()}
            className="flex h-16 w-24 touch-none items-center justify-center rounded-full border border-[#7ff3ff]/50 bg-[#7ff3ff]/15 font-mono text-xs font-semibold tracking-widest text-[#bffcff] active:bg-[#7ff3ff]/35 disabled:opacity-30"
          >
            JUMP
          </button>
        </div>
      )}
    </div>
  );
}

/** Altitude over time — a quick read of where the run flew and where it stalled. */
function ClimbChart({ profile }: { profile: number[] }) {
  if (profile.length < 3) return null;
  const w = 280;
  const h = 64;
  const top = Math.max(10, ...profile);
  const points = profile
    .map((floor, i) => `${((i / (profile.length - 1)) * w).toFixed(1)},${(h - (floor / top) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-72 max-w-full" role="img" aria-label="Floors climbed over time">
      <defs>
        <linearGradient id="climb-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ff3ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7ff3ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#climb-fill)" />
      <polyline points={points} fill="none" stroke="#7ff3ff" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
