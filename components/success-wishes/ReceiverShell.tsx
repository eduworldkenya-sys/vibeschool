"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Menu,
  X,
  Volume2,
  VolumeX,
  Inbox,
  MailOpen,
  Plus,
  KeyRound,
  Grid2X2,
  ShieldCheck,
  Home,
  Send,
  LogOut,
} from "lucide-react";
import { broadcastReceiverLogout } from "@/lib/success-wishes/receiver-browser-session";

type Summary = {
  name: string;
  school: string;
  count: number;
  unopened: number;
} | null;
const ReceiverContext = createContext<{
  soundEnabled: boolean;
  setSummary: (summary: Summary) => void;
}>({ soundEnabled: true, setSummary: () => {} });
export const useReceiverTheme = () => useContext(ReceiverContext);
const links = [
  { href: "/success-wishes/inbox", label: "My wishes", icon: Inbox },
  { href: "/success-wishes/open", label: "Open a Wish", icon: MailOpen },
  { href: "/success-wishes/request", label: "Request a wish", icon: Plus },
  { href: "/success-wishes/recover", label: "Recover access", icon: KeyRound },
  {
    href: "/success-wishes/settings",
    label: "Privacy & Safety",
    icon: ShieldCheck,
  },
  { href: "/success-wishes", label: "Send a wish", icon: Send },
  { href: "/", label: "VibeSchool home", icon: Home },
];

export default function ReceiverShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const receiver = pathname !== "/success-wishes";
  const [drawer, setDrawer] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [summary, setSummary] = useState<Summary>(null);
  const [logoutError, setLogoutError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const value = useMemo(() => ({ soundEnabled, setSummary }), [soundEnabled]);
  useEffect(() => {
    setDrawer(false);
    setSummary(null);
    setSignedOut(false);
    setLogoutError("");
  }, [pathname]);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (drawer && !el.open) el.showModal();
    if (!drawer && el.open) el.close();
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawer]);
  async function signOut() {
    setSignedOut(true);
    setSummary(null);
    setLogoutError("");
    try {
      const response = await fetch("/api/success-wishes/receiver/inbox", {
        method: "DELETE",
      });
      if (!response.ok)
        throw Error(
          "Sign-out could not be confirmed. Close this tab and contact support.",
        );
      broadcastReceiverLogout();
      window.location.replace("/success-wishes/recover");
    } catch {
      broadcastReceiverLogout();
      setLogoutError(
        "Sign-out could not be confirmed. Close this tab and contact support.",
      );
    }
  }
  const brand = (
    <Link href="/success-wishes" className="receiver-brand">
      <Image src="/brand/vibeschool-wordmark-dark.svg" alt="VibeSchool" width={620} height={160} className="receiver-wordmark" />
      <small className="receiver-brand-label">SUCCESS WISHES</small>
    </Link>
  );
  const nav = (
    <nav aria-label="Receiver menu">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          onClick={() => setDrawer(false)}
        >
          <Icon size={18} />
          <span>{label}</span>
          {href.endsWith("/inbox") && summary && <em>{summary.unopened}</em>}
        </Link>
      ))}
    </nav>
  );
  const sound = (
    <button
      type="button"
      className="receiver-sound"
      aria-label={soundEnabled ? "Sound on" : "Sound off"}
      aria-pressed={soundEnabled}
      onClick={() => setSoundEnabled((v) => !v)}
    >
      {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      <span>Audio Chimes</span>
      <b>{soundEnabled ? "ON" : "OFF"}</b>
    </button>
  );
  return (
    <ReceiverContext.Provider value={value}>
      <div className={receiver ? "receiver-theme" : "receiver-site"}>
        {!receiver ? (
          <>
            <nav
              className="receiver-sender-links"
              aria-label="Success Wishes navigation"
            >
              <Link href="/">VibeSchool</Link>
              <Link href="/success-wishes#choose-card">Send a wish</Link>
              <Link href="/success-wishes/open">Open a wish</Link>
              <Link href="/success-wishes/inbox">My wishes</Link>
            </nav>
            {children}
          </>
        ) : (
          <>
            <header className="receiver-mobile-header">
              <button
                ref={opener}
                type="button"
                aria-label="Open receiver menu"
                aria-expanded={drawer}
                onClick={() => setDrawer(true)}
              >
                <Menu size={20} />
              </button>
              {brand}
              <button
                type="button"
                aria-label={
                  soundEnabled ? "Sound on" : "Sound off"
                }
                aria-pressed={soundEnabled}
                onClick={() => setSoundEnabled((v) => !v)}
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </header>
            <div className="receiver-app">
              <aside className="receiver-sidebar">
                {brand}
                {nav}
                {pathname !== "/success-wishes/invitation" && <section className="receiver-summary">
                  <span>
                    Wish Collection <ShieldCheck size={14} />
                  </span>
                  <div className="receiver-progress">
                    <i
                      style={{
                        width: summary?.count
                          ? `${((summary.count - summary.unopened) / summary.count) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <p>
                    {summary
                      ? `${summary.count - summary.unopened} Opened · ${summary.unopened} Waiting`
                      : "Your private wishes, kept together."}
                  </p>
                </section>}
                <div className="receiver-profile">
                  {sound}
                  {summary && (
                    <>
                      <strong>{summary.name}</strong>
                      <small>{summary.school}</small>
                      <button type="button" onClick={() => void signOut()}>
                        <LogOut size={16} /> Sign out
                      </button>
                    </>
                  )}
                </div>
              </aside>
              <div className="receiver-content">
                {logoutError && <p role="alert">{logoutError}</p>}
                {signedOut ? <div className="receiver-signout-state"><p role="status">This device has been cleared.</p><Link href="/success-wishes/recover">Recover access</Link></div> : children}
              </div>
            </div>
            <nav
              className="receiver-bottom"
              aria-label="Receiver bottom navigation"
            >
              <Link
                href="/success-wishes/inbox"
                aria-current={pathname.endsWith("/inbox") ? "page" : undefined}
              >
                <Inbox />
                <span>My wishes</span>
              </Link>
              <Link
                href="/success-wishes/open"
                aria-current={
                  pathname.endsWith("/open") || pathname.endsWith("/invitation")
                    ? "page"
                    : undefined
                }
              >
                <MailOpen />
                <span>Open</span>
              </Link>
              <Link className="receiver-request" href="/success-wishes/request">
                <i>
                  <Plus />
                </i>
                <span>Request</span>
              </Link>
              <Link
                href="/success-wishes/recover"
                aria-current={
                  pathname.endsWith("/recover") ? "page" : undefined
                }
              >
                <KeyRound />
                <span>Recover</span>
              </Link>
              <button
                type="button"
                aria-label="Open receiver menu"
                aria-expanded={drawer}
                onClick={() => setDrawer(true)}
              >
                <Grid2X2 />
                <span>Menu</span>
              </button>
            </nav>
            <dialog
              ref={dialog}
              className="receiver-drawer"
              aria-label="Receiver navigation menu"
              onCancel={() => setDrawer(false)}
              onClose={() => {
                setDrawer(false);
                opener.current?.focus();
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setDrawer(false);
              }}
            >
              <div>
                <div className="receiver-drawer-heading">
                  {brand}
                  <button
                    type="button"
                    aria-label="Close receiver menu"
                    onClick={() => setDrawer(false)}
                  >
                    <X />
                  </button>
                </div>
                {summary && (
                  <p className="receiver-drawer-name">{summary.name}</p>
                )}
                {nav}
                <section className="receiver-summary">
                  <span>My wishes</span>
                  <p>
                    {summary
                      ? `${summary.count} Received · ${summary.count - summary.unopened} Opened`
                      : "Open your inbox to see your collection."}
                  </p>
                </section>
                {sound}
              </div>
            </dialog>
          </>
        )}
      </div>
    </ReceiverContext.Provider>
  );
}
