"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type PurchaseOffer = {
  id: string;
  pricing_model: string;
  amount_kes: number | null;
  access_days: number | null;
};

type PurchaseContext = {
  ok?: boolean;
  saleable?: boolean;
  already_entitled?: boolean;
  offers?: PurchaseOffer[];
};

export function ReaderPurchaseBar({ publicationId }: { publicationId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);
  const [context, setContext] = useState<PurchaseContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.rpc("commerce_get_publication_purchase_context", {
        p_publication_id: publicationId,
      });
      if (!cancelled && !error && data) setContext(data as PurchaseContext);
    }
    void load();
    return () => { cancelled = true; };
  }, [publicationId, supabase]);

  if (!context?.saleable || context.already_entitled) return null;
  const offer = (context.offers ?? []).find(item => item.pricing_model === "one_time") ?? context.offers?.[0];
  if (!offer || offer.amount_kes === null) return null;

  return (
    <aside
      aria-label="Unlock this learning product"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 14,
        transform: "translateX(-50%)",
        width: "min(620px,calc(100% - 24px))",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 16,
        background: "rgba(10,14,24,.96)",
        border: "1px solid rgba(204,255,0,.34)",
        boxShadow: "0 18px 60px rgba(0,0,0,.48)",
        backdropFilter: "blur(14px)",
        color: "#fff",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "rgba(255,255,255,.58)", fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}>
          UNLOCK FULL LEARNING PRODUCT
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2 }}>
          KES {offer.amount_kes.toLocaleString("en-KE")}
          <span style={{ color: "rgba(255,255,255,.48)", fontSize: 11, fontWeight: 650, marginLeft: 7 }}>
            {offer.access_days ? `${offer.access_days} days` : "one-time access"}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push(`/learn/purchase/${publicationId}`)}
        style={{
          flexShrink: 0,
          border: 0,
          borderRadius: 11,
          background: "#CCFF00",
          color: "#090D16",
          padding: "11px 15px",
          fontSize: 13,
          fontWeight: 950,
          cursor: "pointer",
          minHeight: 42,
        }}
      >
        Unlock with M-Pesa
      </button>
    </aside>
  );
}
