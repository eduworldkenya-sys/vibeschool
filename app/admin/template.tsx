import ProductRuntimeGate from "@/components/global/ProductRuntimeGate";
export default function AdminTemplate({ children }: { children: React.ReactNode }) { return <ProductRuntimeGate product="school_admin">{children}</ProductRuntimeGate>; }
