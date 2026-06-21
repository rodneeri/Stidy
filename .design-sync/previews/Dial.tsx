import { Dial } from "stidy";

export const Default = () => <Dial value={72} />;

export const Levels = () => (
  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
    <Dial value={28} size={92} accent="#EF4444" />
    <Dial value={64} size={92} accent="#F59E0B" />
    <Dial value={91} size={92} accent="#22C55E" />
  </div>
);
