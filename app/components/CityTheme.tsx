import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCityAnimation } from "../lib/useCityAnimation";
import { CityChrome } from "./CityChrome";
import "../city.css";

export default function CityTheme({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clockStr, setClockStr] = useState("--:--:--");
  const [humStr, setHumStr] = useState("— dB");
  const mouseRef = useRef({ x: 0, y: 0 });

  useBodyClass("city-page");
  useMouseParallax(mouseRef);
  useTouchParallax(mouseRef);

  useCityAnimation({
    canvasRef: canvasRef,
    city: {
      fog: 0.015,
      initialCameraPos: [0, 14, 50],
      initialCameraLook: [0, 6, 0],
    },
    updateCamera: (camera, t) => {
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      camera.position.set(
        Math.sin(t * 0.12) * 6 + mx * 1.5,
        8 + Math.sin(t * 0.18) * 1.5 + my * 0.5,
        40 + Math.cos(t * 0.09) * 8);
      camera.lookAt(Math.sin(t * 0.1) * 3, 5, Math.cos(t * 0.07) * 3);
    },
    onTick: (t, _dt, time) => {
      setClockStr(`${String(Math.floor(6 + time * 18)).padStart(2, "0")}:${String(Math.floor((time * 18 * 60) % 60)).padStart(2, "0")}:${String(Math.floor(t * 60) % 60).padStart(2, "0")}`);
      setHumStr(`${(38 + Math.sin(t * 0.5) * 3 + Math.random() * 0.5).toFixed(1)} dB`);
    },
  });

  return (
    <>
      <canvas ref={canvasRef} className="city-canvas" />
      <CityChrome clockStr={clockStr} humStr={humStr}>{children}</CityChrome>
    </>
  );
}

function useBodyClass(cls: string) {
  useEffect(() => {
    document.body.classList.add(cls);
    return () => document.body.classList.remove(cls);
  }, [cls]);
}
function useMouseParallax(ref: React.MutableRefObject<{ x: number; y: number }>) {
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      ref.current.x = e.clientX / window.innerWidth - 0.5;
      ref.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMouse);
    return () => window.removeEventListener("mousemove", onMouse);
  }, [ref]);
}
function useTouchParallax(ref: React.MutableRefObject<{ x: number; y: number }>) {
  useEffect(() => {
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        ref.current.x = e.touches[0].clientX / window.innerWidth - 0.5;
        ref.current.y = e.touches[0].clientY / window.innerHeight - 0.5;
      }
    };
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => window.removeEventListener("touchmove", onTouch);
  }, [ref]);
}
