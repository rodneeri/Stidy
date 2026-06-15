import { MeshBackground } from "@/components/layout/MeshBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-12">
      <MeshBackground />
      {children}
    </div>
  );
}
