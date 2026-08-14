"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminStudentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const items = [
    { href: "/admin/students", label: "Student roster", exact: true },
    { href: "/admin/students/corrections", label: "Profile corrections", exact: false },
  ];

  return <>
    <nav aria-label="Student administration" style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
      {items.map(item => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} style={{ textDecoration: "none", whiteSpace: "nowrap", borderRadius: 999, padding: "8px 11px", fontSize: 10, fontWeight: 850, border: `1px solid ${active ? "#10b981" : "#e2e8f0"}`, background: active ? "#ecfdf5" : "#fff", color: active ? "#047857" : "#64748b" }}>{item.label}</Link>;
      })}
    </nav>
    {children}
  </>;
}
