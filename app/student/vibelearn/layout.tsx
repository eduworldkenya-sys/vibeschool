import ProductRuntimeGate from "@/components/global/ProductRuntimeGate";

export default function StudentVibeLearnLayout({ children }: { children: React.ReactNode }) {
  return <ProductRuntimeGate product="vibelearn">{children}</ProductRuntimeGate>;
}
