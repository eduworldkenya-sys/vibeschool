import ProductRuntimeGate from "@/components/global/ProductRuntimeGate";
export default function StudentTemplate({ children }: { children: React.ReactNode }) { return <ProductRuntimeGate product="student">{children}</ProductRuntimeGate>; }
