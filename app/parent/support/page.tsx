"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function supportId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 12);
  return `parent-${Date.now().toString(36)}`;
}

function safeParentScreen(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/parent")) return "/parent";
    return url.pathname
      .replace(/\/parent\/child\/[^/]+/g, "/parent/child/:linked-child")
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:item");
  } catch {
    return "/parent";
  }
}

export default function ParentSupportPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [online, setOnline] = useState(true);
  const [sourceScreen, setSourceScreen] = useState("/parent");
  const id = useMemo(() => supportId(), []);
  const timestamp = useMemo(() => new Date().toISOString(), []);

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    refresh();
    if (document.referrer) setSourceScreen(safeParentScreen(document.referrer));
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  const safeContext = `VibeSchool Parent support\nReference: ${id}\nFrom screen: ${sourceScreen}\nRole: parent\nTime: ${timestamp}\nNetwork: ${online ? "online" : "offline"}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(safeContext);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 20 }}>
        <div style={{ color: "#059669", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>Support</div>
        <h1 style={{ margin: "4px 0 8px", color: "#1e1b4b", fontSize: 24 }}>Report a problem</h1>
        <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          Describe what you were trying to do, not private learner details. Do not send passwords, PINs, full assessment records or screenshots containing information about another learner.
        </p>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 8 }}>Safe diagnostic details</div>
          <dl style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: "7px 10px", margin: 0, fontSize: 12 }}>
            <dt style={{ color: "#64748b" }}>Reference</dt><dd style={{ margin: 0, fontWeight: 750 }}>{id}</dd>
            <dt style={{ color: "#64748b" }}>From</dt><dd style={{ margin: 0 }}>{sourceScreen}</dd>
            <dt style={{ color: "#64748b" }}>Role</dt><dd style={{ margin: 0 }}>Parent</dd>
            <dt style={{ color: "#64748b" }}>Network</dt><dd style={{ margin: 0 }}>{online ? "Online" : "Offline"}</dd>
            <dt style={{ color: "#64748b" }}>Time</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{timestamp}</dd>
          </dl>
        </div>

        <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 11, lineHeight: 1.5 }}>
          The learner portion of a child route is replaced with a safe label before these details are copied.
        </p>
        <button type="button" onClick={() => void copy()} style={{ width: "100%", minHeight: 46, border: "none", borderRadius: 11, background: "#1e1b4b", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
          {copied ? "Support details copied" : "Copy support details"}
        </button>
        <button type="button" onClick={() => router.push("/parent/inbox")} style={{ width: "100%", minHeight: 46, marginTop: 10, border: "1px solid #cbd5e1", borderRadius: 11, background: "#fff", color: "#1e1b4b", fontWeight: 800, cursor: "pointer" }}>
          Open family inbox
        </button>
      </section>
    </div>
  );
}
