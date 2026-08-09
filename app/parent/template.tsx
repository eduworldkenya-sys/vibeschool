import ProductRuntimeGate from "@/components/global/ProductRuntimeGate";
export default function ParentTemplate({ children }: { children: React.ReactNode }) { return <ProductRuntimeGate product="parent">{children}</ProductRuntimeGate>; }
