import { CountUp } from "stidy";

export const Default = () => (
  <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}>
    <CountUp to={1280} />
  </span>
);

export const Decimals = () => (
  <span style={{ fontSize: 44, fontWeight: 700 }}>
    <CountUp to={98.6} decimals={1} />
    <span style={{ fontSize: 22, opacity: 0.6 }}>%</span>
  </span>
);
