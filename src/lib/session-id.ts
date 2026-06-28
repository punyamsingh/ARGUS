"use client";

/**
 * A stable per-browser session id, persisted to localStorage and sent on each
 * `/api/brief` request so a user's briefs group together in Langfuse's Sessions
 * view (#15). Not security-sensitive — purely an observability grouping key.
 * Best-effort: if storage or `crypto` is unavailable, returns an ephemeral id.
 */

const KEY = "argus.session-id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id = window.crypto?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}
