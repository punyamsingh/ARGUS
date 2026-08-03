"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { animate, utils } from "animejs";
import { getResolvedTheme, subscribeResolvedTheme, type ResolvedTheme } from "@/lib/theme";

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
 *
 * Theme-aware: the network is laid out once, but its colours, its blending and
 * the direction of the cursor highlight are all re-derived when the theme
 * flips — on a light ground the wires must darken to be seen, not brighten.
 */

// Brand palette (mirrors globals.css @theme) — one entry per theme.
const PALETTE: Record<ResolvedTheme, { gold: THREE.Color; teal: THREE.Color }> = {
  dark: { gold: new THREE.Color("#e6b450"), teal: new THREE.Color("#43d39e") },
  light: { gold: new THREE.Color("#a8761f"), teal: new THREE.Color("#12805c") },
};
const PAPER = new THREE.Color("#faf9f6"); // light-mode ground, for fading toward

/**
 * Push a colour toward the page background by `1 - f`. On dark that means
 * multiplying toward black; on light it means lerping toward the paper — the
 * same perceived "dim this wire" in both directions.
 */
function towardGround(c: THREE.Color, f: number, theme: ResolvedTheme): THREE.Color {
  return theme === "dark"
    ? c.clone().multiplyScalar(f)
    : c.clone().lerp(PAPER, (1 - f) * 0.6);
}

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
  uniform float uLift;      // +1 on dark (brighten near cursor), -1 on light
  uniform float uAlphaGain; // light needs more alpha to register on paper
  varying vec3 vColor;
  varying vec2 vNdc;
  varying float vProx;
  void main() {
    float a = (0.12 + vProx * 0.5) * uAlphaGain * edgeFade(vNdc) * uOpacity;
    if (a < 0.004) discard;
    vec3 col = vColor + uLift * vProx * 0.35;
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
  uniform float uLift;
  uniform float uAlphaGain;
  varying vec3 vColor;
  varying vec2 vNdc;
  varying float vProx;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float disc = smoothstep(0.5, 0.32, r);     // crisp filled dot
    float ring = smoothstep(0.5, 0.46, r) * 0.5;
    float a = (disc * (0.32 + vProx * 0.55) + ring * vProx) * uAlphaGain * edgeFade(vNdc) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor + uLift * vProx * 0.4, a);
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
  uniform float uAlphaGain;
  varying vec3 vColor;
  varying vec2 vNdc;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float core = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColor, core * 0.9 * uAlphaGain * edgeFade(vNdc) * uOpacity);
  }
`;

type Trace = { pts: [THREE.Vector2, THREE.Vector2, THREE.Vector2]; teal: boolean };

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
    // Nodes and traces store *which* brand colour they wear and how far it is
    // dimmed, never the resolved RGB — so a theme flip re-derives every buffer
    // from the same layout instead of rebuilding the network.
    type Node = { x: number; y: number; teal: boolean; dim: number; scale: number };
    const cols = Math.ceil((EXT_X * 2) / STEP);
    const rows = Math.ceil((EXT_Y * 2) / STEP);
    const grid: (Node | null)[][] = [];

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
          teal: Math.random() < 0.14,
          // Dimmed toward the page ground so the default state is calm.
          dim: 0.5 + Math.random() * 0.25,
          scale: 2.2 + Math.random() * 2.6,
        };
      }
    }

    const linePos: number[] = [];
    const traces: Trace[] = [];
    /** One entry per line vertex pair, parallel to `linePos`. */
    const lineTeal: boolean[] = [];

    const addTrace = (a: Node, b: Node, horizFirst: boolean) => {
      const corner = horizFirst
        ? new THREE.Vector2(b.x, a.y)
        : new THREE.Vector2(a.x, b.y);
      const A = new THREE.Vector2(a.x, a.y);
      const B = new THREE.Vector2(b.x, b.y);
      // Trace inherits a dim wire color (teal if either end is teal).
      const isTeal = a.teal || b.teal;
      for (const [p, q] of [
        [A, corner],
        [corner, B],
      ] as const) {
        linePos.push(p.x, p.y, 0, q.x, q.y, 0);
        lineTeal.push(isTeal, isTeal);
      }
      traces.push({ pts: [A, corner, B], teal: isTeal });
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
      nScale[k] = n.scale;
    });
    const lineCol = new Float32Array(lineTeal.length * 3);

    const uPointer = { value: new THREE.Vector2(999, 999) };
    const uPixelRatio = { value: pixelRatio };
    const uOpacity = { value: prefersReduced ? 1 : 0 };
    const uLift = { value: 1 };
    const uAlphaGain = { value: 1 };

    // Lines mesh
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    const lineColAttr = new THREE.BufferAttribute(lineCol, 3);
    lineGeo.setAttribute("aColor", lineColAttr);
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { uPointer, uOpacity, uLift, uAlphaGain },
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
    const nodeColAttr = new THREE.BufferAttribute(nCol, 3);
    nodeGeo.setAttribute("aColor", nodeColAttr);
    nodeGeo.setAttribute("aScale", new THREE.BufferAttribute(nScale, 1));
    const nodeMat = new THREE.ShaderMaterial({
      uniforms: { uPointer, uPixelRatio, uOpacity, uLift, uAlphaGain },
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
      pulseScale[k] = 3.2 + Math.random() * 1.6;
      pulsePos.set([tr.pts[0].x, tr.pts[0].y, 0.1], k * 3);
    }

    const pulseGeo = new THREE.BufferGeometry();
    const pulsePosAttr = new THREE.BufferAttribute(pulsePos, 3);
    pulseGeo.setAttribute("position", pulsePosAttr);
    const pulseColAttr = new THREE.BufferAttribute(pulseCol, 3);
    pulseGeo.setAttribute("aColor", pulseColAttr);
    pulseGeo.setAttribute("aScale", new THREE.BufferAttribute(pulseScale, 1));
    const pulseMat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio, uOpacity, uAlphaGain },
      vertexShader: PULSE_VERT,
      fragmentShader: PULSE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const pulses = new THREE.Points(pulseGeo, pulseMat);
    if (!prefersReduced) scene.add(pulses);

    // ── Palette ───────────────────────────────────────────────────
    // Re-derives every colour buffer plus the two theme uniforms. Called once
    // at setup and again on each theme flip; the geometry never moves.
    const applyPalette = (theme: ResolvedTheme) => {
      const { gold, teal } = PALETTE[theme];
      const base = (isTeal: boolean) => (isTeal ? teal : gold);

      nodes.forEach((n, k) => {
        const c = towardGround(base(n.teal), n.dim, theme);
        nCol.set([c.r, c.g, c.b], k * 3);
      });
      lineTeal.forEach((isTeal, k) => {
        const c = towardGround(base(isTeal), 0.4, theme);
        lineCol.set([c.r, c.g, c.b], k * 3);
      });
      for (let k = 0; k < PULSE_N; k++) {
        const c = base(pulseTrace[k].teal);
        pulseCol.set([c.r, c.g, c.b], k * 3);
      }
      nodeColAttr.needsUpdate = true;
      lineColAttr.needsUpdate = true;
      pulseColAttr.needsUpdate = true;

      const dark = theme === "dark";
      // On dark the cursor brightens the circuitry; on paper it must darken it.
      uLift.value = dark ? 1 : -1;
      uAlphaGain.value = dark ? 1 : 0.95;
      // Additive glow only reads against ink — on paper it washes out entirely.
      pulseMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
      pulseMat.needsUpdate = true;
    };

    applyPalette(getResolvedTheme());
    const unsubscribeTheme = subscribeResolvedTheme((theme) => {
      applyPalette(theme);
      // A static (reduced-motion) render has no loop to pick the change up.
      if (prefersReduced) renderer.render(scene, camera);
    });

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
      unsubscribeTheme();
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
