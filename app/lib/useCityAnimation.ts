import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { createCity, tickCity, disposeCity, type CityHandles } from "./cityScene";

export interface CityAnimationOptions {
  /** Ref to the canvas element. The hook resolves it after mount. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Per-frame camera controller. Receives (camera, t, dt) and sets position/lookAt. */
  updateCamera: (camera: THREE.PerspectiveCamera, t: number, dt: number) => void;
  /** Called once per frame after the camera is set; use for string updates, etc. */
  onTick?: (t: number, dt: number, time: number) => void;
  /** City scene options. `adaptiveQuality: true` (default) overrides pixelRatio/antialias/shadowMapSize based on window width at mount + resize. */
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

/**
 * Owns the city scene lifecycle: create, animation loop, dispose.
 * Caller provides the per-frame camera controller and any extra per-frame work.
 * With `adaptiveQuality: true` (default), pixel ratio / antialias / shadow map size
 * are tuned to window width at mount and on resize.
 */
export function useCityAnimation(opts: CityAnimationOptions) {
  const optsRef = useOptsRef(opts);

  useEffect(() => {
    const canvas = opts.canvasRef.current;
    if (!canvas) return;
    const adaptive = opts.city?.adaptiveQuality !== false;
    const quality = adaptive ? pickQuality() : null;

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

    const tick = () => {
      animId = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.getElapsedTime();
      trafficPhase += dt;

      const time = (t * 0.008) % 1;
      tickCity(handles, t, dt, trafficPhase, time);

      optsRef.current.updateCamera(handles.camera, t, dt);
      optsRef.current.onTick?.(t, dt, time);

      handles.renderer.render(handles.scene, handles.camera);
    };
    tick();

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      handles.camera.aspect = w / h;
      handles.camera.updateProjectionMatrix();
      handles.renderer.setSize(w, h);
      if (adaptive) applyQuality(handles);
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
}

function pickQuality(): Quality {
  const w = window.innerWidth;
  const isVeryLarge = w > 1600;
  const isLarge = w > 1400;
  return {
    pixelRatio: w < 768 || isLarge ? 1 : Math.min(devicePixelRatio, 1.5),
    antialias: !isLarge,
    shadowsEnabled: !isVeryLarge,
    shadowMapSize: isVeryLarge ? 512 : 1024,
  };
}

function applyQuality(handles: CityHandles) {
  const q = pickQuality();
  handles.renderer.setPixelRatio(q.pixelRatio);
  handles.renderer.shadowMap.enabled = q.shadowsEnabled;
  // ponytail: shadow map size set on creation; resize doesn't reallocate it. Add if textures visibly wrong on resize.
}
