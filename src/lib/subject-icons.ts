"use client";

import { useEffect, useState } from "react";

/** Per-subject emoji/symbol, stored locally (no migration). Keyed by subject id. */
const KEY = "stidy-subject-icons";
type IconMap = Record<string, string>;

function read(): IconMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function write(m: IconMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
    window.dispatchEvent(new Event("stidy-icons"));
  } catch {
    /* ignore */
  }
}

export function getSubjectIcon(id: string): string | null {
  return read()[id] || null;
}
export function setSubjectIcon(id: string, emoji: string) {
  const m = read();
  if (emoji) m[id] = emoji;
  else delete m[id];
  write(m);
}

/** Live map of all subject icons; re-renders when any icon changes (this tab). */
export function useSubjectIcons(): IconMap {
  const [map, setMap] = useState<IconMap>({});
  useEffect(() => {
    const sync = () => setMap(read());
    sync();
    window.addEventListener("stidy-icons", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("stidy-icons", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return map;
}
