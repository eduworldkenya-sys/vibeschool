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
  Settings,
} from "lucide-react";
import {broadcastKeepsakeChange} from '@/lib/success-wishes/receiver-pin-browser';

type Summary = {
  name: string;
  school: string;
  count: number;
  unopened: number;
} | null;
const ReceiverContext = createContext<{
  soundEnabled: boolean;
  setSummary: (summary: Summary) => void;
  setSoundEnabled: (enabled: boolean) => void;
}>({ soundEnabled: true, setSummary: () => {}, setSoundEnabled: () => {} });
export const useReceiverTheme = () => useContext(ReceiverContext);
const links = [
  { href: "/success-wishes/inbox", label: "My wishes", icon: Inbox },
  { href: "/success-wishes/open", label: "Open a Wish", icon: MailOpen },
  { href: "/success-wishes", label: "Send a wish", icon: Send },
  { href: "/success-wishes/request", label: "Request a wish", icon: Plus },
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
  const value = useMemo(() => ({ soundEnabled, setSummary, setSoundEnabled }), [soundEnabled]);
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
      broadcastKeepsakeChange();
      window.location.replace("/success-wishes/recover");
    } catch {
      broadcastKeepsakeChange();
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
      <details className="receiver-account-options"><summary><Settings size={18}/><span>Settings</span></summary><div><Link href="/success-wishes/settings" onClick={() => setDrawer(false)}><ShieldCheck size={18}/>Privacy &amp; safety</Link><Link href="/success-wishes/recover" onClick={() => setDrawer(false)}><KeyRound size={18}/>Recover access</Link><button type="button" onClick={() => void signOut()}><LogOut size={18}/>Sign out</button><Link href="/" onClick={() => setDrawer(false)}><Home size={18}/>VibeSchool home</Link></div></details>
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
      <div className={receiver ? (["/success-wishes/invitation", "/success-wishes/gift"].includes(pathname) ? "receiver-theme receiver-gift-focus" : "receiver-theme") : "receiver-site"}>
        {!receiver ? children : (
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

                    </>
                  )}
                </div>
              </aside>
              <div className="receiver-content">
                {logoutError && <p role="alert">{logoutError}</p>}
                {signedOut ? <div className="receiver-signout-state"><p role="status">{logoutError ? "Sign-out needs confirmation." : "This device has been cleared."}</p><Link href="/success-wishes/recover">Recover access</Link></div> : children}
              </div>
            </div>
            <footer className="receiver-legal-footer"><p>© 2026 VibeSchool · by GILOWINC</p><p><Link href="/legal/terms">Terms &amp; Conditions apply</Link> · <Link href="/contact">Contact us</Link></p></footer>
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
                href="/success-wishes"
                aria-current={pathname === "/success-wishes" ? "page" : undefined}
              >
                <Send />
                <span>Send</span>
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
              </div>
            </dialog>
          </>
        )}
      </div>
    </ReceiverContext.Provider>
  );
}
