import ProductRuntimeGate from "@/components/global/ProductRuntimeGate";
export default function StudentTwinLayout({ children }: { children: React.ReactNode }) { return <ProductRuntimeGate product="twin">{children}</ProductRuntimeGate>; }
