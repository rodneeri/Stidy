"use client";

/**
 * Tiny event bus so anywhere in the app (e.g. the top-bar search) can hand a
 * query to the STiDY assistant — opening it and sending the message —
 * without prop-drilling or a global store. SSR-safe (no-ops without `window`).
 */
const EVENT = "stidy-ask-assistant";

/** Open the assistant and ask it `query`. */
export function askAssistant(query: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: query }));
}

/** Subscribe the assistant panel to incoming queries. Returns an unsubscribe fn. */
export function onAskAssistant(handler: (query: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const q = (e as CustomEvent<string>).detail;
    if (q) handler(q);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
