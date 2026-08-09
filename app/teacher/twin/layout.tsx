import ProductRuntimeGate from "@/components/global/ProductRuntimeGate";

export default function TeacherTwinLayout({ children }: { children: React.ReactNode }) {
  return <ProductRuntimeGate product="twin">{children}</ProductRuntimeGate>;
}
