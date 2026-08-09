import ProductRuntimeGate from "@/components/global/ProductRuntimeGate";

export default function TeacherVibeLearnLayout({ children }: { children: React.ReactNode }) {
  return <ProductRuntimeGate product="vibelearn">{children}</ProductRuntimeGate>;
}
