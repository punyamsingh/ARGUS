"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { animate, utils } from "animejs";

/**
 * ARGUS — interactive background.
 *
 * A three.js particle field ("a thousand watching eyes") that drifts with the
 * cursor and ripples on click, choreographed with anime.js. It lives in a
 * fixed, full-screen canvas pinned behind everything with `pointer-events:none`
 * so it is purely decorative — every click, hover and scroll passes straight
 * through to the real UI. Mouse/touch are read from passive window listeners,
 * never by capturing events, so the foreground is never interrupted.
 *
 * Honours `prefers-reduced-motion`: renders a single static frame and stops.
 */

// Brand palette (mirrors globals.css @theme).
const GOLD = new THREE.Color("#e6b450");
const SIGNAL = new THREE.Color("#43d39e");
const INK = new THREE.Color("#0a0b0e");

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;     // normalised pointer in clip space (-1..1)
  uniform float uRipple;     // 0..1 click ripple progress
  uniform float uPixelRatio;

  attribute float aScale;
  attribute float aSeed;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vGlow;

  void main() {
    vColor = aColor;
    vec3 pos = position;

    // Gentle organic drift.
    float t = uTime * 0.18;
    pos.x += sin(t + aSeed * 6.2831) * 0.18;
    pos.y += cos(t * 0.9 + aSeed * 6.2831) * 0.18;
    pos.z += sin(t * 0.7 + aSeed * 3.14159) * 0.25;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Pointer proximity in clip-ish space — brighten + lift nearby points.
    vec2 screen = pos.xy * 0.14;
    float d = distance(screen, uPointer * 1.6);
    float prox = smoothstep(1.4, 0.0, d);

    // Expanding ripple ring from the pointer on click.
    float ring = 1.0 - smoothstep(0.0, 0.35, abs(d - uRipple * 2.4));
    ring *= (1.0 - uRipple);

    float lift = prox * 0.5 + ring * 0.8;
    mvPosition.z += lift;

    vGlow = clamp(prox + ring * 1.2, 0.0, 1.6);

    gl_Position = projectionMatrix * mvPosition;

    float size = aScale * (1.0 + lift * 1.6);
    gl_PointSize = size * uPixelRatio * (220.0 / -mvPosition.z);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    // Soft round sprite with a brighter core — an "iris".
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    float core = smoothstep(0.5, 0.0, r);
    float halo = smoothstep(0.5, 0.12, r) * 0.6;
    float alpha = core * 0.9 + halo;
    if (alpha < 0.01) discard;

    vec3 col = vColor + vGlow * 0.6;
    gl_FragColor = vec4(col, alpha * (0.55 + vGlow * 0.45));
  }
`;

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setClearColor(INK, 0); // transparent — CSS background shows through
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 18);

    // ── Build the particle field ──────────────────────────────────
    const COUNT = 1400;
    const positions = new Float32Array(COUNT * 3);
    const scales = new Float32Array(COUNT);
    const seeds = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);

    const tmp = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      // Distribute across a wide, shallow slab facing the camera.
      positions[i * 3 + 0] = (Math.random() - 0.5) * 46;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 28;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;

      scales[i] = 0.6 + Math.random() * 1.8;
      seeds[i] = Math.random();

      // Mostly gold, a sparse scatter of signal-teal.
      tmp.copy(Math.random() > 0.88 ? SIGNAL : GOLD);
      tmp.lerp(INK, Math.random() * 0.35);
      colors[i * 3 + 0] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const uniforms = {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uRipple: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ── Sizing ────────────────────────────────────────────────────
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    // ── Pointer (read passively; never blocks the page) ───────────
    const pointer = new THREE.Vector2(0, 0);
    const targetPointer = new THREE.Vector2(0, 0);

    const setFromClient = (clientX: number, clientY: number) => {
      targetPointer.set(
        (clientX / window.innerWidth) * 2 - 1,
        -((clientY / window.innerHeight) * 2 - 1),
      );
    };
    const onMouseMove = (e: MouseEvent) => setFromClient(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setFromClient(t.clientX, t.clientY);
    };

    // Click anywhere → a ripple emanates from the pointer (anime.js).
    let rippleAnim: ReturnType<typeof animate> | null = null;
    const onPointerDown = (e: MouseEvent) => {
      setFromClient(e.clientX, e.clientY);
      pointer.copy(targetPointer); // snap so the ring starts at the click
      uniforms.uRipple.value = 0;
      rippleAnim?.pause();
      rippleAnim = animate(uniforms.uRipple, {
        value: 1,
        duration: 1100,
        ease: "outQuad",
      });
    };

    if (!prefersReduced) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
    }
    window.addEventListener("resize", resize);

    // ── Entrance: ease the field in with anime.js ─────────────────
    const intro = { v: prefersReduced ? 1 : 0 };
    if (!prefersReduced) {
      points.scale.setScalar(0.6);
      animate(intro, {
        v: 1,
        duration: 1600,
        ease: "outCubic",
        onUpdate: () => {
          points.scale.setScalar(0.6 + intro.v * 0.4);
          material.opacity = intro.v;
        },
      });
    }

    // ── Render loop ───────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;

    const renderFrame = () => {
      uniforms.uTime.value = clock.getElapsedTime();

      // Smoothly chase the pointer for parallax + uniform.
      pointer.lerp(targetPointer, 0.06);
      uniforms.uPointer.value.copy(pointer);

      // Subtle camera parallax — the field reacts, the page does not.
      camera.position.x += (pointer.x * 2.2 - camera.position.x) * 0.04;
      camera.position.y += (pointer.y * 1.4 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      points.rotation.z = clock.getElapsedTime() * 0.008;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(renderFrame);
    };

    if (prefersReduced) {
      // Single static frame, then idle.
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(renderFrame);
    }

    // Pause when the tab is hidden to save the user's battery/CPU.
    const onVisibility = () => {
      if (document.hidden) {
        if (running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      } else if (!running && !prefersReduced) {
        running = true;
        clock.start();
        raf = requestAnimationFrame(renderFrame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ── Teardown ──────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      rippleAnim?.pause();
      utils.remove(intro);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
