"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function FirstAdminPage() {
  const [secret, setSecret] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setCode("");
    try {
      const response = await fetch("/api/setup/admin-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, displayName }),
      });
      const result = await response.json() as { code?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not create the first admin code.");
      setCode(result.code ?? ""); setMessage(result.message ?? "Save this code now.");
      setSecret("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create the first admin code."); }
    finally { setBusy(false); }
  }

  return <main className="first-admin-shell"><Link className="first-admin-back" href="/">← VidyaLog</Link><section className="first-admin-card"><div className="first-admin-mark">✳</div><span className="eyebrow-label">ONE-TIME SETUP</span><h1>Create your first admin code</h1><p>Enter the setup secret from your local environment file. This code has full access and will not expire.</p>{code ? <div className="admin-code-result"><span>Save this code securely. It will not be shown again.</span><code>{code}</code><button className="primary-action" onClick={() => { navigator.clipboard?.writeText(code); setMessage("Admin code copied."); }}>Copy code</button><Link className="secondary-action" href="/">Go to sign in</Link></div> : <form className="modal-form" onSubmit={createCode}><label>Your name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} placeholder="Name shown in the app" /></label><label>Setup secret<input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} required autoComplete="current-password" placeholder="From .env.local" /></label><button className="primary-action" disabled={busy}>{busy ? "Creating…" : "Create admin code"}</button></form>}{message && <p className="first-admin-message" role="status">{message}</p>}</section></main>;
}
