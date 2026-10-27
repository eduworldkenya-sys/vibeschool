"use client";
import { useState } from "react";
import { Crown, ScrollText, Sparkles } from "lucide-react";
import type { Template } from "./SuccessCardStudio";

type Values = {
  sender: string;
  candidate: string;
  message: string;
  school: string;
  examYear: string;
};
export default function ReceiverEnvelope({
  template,
  values,
  beforeOpen,
  onOpen,
  onOpenedChange,
  soundEnabled,
}: {
  template: Template;
  values: Values;
  beforeOpen: () => Promise<boolean>;
  onOpen: () => void;
  onOpenedChange: (open: boolean) => void;
  soundEnabled: boolean;
  receiverView?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  async function reveal() {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await beforeOpen())) return;
      setOpen(true);
      setHasOpened(true);
      onOpenedChange(true);
      if (soundEnabled) onOpen();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      data-receiver-view
      data-card-open={open}
      className="receiver-envelope"
      data-theme={template}
    >
      {!open ? (
        <>
          <span className="receiver-envelope-icon">
            <ScrollText size={30} />
          </span>
          <h3 className="font-cinzel text-gold-gradient">
            A gift for {values.candidate}
          </h3>
          <p>Sealed with encouragement</p>
          <button
            type="button"
            className="receiver-wax"
            disabled={busy}
            aria-label={hasOpened ? "Open the book card" : "Open the envelope and reveal the success card"}
            onClick={() => void reveal()}
          >
            <Crown size={34} />
            <span>{busy ? "OPENING…" : "TAP SEAL"}</span>
          </button>
          <p className="receiver-seal-hint">
            Tap wax seal to break &amp; reveal wish
          </p>
        </>
      ) : (
        <>
          <div className="receiver-card-heading">
            <Sparkles size={17} />
            <b>KEEPSAKE BLESSING</b>
            <span>{values.examYear} exams</span>
          </div>
          <div role="group" aria-label="Personal wish">
            <p data-testid="success-card-message-preview" className="receiver-personal-message">{values.message}</p>
            <p className="receiver-signature">{values.sender}</p>
            <p className="receiver-card-for">For {values.candidate}</p>
            {values.school && <p className="receiver-card-for">{values.school}</p>}
          </div>
          <button
            type="button"
            className="receiver-close-card"
            aria-label="Close the book card"
            onClick={() => {
              setOpen(false);
              onOpenedChange(false);
            }}
          >
            Close card
          </button>
        </>
      )}
    </div>
  );
}
