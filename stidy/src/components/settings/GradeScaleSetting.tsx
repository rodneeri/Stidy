"use client";

import { Dropdown } from "@/components/ui/Dropdown";
import { useGradeScale, SCALE_OPTIONS, type GradeScale } from "@/lib/grade-scale";

export function GradeScaleSetting() {
  const scale = useGradeScale((s) => s.scale);
  const setScale = useGradeScale((s) => s.setScale);
  return (
    <Dropdown
      value={scale}
      options={SCALE_OPTIONS}
      onChange={(v) => setScale(v as GradeScale)}
      className="max-w-xs"
    />
  );
}
