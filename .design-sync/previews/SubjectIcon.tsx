import { SubjectIcon } from "stidy";

export const Colors = () => (
  <div style={{ display: "flex", gap: 12 }}>
    <SubjectIcon id="a" color="#7C5CFF" />
    <SubjectIcon id="b" color="#22D3EE" />
    <SubjectIcon id="c" color="#F59E0B" />
    <SubjectIcon id="d" color="#EF4444" />
    <SubjectIcon id="e" color="#22C55E" />
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <SubjectIcon id="a" color="#7C5CFF" size="xs" />
    <SubjectIcon id="a" color="#7C5CFF" size="sm" />
    <SubjectIcon id="a" color="#7C5CFF" size="md" />
    <SubjectIcon id="a" color="#7C5CFF" size="lg" />
  </div>
);
