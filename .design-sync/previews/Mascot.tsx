import { Mascot } from "stidy";

export const Default = () => <Mascot size={120} animate={false} />;

export const Sizes = () => (
  <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
    <Mascot size={48} animate={false} />
    <Mascot size={80} animate={false} />
    <Mascot size={120} animate={false} />
  </div>
);
