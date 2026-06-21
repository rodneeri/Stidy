import { useState } from "react";
import { NeuSlider } from "stidy";

export const Default = () => {
  const [v, setV] = useState(65);
  return (
    <div style={{ width: 280 }}>
      <NeuSlider value={v} onChange={setV} />
    </div>
  );
};

export const Formatted = () => {
  const [v, setV] = useState(40);
  return (
    <div style={{ width: 280 }}>
      <NeuSlider value={v} onChange={setV} format={(n) => `${n}%`} />
    </div>
  );
};
