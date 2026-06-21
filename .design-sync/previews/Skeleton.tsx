import { Skeleton } from "stidy";

export const Default = () => (
  <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 10 }}>
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-1/2" />
  </div>
);
