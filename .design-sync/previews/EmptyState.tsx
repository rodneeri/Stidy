import { EmptyState } from "stidy";

export const Default = () => (
  <div style={{ width: 360 }}>
    <EmptyState icon={<span style={{ fontSize: 26 }}>📚</span>} title="No subjects yet">
      Create your first subject to start adding materials and generating study sets.
    </EmptyState>
  </div>
);
