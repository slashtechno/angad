import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { createCity, tickCity, disposeCity, type CityHandles } from "./cityScene";

export interface CityAnimationOptions {
  /** Ref to the canvas element. The hook resolves it after mount. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Per-frame camera controller. Receives (camera, t, dt) and sets position/lookAt. */
  updateCamera: (camera: THREE.PerspectiveCamera, t: number, dt: number) => void;
  /** Called once per frame after the camera is set; use for string updates, etc. */
  onTick?: (t: number, dt: number, time: number, handles?: CityHandles) => void;
  /**
   * If provided, overrides the auto-cycling time. Value is 0..1 where 0 = midnight,
   * 0.5 = noon, 1 = midnight again. Lets the settings panel control time of day.
   */
  controlledTime?: number;
  /** If false, traffic lights don't cycle (freeze on current color). Default true. */
  trafficEnabled?: boolean;
  /** Multiplier for car speed. 0 = frozen, 1 = normal, 2 = sped up. Default 1. */
  trafficSpeed?: number;
  /** City scene options. `adaptiveQuality: true` (default) auto-tunes quality on mount, resize, and runtime FPS dips. */
  city?: {
    fog?: number;
    initialCameraPos?: [number, number, number];
    initialCameraLook?: [number, number, number];
    pixelRatio?: number;
    antialias?: boolean;
    shadowsEnabled?: boolean;
    shadowMapSize?: number;
    adaptiveQuality?: boolean;
  };
  /** Re-tune quality on resize. Optional. */
  onResize?: (handles: CityHandles, w: number, h: number) => void;
}

export type QualityTier = 0 | 1 | 2 | 3;

/**
 * Owns the city scene lifecycle: create, animation loop, dispose.
 * Caller provides the per-frame camera controller and any extra per-frame work.
 * With `adaptiveQuality: true` (default), pixel ratio / antialias / shadow map size
 * are tuned to window width at mount, on resize, AND demoted if runtime FPS
 * drops below 30 for a sustained window.
 *
 * Returns the current quality tier (0 = full, 1/2/3 = demoted levels) so callers
 * can show a UI hint that effects have been reduced.
 */
export function useCityAnimation(opts: CityAnimationOptions): { tier: QualityTier } {
  const optsRef = useOptsRef(opts);
  const [tier, setTier] = useState<QualityTier>(0);

  useEffect(() => {
    const canvas = opts.canvasRef.current;
    if (!canvas) return;
    const adaptive = opts.city?.adaptiveQuality !== false;
    let quality = adaptive ? pickQuality() : null;
    setTier((quality?.tier ?? 0) as QualityTier);

    // Resolve city options once; the props object is recreated on every render
    // and would otherwise tear down + recreate the scene every frame.
    const city = opts.city;
    const handles = createCity({
      canvas,
      fog: city?.fog,
      initialCameraPos: city?.initialCameraPos,
      initialCameraLook: city?.initialCameraLook,
      pixelRatio: quality?.pixelRatio ?? city?.pixelRatio,
      antialias: quality?.antialias ?? city?.antialias,
      shadowsEnabled: quality?.shadowsEnabled ?? city?.shadowsEnabled,
      shadowMapSize: quality?.shadowMapSize ?? city?.shadowMapSize,
    });

    const clock = new THREE.Clock();
    let trafficPhase = 0;
    let animId = 0;

    // ── Adaptive FPS guard ─────────────────────
    // Track frames per second over a sliding 2-second window. If it stays
    // below the threshold for 3 consecutive windows AND we've been running
    // for at least 6 seconds (skip Vite/React cold start), demote quality
    // one level. Don't promote back up — once a scene can't sustain a
    // tier, it can't.
    const fpsWindow: number[] = [];
    const FPS_CHECK_INTERVAL_MS = 2000;
    const FPS_THRESHOLD = 30;
    const WARMUP_MS = 6000;
    const CONSECUTIVE_DEMOTIONS_REQUIRED = 3;
    let lastFpsCheck = performance.now();
    let consecutiveLowFps = 0;
    const startTime = performance.now();

    const tick = () => {
      animId = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.getElapsedTime();
      // Traffic phase only advances when traffic is enabled
      const trafficOn = optsRef.current.trafficEnabled !== false;
      const trafficMult = optsRef.current.trafficSpeed ?? 1;
      if (trafficOn) trafficPhase += dt * trafficMult;

      // FPS sampling
      const now = performance.now();
      fpsWindow.push(now);
      while (fpsWindow.length > 0 && now - fpsWindow[0] > FPS_CHECK_INTERVAL_MS) fpsWindow.shift();
      if (adaptive && quality && now - lastFpsCheck > FPS_CHECK_INTERVAL_MS && fpsWindow.length > 0) {
        const fps = (fpsWindow.length - 1) / ((now - fpsWindow[0]) / 1000);
        lastFpsCheck = now;
        const warmedUp = now - startTime > WARMUP_MS;
        if (warmedUp && fps < FPS_THRESHOLD) {
          consecutiveLowFps++;
          if (consecutiveLowFps >= CONSECUTIVE_DEMOTIONS_REQUIRED && quality.tier < 3) {
            quality = demote(quality);
            applyQuality(handles, quality);
            setTier(quality.tier as QualityTier);
            consecutiveLowFps = 0;
          }
        } else {
          consecutiveLowFps = 0;
        }
      }

      // Time of day: use controlledTime if provided, otherwise auto-cycle slowly
      const time = optsRef.current.controlledTime ?? (t * 0.008) % 1;
      tickCity(handles, t, dt, trafficPhase, time, trafficOn);

      optsRef.current.updateCamera(handles.camera, t, dt);
      optsRef.current.onTick?.(t, dt, time, handles);

      handles.renderer.render(handles.scene, handles.camera);
    };
    tick();

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      handles.camera.aspect = w / h;
      handles.camera.updateProjectionMatrix();
      handles.renderer.setSize(w, h);
      if (adaptive) {
        quality = pickQuality(); // user resized → reset to window-appropriate tier
        applyQuality(handles, quality);
        setTier(quality.tier as QualityTier);
      }
      optsRef.current.onResize?.(handles, w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      disposeCity(handles);
    };
    // ponytail: deps are canvas ref + canvas size flags; city options & callbacks
    // are read from optsRef so the scene is only created once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.canvasRef]);

  return { tier };
}

function useOptsRef<T>(opts: T): { current: T } {
  const ref = useRef(opts);
  ref.current = opts;
  return ref;
}

interface Quality {
  pixelRatio: number;
  antialias: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  /** 0 = full, 1 = no shadows, 2 = also no antialias + pixel ratio floor 1, 3 = also no shadow map (final). */
  tier: number;
}

function pickQuality(): Quality {
  const w = window.innerWidth;
  const isVeryLarge = w > 1600;
  const isLarge = w > 1400;
  // ponytail: start at full quality and let the runtime FPS guard demote if needed.
  // Pixel ratio is still capped (huge windows would otherwise render at 4x the pixels).
  // The previous version eagerly set tier=1 for >1400px, which falsely flagged
  // capable hardware like the M4 MacBook. Runtime detection is the source of truth.
  return {
    tier: 0,
    pixelRatio: isLarge ? 1 : Math.min(devicePixelRatio, 1.5),
    antialias: !isVeryLarge, // skip MSAA on huge windows; FPS guard will demote further if needed
    shadowsEnabled: !isVeryLarge,
    shadowMapSize: 1024,
  };
}

function demote(q: Quality): Quality {
  if (q.tier >= 3) return q; // already at floor
  const next: Quality = { ...q, tier: q.tier + 1 };
  if (next.tier === 1) { next.shadowsEnabled = false; next.shadowMapSize = 512; }
  if (next.tier === 2) { next.antialias = false; next.pixelRatio = 1; }
  if (next.tier === 3) { next.shadowMapSize = 256; } // smallest meaningful shadow map
  return next;
}

function applyQuality(handles: CityHandles, q: Quality) {
  handles.renderer.setPixelRatio(q.pixelRatio);
  handles.renderer.shadowMap.enabled = q.shadowsEnabled;
  if (q.shadowMapSize > 0) {
    const s = handles.sun.shadow;
    if (s.mapSize.x !== q.shadowMapSize) s.mapSize.set(q.shadowMapSize, q.shadowMapSize);
  }
  // antialias is immutable post-construction; re-enabling requires recreating the renderer.
  // ponytail: recreate the renderer if we need to enable antialias after a demotion. Skipped — antialias only ever goes off via demotion, never back on.
}
