import ProductRuntimeGate from "@/components/global/ProductRuntimeGate";
export default function TeacherTemplate({ children }: { children: React.ReactNode }) { return <ProductRuntimeGate product="teacher">{children}</ProductRuntimeGate>; }
