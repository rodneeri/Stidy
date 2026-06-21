import { useState } from "react";
import { Dropdown } from "stidy";

const opts = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const Default = () => {
  const [v, setV] = useState("medium");
  return (
    <div style={{ width: 220 }}>
      <Dropdown value={v} options={opts} onChange={setV} />
    </div>
  );
};

export const Placeholder = () => {
  const [v, setV] = useState("");
  return (
    <div style={{ width: 220 }}>
      <Dropdown value={v} options={opts} onChange={setV} placeholder="Pick difficulty" />
    </div>
  );
};
