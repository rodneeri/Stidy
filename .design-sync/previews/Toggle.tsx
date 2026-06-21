import { useState } from "react";
import { Toggle } from "stidy";

export const On = () => <Toggle checked onChange={() => {}} label="Notifications" />;

export const Off = () => <Toggle checked={false} onChange={() => {}} label="Reduced motion" />;

export const Interactive = () => {
  const [v, setV] = useState(true);
  return <Toggle checked={v} onChange={setV} label="Sound effects" />;
};
