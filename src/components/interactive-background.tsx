"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { animate, utils } from "animejs";

/**
 * ARGUS — interactive background.
 *
 * An analytics-themed node-and-circuit network rendered with three.js and
 * choreographed with anime.js. Nodes sit on a jittered grid, wired together
 * with orthogonal "circuit traces"; faint data pulses flow along the wires,
 * and the circuitry brightens around the cursor. Restrained on purpose — thin
 * lines, normal (non-additive) blending, and a soft fade at the screen edges
 * so it reads as a backdrop, never a distraction.
 *
 * It lives in a fixed, full-screen canvas pinned behind everything with
 * `pointer-events:none`, so every click, hover and scroll passes straight
 * through to the real UI. Pointer/touch are read from passive window
 * listeners, never captured.
 *
 * Honours `prefers-reduced-motion`: renders a single static frame and stops.
 */

// Brand palette (mirrors globals.css @theme).
const GOLD = new THREE.Color("#e6b450");
const TEAL = new THREE.Color("#43d39e");

// Orthographic view + generous network extent (covers any viewport).
const VIEW_H = 18; // world units of vertical view
const EXT_X = 28;
const EXT_Y = 17;
const STEP = 2.3; // grid spacing
const JIT = 0.7; // grid jitter
const PROX_R = 4.5; // cursor highlight radius (world units) — ~2× the lit area of 3.2

// ── Shared GLSL helpers ─────────────────────────────────────────
const VIGNETTE = /* glsl */ `
  float edgeFade(vec2 ndc) {
    vec2 f = 1.0 - smoothstep(vec2(0.62), vec2(1.04), abs(ndc));
    return f.x * f.y;
  }
`;

// Lines (circuit traces) ------------------------------------------------------
const LINE_VERT = /* glsl */ `
  attribute vec3 aColor;
  uniform vec2 uPointer;
  varying vec3 vColor;
  varying vec2 vNdc;
  varying float vProx;
  void main() {
    vColor = aColor;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vNdc = clip.xy / clip.w;
    vProx = 1.0 - smoothstep(0.0, ${PROX_R.toFixed(1)}, distance(position.xy, uPointer));
    gl_Position = clip;
  }
`;
const LINE_FRAG = /* glsl */ `
  precision mediump float;
  ${VIGNETTE}
  uniform float uOpacity;
  varying vec3 vColor;
  varying vec2 vNdc;
  varying float vProx;
  void main() {
    float a = (0.12 + vProx * 0.5) * edgeFade(vNdc) * uOpacity;
    if (a < 0.004) discard;
    vec3 col = vColor + vProx * 0.35;
    gl_FragColor = vec4(col, a);
  }
`;

// Nodes -----------------------------------------------------------------------
const NODE_VERT = /* glsl */ `
  attribute float aScale;
  attribute vec3 aColor;
  uniform vec2 uPointer;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying vec2 vNdc;
  varying float vProx;
  void main() {
    vColor = aColor;
    vProx = 1.0 - smoothstep(0.0, ${PROX_R.toFixed(1)}, distance(position.xy, uPointer));
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vNdc = clip.xy / clip.w;
    gl_PointSize = aScale * (1.0 + vProx * 1.8) * uPixelRatio;
    gl_Position = clip;
  }
`;
const NODE_FRAG = /* glsl */ `
  precision mediump float;
  ${VIGNETTE}
  uniform float uOpacity;
  varying vec3 vColor;
  varying vec2 vNdc;
  varying float vProx;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float disc = smoothstep(0.5, 0.32, r);     // crisp filled dot
    float ring = smoothstep(0.5, 0.46, r) * 0.5;
    float a = (disc * (0.32 + vProx * 0.55) + ring * vProx) * edgeFade(vNdc) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor + vProx * 0.4, a);
  }
`;

// Data pulses (travelling dots) ----------------------------------------------
const PULSE_VERT = /* glsl */ `
  attribute float aScale;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying vec2 vNdc;
  void main() {
    vColor = aColor;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vNdc = clip.xy / clip.w;
    gl_PointSize = aScale * uPixelRatio;
    gl_Position = clip;
  }
`;
const PULSE_FRAG = /* glsl */ `
  precision mediump float;
  ${VIGNETTE}
  uniform float uOpacity;
  varying vec3 vColor;
  varying vec2 vNdc;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float core = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColor, core * 0.9 * edgeFade(vNdc) * uOpacity);
  }
`;

type Trace = { pts: [THREE.Vector2, THREE.Vector2, THREE.Vector2]; color: THREE.Color };

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.z = 10;

    // ── Build the network (nodes + orthogonal circuit traces) ─────
    type Node = { x: number; y: number; color: THREE.Color; scale: number };
    const cols = Math.ceil((EXT_X * 2) / STEP);
    const rows = Math.ceil((EXT_Y * 2) / STEP);
    const grid: (Node | null)[][] = [];

    const pick = (tealChance: number) => {
      const base = Math.random() < tealChance ? TEAL : GOLD;
      // Dim toward ink so the default state is calm.
      return base.clone().multiplyScalar(0.5 + Math.random() * 0.25);
    };

    for (let i = 0; i < cols; i++) {
      grid[i] = [];
      for (let j = 0; j < rows; j++) {
        if (Math.random() < 0.12) {
          grid[i][j] = null; // sparse gaps → irregular, circuit-like
          continue;
        }
        grid[i][j] = {
          x: -EXT_X + i * STEP + (Math.random() - 0.5) * 2 * JIT,
          y: -EXT_Y + j * STEP + (Math.random() - 0.5) * 2 * JIT,
          color: pick(0.14),
          scale: 2.2 + Math.random() * 2.6,
        };
      }
    }

    const linePos: number[] = [];
    const lineCol: number[] = [];
    const traces: Trace[] = [];

    const addTrace = (a: Node, b: Node, horizFirst: boolean) => {
      const corner = horizFirst
        ? new THREE.Vector2(b.x, a.y)
        : new THREE.Vector2(a.x, b.y);
      const A = new THREE.Vector2(a.x, a.y);
      const B = new THREE.Vector2(b.x, b.y);
      // Trace inherits a dim wire color (teal if either end is teal-ish).
      const isTeal = a.color.g > a.color.r || b.color.g > b.color.r;
      const c = (isTeal ? TEAL : GOLD).clone().multiplyScalar(0.4);
      for (const [p, q] of [
        [A, corner],
        [corner, B],
      ] as const) {
        linePos.push(p.x, p.y, 0, q.x, q.y, 0);
        lineCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      traces.push({ pts: [A, corner, B], color: (isTeal ? TEAL : GOLD).clone() });
    };

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const n = grid[i][j];
        if (!n) continue;
        const right = i + 1 < cols ? grid[i + 1][j] : null;
        const down = j + 1 < rows ? grid[i][j + 1] : null;
        if (right && Math.random() < 0.82) addTrace(n, right, (i + j) % 2 === 0);
        if (down && Math.random() < 0.82) addTrace(n, down, (i + j) % 2 === 1);
      }
    }

    // Node buffers
    const nodes = grid.flat().filter(Boolean) as Node[];
    const nPos = new Float32Array(nodes.length * 3);
    const nCol = new Float32Array(nodes.length * 3);
    const nScale = new Float32Array(nodes.length);
    nodes.forEach((n, k) => {
      nPos.set([n.x, n.y, 0], k * 3);
      nCol.set([n.color.r, n.color.g, n.color.b], k * 3);
      nScale[k] = n.scale;
    });

    const uPointer = { value: new THREE.Vector2(999, 999) };
    const uPixelRatio = { value: pixelRatio };
    const uOpacity = { value: prefersReduced ? 1 : 0 };

    // Lines mesh
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    lineGeo.setAttribute("aColor", new THREE.Float32BufferAttribute(lineCol, 3));
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { uPointer, uOpacity },
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // Nodes mesh
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(nPos, 3));
    nodeGeo.setAttribute("aColor", new THREE.BufferAttribute(nCol, 3));
    nodeGeo.setAttribute("aScale", new THREE.BufferAttribute(nScale, 1));
    const nodeMat = new THREE.ShaderMaterial({
      uniforms: { uPointer, uPixelRatio, uOpacity },
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const nodePoints = new THREE.Points(nodeGeo, nodeMat);
    scene.add(nodePoints);

    // ── Data pulses travelling along a subset of traces ───────────
    const PULSE_N = Math.min(42, traces.length);
    const pulsePos = new Float32Array(PULSE_N * 3);
    const pulseCol = new Float32Array(PULSE_N * 3);
    const pulseScale = new Float32Array(PULSE_N);
    const pulseState = Array.from({ length: PULSE_N }, () => ({ t: 0 }));
    const pulseTrace: Trace[] = [];

    const stride = Math.max(1, Math.floor(traces.length / PULSE_N));
    for (let k = 0; k < PULSE_N; k++) {
      const tr = traces[(k * stride) % traces.length];
      pulseTrace.push(tr);
      const c = tr.color;
      pulseCol.set([c.r, c.g, c.b], k * 3);
      pulseScale[k] = 3.2 + Math.random() * 1.6;
      pulsePos.set([tr.pts[0].x, tr.pts[0].y, 0.1], k * 3);
    }

    const pulseGeo = new THREE.BufferGeometry();
    const pulsePosAttr = new THREE.BufferAttribute(pulsePos, 3);
    pulseGeo.setAttribute("position", pulsePosAttr);
    pulseGeo.setAttribute("aColor", new THREE.BufferAttribute(pulseCol, 3));
    pulseGeo.setAttribute("aScale", new THREE.BufferAttribute(pulseScale, 1));
    const pulseMat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio, uOpacity },
      vertexShader: PULSE_VERT,
      fragmentShader: PULSE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // tiny dots — a gentle glow, not a wash
    });
    const pulses = new THREE.Points(pulseGeo, pulseMat);
    if (!prefersReduced) scene.add(pulses);

    // Map progress t∈[0,1] to a point along the 2-segment trace.
    const seg = new THREE.Vector2();
    const placePulse = (k: number) => {
      const { pts } = pulseTrace[k];
      const t = pulseState[k].t;
      const l1 = seg.subVectors(pts[1], pts[0]).length();
      const l2 = seg.subVectors(pts[2], pts[1]).length();
      const total = l1 + l2 || 1;
      const d = t * total;
      let x: number, y: number;
      if (d <= l1) {
        const u = l1 ? d / l1 : 0;
        x = pts[0].x + (pts[1].x - pts[0].x) * u;
        y = pts[0].y + (pts[1].y - pts[0].y) * u;
      } else {
        const u = l2 ? (d - l1) / l2 : 0;
        x = pts[1].x + (pts[2].x - pts[1].x) * u;
        y = pts[1].y + (pts[2].y - pts[1].y) * u;
      }
      pulsePos[k * 3] = x;
      pulsePos[k * 3 + 1] = y;
    };

    if (!prefersReduced) {
      pulseState.forEach((s) =>
        animate(s, {
          t: [0, 1],
          duration: 3200 + Math.random() * 3200,
          delay: Math.random() * 3000,
          loop: true,
          ease: "linear",
        }),
      );
    }

    // ── Sizing (orthographic frustum tracks the viewport) ─────────
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      const halfH = VIEW_H / 2;
      const halfW = halfH * aspect;
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    };
    resize();

    // ── Pointer (passive; never blocks the page) ──────────────────
    const ndc = new THREE.Vector2(0, 0);
    const targetNdc = new THREE.Vector2(0, 0);
    let pointerInside = false;

    const setFromClient = (cx: number, cy: number) => {
      targetNdc.set(
        (cx / window.innerWidth) * 2 - 1,
        -((cy / window.innerHeight) * 2 - 1),
      );
      pointerInside = true;
    };
    const onMouseMove = (e: MouseEvent) => setFromClient(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setFromClient(t.clientX, t.clientY);
    };
    const onLeave = () => {
      pointerInside = false;
    };

    if (!prefersReduced) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("mouseout", onLeave, { passive: true });
    }
    window.addEventListener("resize", resize);

    // Entrance fade-in (anime.js).
    const intro = { v: prefersReduced ? 1 : 0 };
    if (!prefersReduced) {
      animate(intro, { v: 1, duration: 1400, ease: "outCubic" });
    }

    // ── Render loop ───────────────────────────────────────────────
    let raf = 0;
    let running = true;
    const pointerWorld = new THREE.Vector2(999, 999);

    const renderFrame = () => {
      ndc.lerp(targetNdc, 0.08);

      // Subtle parallax so the board reacts; the page never moves.
      camera.position.x += (ndc.x * 0.8 - camera.position.x) * 0.05;
      camera.position.y += (ndc.y * 0.5 - camera.position.y) * 0.05;

      // Pointer → world coords for the highlight (or park it far away).
      if (pointerInside) {
        const halfH = VIEW_H / 2;
        const halfW = halfH * (window.innerWidth / window.innerHeight);
        pointerWorld.set(
          ndc.x * halfW + camera.position.x,
          ndc.y * halfH + camera.position.y,
        );
      } else {
        pointerWorld.set(9999, 9999);
      }
      uPointer.value.copy(pointerWorld);

      // Advance pulses from their anime.js-driven progress.
      for (let k = 0; k < PULSE_N; k++) placePulse(k);
      pulsePosAttr.needsUpdate = true;

      uOpacity.value = intro.v;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(renderFrame);
    };

    if (prefersReduced) {
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(renderFrame);
    }

    // Pause when the tab is hidden.
    const onVisibility = () => {
      if (document.hidden && running) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!document.hidden && !running && !prefersReduced) {
        running = true;
        raf = requestAnimationFrame(renderFrame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ── Teardown ──────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      pulseState.forEach((s) => utils.remove(s));
      utils.remove(intro);
      lineGeo.dispose();
      lineMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
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
