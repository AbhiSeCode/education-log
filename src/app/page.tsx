"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

// The QR code always points at the public deployment, even when the page is opened locally or on a preview URL.
const SHARE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vidyalog.vercel.app/";
const SHARE_LABEL = new URL(SHARE_URL).host;

// Read browser-only values without a setState-in-effect round trip; the server snapshot is empty.
const noSubscribe = () => () => undefined;
const useSessionEnded = () => useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).get("session") === "ended", () => false);

function BookMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M5 13c6.4-2.2 12.8-.8 19 3.2v24c-6.2-3.6-12.6-4.7-19-2.5V13Z" fill="currentColor" />
        <path d="M24 16.2c6.2-4 12.6-5.4 19-3.2v24.7c-6.4-2.2-12.8-1.1-19 2.5v-24Z" fill="currentColor" opacity=".62" />
        <path d="M24 16v24M10 19c3.8-.5 7.5.3 10.5 1.8M10 25c3.8-.5 7.5.3 10.5 1.8m17-7.8c-2.8-.3-5.5.2-8.4 1.3" stroke="#fffefa" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="35" cy="30" r="6" fill="#E78450" />
        <path d="m32.3 30 1.8 1.8 3.7-4" stroke="#fffefa" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m39 2 1.2 3.3L43.5 6.5l-3.3 1.2L39 11l-1.2-3.3-3.3-1.2 3.3-1.2L39 2Z" fill="#E78450" />
      </svg>
    </span>
  );
}

function Glyph({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

/** Two children holding a big open book under a warm arch, with floating letter tiles. */
function HeroScene() {
  return (
    <svg className="hero-scene" viewBox="0 0 480 460" aria-hidden="true">
      <path d="M56 446V226a184 184 0 0 1 368 0v220Z" fill="#efe6d2" />
      <circle cx="240" cy="246" r="150" fill="#e6ecdc" />
      <path d="M78 446V228a162 162 0 0 1 324 0v218" fill="none" stroke="#d6caab" strokeDasharray="4 7" strokeLinecap="round" />
      <circle cx="150" cy="128" r="44" fill="#f3ce64" opacity=".25" />
      <circle cx="150" cy="128" r="30" fill="#f3ce64" />
      <g fill="#fffdf7"><circle cx="318" cy="186" r="13" /><circle cx="336" cy="178" r="18" /><circle cx="356" cy="188" r="12" /><rect x="304" y="186" width="64" height="13" rx="6.5" /></g>
      <path d="m414 168 2.4 6.6 6.6 2.4-6.6 2.4-2.4 6.6-2.4-6.6-6.6-2.4 6.6-2.4Z" fill="#e78450" />
      <path d="m80 214 1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8Z" fill="#83a47d" />

      <g className="scene-tile"><g transform="translate(240 206) rotate(-6)"><rect x="-22" y="-22" width="44" height="44" rx="12" fill="#fffdf7" stroke="#e3d9c2" /><text y="9" textAnchor="middle" fontSize="25" fontWeight="800" fill="#205c48">A</text></g></g>
      <g className="scene-tile"><g transform="translate(392 262) rotate(9)"><rect x="-19" y="-19" width="38" height="38" rx="10" fill="#fffdf7" stroke="#e3d9c2" /><text y="8" textAnchor="middle" fontSize="21" fontWeight="800" fill="#d4692f">क</text></g></g>
      <g className="scene-tile"><g transform="translate(250 98) rotate(-4)"><rect x="-16" y="-16" width="32" height="32" rx="9" fill="#fffdf7" stroke="#e3d9c2" /><text y="7" textAnchor="middle" fontSize="19" fontWeight="800" fill="#b8860b">3</text></g></g>

      <ellipse cx="240" cy="442" rx="178" ry="10" fill="#e0d3b5" />
      <path d="M112 442q3-12 7 0 3-9 7 0M356 442q3-12 7 0 3-9 7 0" fill="none" stroke="#83a47d" strokeWidth="2.4" strokeLinecap="round" />

      <g transform="translate(70 268) scale(1.85)">
        <g className="scene-kid">
          <path d="M19 57c-8 9-9 20-7 31h48c2-11 1-22-7-31H19Z" fill="#70A88C" />
          <path d="M27 52v12c4 5 13 5 17 0V52H27Z" fill="#D99468" />
          <path d="M18 25c-7 4-8 12-4 17-5 6-3 12 3 16-4 6-1 12 5 14l5-6c-5-3-5-7-1-10-5-4-5-7-2-11-4-4-4-8-1-12Z" fill="#3D473B" />
          <path d="M54 25c7 4 8 12 4 17 5 6 3 12-3 16 4 6 1 12-5 14l-5-6c5-3 5-7 1-10 5-4 5-7 2-11 4-4 4-8 1-12Z" fill="#3D473B" />
          <ellipse cx="35.5" cy="36" rx="21" ry="23" fill="#C98258" />
          <path d="M14 35C12 18 21 5 36 5s24 12 22 29l-4 8-4-15c-7-2-11-6-14-11-4 6-10 10-19 12l-1 15-4 8-3-16Z" fill="#3D473B" />
          <path d="m17 68 4-3 5 3-5 5-4-5Zm33 0 4-3 5 3-5 5-4-5Z" fill="#E78450" />
          <ellipse cx="29" cy="37" rx="2" ry="2.5" fill="#243A32" />
          <ellipse cx="43" cy="37" rx="2" ry="2.5" fill="#243A32" />
          <ellipse cx="24" cy="44" rx="3.2" ry="2" fill="#E78450" opacity=".35" />
          <ellipse cx="48" cy="44" rx="3.2" ry="2" fill="#E78450" opacity=".35" />
          <path d="M31 47c3 3 7 3 10 0" fill="none" stroke="#8C4E40" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 71 3 83m57-12 9 12" stroke="#C98258" strokeWidth="7" strokeLinecap="round" />
        </g>
      </g>
      <g transform="translate(277 268) scale(1.85)">
        <g className="scene-kid scene-kid-two">
          <path d="M19 57c-8 9-9 20-7 31h48c2-11 1-22-7-31H19Z" fill="#E8B953" />
          <path d="M27 52v12c4 5 13 5 17 0V52H27Z" fill="#9E624B" />
          <ellipse cx="35.5" cy="36" rx="21" ry="23" fill="#9E624B" />
          <path d="M15 32c0-17 8-27 22-27 12 0 21 8 22 23-7-2-12-7-15-13-5 8-16 12-29 11v6Z" fill="#292E2B" />
          <ellipse cx="29" cy="37" rx="2" ry="2.5" fill="#243A32" />
          <ellipse cx="43" cy="37" rx="2" ry="2.5" fill="#243A32" />
          <ellipse cx="24" cy="44" rx="3.2" ry="2" fill="#E78450" opacity=".3" />
          <ellipse cx="48" cy="44" rx="3.2" ry="2" fill="#E78450" opacity=".3" />
          <path d="M31 47c3 3 7 3 10 0" fill="none" stroke="#603A35" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 71 3 83m57-12 9 12" stroke="#9E624B" strokeWidth="7" strokeLinecap="round" />
        </g>
      </g>

      <path d="M160 372c32-12 60-10 80 4 20-14 48-16 80-4v66c-32-12-60-10-80 4-20-14-48-16-80-4Z" fill="#205c48" />
      <path d="M167 369c28-11 55-9 73 4v59c-18-12-45-14-73-4Z" fill="#fffdf7" />
      <path d="M240 373c18-13 45-15 73-4v59c-28-10-55-8-73 4Z" fill="#fff6e4" />
      <path d="M240 373v59" stroke="#ddd2b8" />
      <path d="M180 384c16-5 30-4 46 2M180 398c16-5 30-4 46 2M180 412c12-4 22-4 32 0" fill="none" stroke="#d9d1bd" strokeWidth="3" strokeLinecap="round" />
      <text x="276" y="406" textAnchor="middle" fontSize="19" fontStyle="italic" fontWeight="700" fill="#d4692f">abc</text>
      <path d="m298 386 1.4 3.8 3.8 1.4-3.8 1.4-1.4 3.8-1.4-3.8-3.8-1.4 3.8-1.4Z" fill="#e8b953" />
    </svg>
  );
}

const steps = [
  { title: "Get your code", text: "Your coordinator shares a short access code before each drive.", icon: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-4 4 3 3m-6 0 2 2" /></> },
  { title: "See where they left off", text: "Each child’s last lesson and homework are waiting for you.", icon: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></> },
  { title: "Record today’s session", text: "Note the subjects you covered so the next volunteer can carry on.", icon: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></> },
];

export default function Home() {
  const router = useRouter();
  const sessionEnded = useSessionEnded();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!showQr) return;
    function handleEscape(event: KeyboardEvent) { if (event.key === "Escape") setShowQr(false); }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showQr]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) {
      setMessage("Enter the access code shared with you to continue.");
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not check this code.");
      router.replace("/dashboard");
      return;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check this code. Try again.");
    }
    setIsSubmitting(false);
  }

  return (
    <main className="landing-shell">
      <div className="landing-inner">
        <header className="topbar">
          <a className="brand" href="#home" aria-label="VidyaLog home">
            <BookMark />
            <span className="brand-name">Vidya<span>Log</span></span>
          </a>
          <button type="button" className="share-button" onClick={() => setShowQr(true)} aria-label="Share VidyaLog with a QR code">
            <Glyph size={18}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h.01M18 14h2" /></Glyph>
            <span>Share</span>
          </button>
        </header>

        <section className="hero" id="home">
          <div className="hero-copy">
            <span className="eyebrow">For NGO volunteers and coordinators</span>
            <h1>Every lesson<br className="hero-break" /> has a <em>next chapter.</em></h1>
            <p className="hero-description">
              The small things a child learns add up to big things. Pick up where the last volunteer left off, and keep their story going.
            </p>

            <div className="access-panel">
              <div className="access-heading">
                <span className="access-icon"><Glyph size={22}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></Glyph></span>
                <div><h2>Sign in with your access code</h2><p>Your coordinator shares a short code before each drive.</p></div>
              </div>
              {sessionEnded && !message && <p className="form-message session-ended" role="status">Your session has ended. Enter your access code to continue.</p>}
              <form className="code-form" onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="access-code">Access code</label>
                <input
                  id="access-code"
                  name="code"
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="Access code"
                  value={code}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => { setCode(event.target.value.toUpperCase()); setMessage(""); }}
                  aria-describedby={message ? "code-message" : undefined}
                />
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Checking…" : "Continue"}
                  <Glyph size={18}><path d="M5 12h14m-6-6 6 6-6 6" /></Glyph>
                </button>
              </form>
              {message && <p className="form-message" id="code-message" role="status">{message}</p>}
              <p className="access-foot"><Glyph size={16}><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></Glyph>You’ll only see the children you’re meant to see.</p>
            </div>
            <p className="cookie-note">One essential sign-in cookie keeps your session secure. No ad tracking.</p>
          </div>

          <div className="hero-visual">
            <HeroScene />
            <div className="float-card card-saved" aria-hidden="true">
              <span className="float-icon"><Glyph size={18}><path d="m5 12.5 4.5 4.5L19 7.5" /></Glyph></span>
              <div><strong>Session saved</strong><span className="float-tag">Maths · Confident</span></div>
            </div>
            <div className="float-card card-last" aria-hidden="true">
              <span className="float-icon"><Glyph size={18}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></Glyph></span>
              <div><strong>Last time</strong><small>Read 2 pages of chapter 3</small><span className="float-tag">Reading · Getting there</span></div>
            </div>
          </div>
        </section>

        <section className="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <h2 id="how-title">How it works</h2>
            <p>Three small steps, every drive.</p>
          </div>
          <ol className="steps">
            {steps.map((step, index) => (
              <li className="step" key={step.title}>
                <span className="step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="step-icon"><Glyph size={22}>{step.icon}</Glyph></span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="footer"><span>Made with care for curious minds</span><span className="footer-flower" aria-hidden="true">✳</span><span>Learning grows when we grow together.</span></footer>

      {showQr && <div className="qr-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowQr(false); }}><section className="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-dialog-title"><button className="qr-close" type="button" onClick={() => setShowQr(false)} aria-label="Close QR code" autoFocus>×</button><div className="qr-large-frame"><QRCodeSVG value={SHARE_URL} size={260} bgColor="#fffefa" fgColor="#244d3c" level="M" marginSize={4} /></div><h2 id="qr-dialog-title">Share VidyaLog</h2><p>Scan this code with a phone camera to open VidyaLog.</p><a className="qr-link" href={SHARE_URL} target="_blank" rel="noreferrer">{SHARE_LABEL}</a></section></div>}
    </main>
  );
}
