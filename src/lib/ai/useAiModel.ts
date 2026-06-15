"use client";

import { useEffect, useState } from "react";
import { DEFAULT_AI_MODEL, isValidModel } from "./catalog";

const KEY = "stidy:ai-model";

/** Remembers the chosen NVIDIA model across sessions; shared by every prompt box. */
export function useAiModel(): [string, (v: string) => void] {
  const [model, setModel] = useState(DEFAULT_AI_MODEL);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (isValidModel(saved)) setModel(saved);
  }, []);

  const set = (v: string) => {
    setModel(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore quota / private mode */
    }
  };

  return [model, set];
}
