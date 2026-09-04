"use client";

/**
 * Conversation ids — the grouping key behind Langfuse's Sessions view (#15).
 *
 * A *conversation* is one brief plus the follow-ups asked about it: several
 * model calls (the brief itself, then each `ask`) that belong to one piece of
 * work. Every conversation gets its own id, so every conversation is its own
 * Langfuse session and the chats within it sit side by side in that session.
 *
 * This deliberately replaces the earlier per-browser id: that one persisted in
 * localStorage, so months of unrelated briefs piled into a single session.
 * Nothing here is persisted — a new brief means a new conversation, and the id
 * lives only for as long as the view showing that brief.
 *
 * Not security-sensitive; purely an observability grouping key.
 */

export function newConversationId(): string {
  const uuid =
    (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `conv_${uuid}`;
}
