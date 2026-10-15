"use client";

import "./dashboard.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SESSION_ENDED_URL, errorMessage, readJson } from "./_components/api";
import { ChildrenTab } from "./_components/ChildrenTab";
import { CodesTab } from "./_components/CodesTab";
import { ChapterFormModal, CodeFormModal, CodeRevealModal, KidFormModal, StationeryFormModal } from "./_components/Forms";
import { BrandMark, Icon, type IconName } from "./_components/Icon";
import { KidDetail } from "./_components/KidDetail";
import { ConfirmDialog, type ConfirmOptions } from "./_components/Modal";
import { ChaptersTab, DrivesTab, StationeryTab } from "./_components/SimpleTabs";
import { TABS, roleNames, type Chapter, type Code, type CodePreset, type Drive, type Kid, type StationeryItem, type Tab, type User } from "./_components/types";

type View = { tab: Tab; kidId: string | null };
type ModalState =
  | { type: "kid"; kid: Kid | null }
  | { type: "code"; preset: CodePreset }
  | { type: "codeReveal"; code: string; name: string }
  | { type: "stationery"; item: StationeryItem | null }
  | { type: "chapter" }
  | null;

const tabLabels: Record<Tab, { label: string; icon: IconName }> = {
  kids: { label: "Children", icon: "users" },
  drives: { label: "Drives", icon: "calendar" },
  codes: { label: "Access codes", icon: "key" },
  stationery: { label: "Stationery", icon: "package" },
  chapters: { label: "Chapters", icon: "home" },
};

function parseView(search: string): View {
  const params = new URLSearchParams(search);
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? params.get("tab") as Tab : "kids";
  return { tab, kidId: tab === "kids" ? params.get("kid") : null };
}

function viewUrl(view: View) {
  const params = new URLSearchParams();
  if (view.tab !== "kids") params.set("tab", view.tab);
  if (view.kidId) params.set("kid", view.kidId);
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

function SessionTimer({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000));
  useEffect(() => { if (minutes <= 0) window.location.replace(SESSION_ENDED_URL); }, [minutes]);
  const text = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
  return (
    <span className={`session-timer ${minutes <= 15 ? "is-warning" : ""}`} role={minutes <= 15 ? "status" : undefined} title="Your access code signs you out automatically when the session ends.">
      <Icon name="clock" size={15} />Session ends in {text}{minutes <= 15 ? " — save your notes" : ""}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [kids, setKids] = useState<Kid[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [stationery, setStationery] = useState<StationeryItem[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [view, setView] = useState<View>({ tab: "kids", kidId: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [pendingStockId, setPendingStockId] = useState<string | null>(null);

  const showError = useCallback((message: string | null) => { if (message) { setNotice(""); setError(message); } }, []);
  const showNotice = useCallback((message: string) => { setError(""); setNotice(message); }, []);

  const loaders = useMemo(() => ({
    kids: async () => setKids((await readJson<{ kids: Kid[] }>("/api/kids")).kids),
    drives: async () => setDrives((await readJson<{ drives: Drive[] }>("/api/drives")).drives),
    codes: async () => setCodes((await readJson<{ codes: Code[] }>("/api/codes")).codes),
    stationery: async () => setStationery((await readJson<{ items: StationeryItem[] }>("/api/stationery")).items),
    chapters: async () => setChapters((await readJson<{ chapters: Chapter[] }>("/api/chapters")).chapters),
  }), []);

  /** Reloads only the named resources, in parallel, and reports failures in the page alert. */
  const reload = useCallback(async (...names: (keyof typeof loaders)[]) => {
    try { await Promise.all(names.map((name) => loaders[name]())); }
    catch (reason) { showError(errorMessage(reason, "Could not refresh the dashboard.")); }
  }, [loaders, showError]);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then(async (response) => {
        const result = await response.json().catch(() => ({})) as { user?: User; error?: string };
        if (response.status === 401 || !result.user) {
          if (response.ok || response.status === 401) { router.replace("/"); return null; }
          throw new Error(result.error ?? "Your session could not be loaded.");
        }
        return result.user;
      })
      .then(async (signedIn) => {
        if (!signedIn || !alive) return;
        setUser(signedIn);
        setView(parseView(window.location.search));
        const isCoordinator = signedIn.role === "admin" || signedIn.role === "manager";
        await Promise.all([
          loaders.kids(), loaders.drives(),
          signedIn.role === "admin" ? loaders.chapters() : null,
          signedIn.role !== "volunteer" ? loaders.stationery() : null,
          isCoordinator ? loaders.codes() : null,
        ]);
      })
      .catch((reason: unknown) => { if (alive) showError(errorMessage(reason, "Could not load your session.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loaders, router, showError]);

  // Browser back/forward moves between tabs and child pages.
  useEffect(() => {
    const handlePop = () => setView(parseView(window.location.search));
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Success messages fade on their own; errors stay until dismissed.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const navigate = useCallback((next: View) => {
    setView(next);
    setError("");
    window.history.pushState(null, "", viewUrl(next));
    window.scrollTo({ top: 0 });
  }, []);

  const copy = useCallback((value: string) => {
    navigator.clipboard?.writeText(value).then(() => showNotice("Code copied to clipboard."), () => showError("Could not copy. Select the code and copy it manually."));
  }, [showError, showNotice]);

  async function runConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    try { await confirm.action(); setConfirm(null); }
    catch (reason) { setConfirm(null); showError(errorMessage(reason, "That action could not be completed.")); }
    finally { setConfirmBusy(false); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/");
  }

  if (loading) return <main className="dashboard-loading" aria-busy="true"><BrandMark /><p>Opening your learning space…</p></main>;
  if (!user) return <main className="dashboard-loading"><BrandMark /><p>{error || "Your session could not be loaded."}</p><Link className="primary-action" href="/">Back to sign in</Link></main>;

  const isCoordinator = user.role === "admin" || user.role === "manager";
  const allowedTabs: Tab[] = ["kids", "drives", ...(isCoordinator ? ["codes" as const] : []), ...(user.role !== "volunteer" ? ["stationery" as const] : []), ...(user.role === "admin" ? ["chapters" as const] : [])];
  const tab = allowedTabs.includes(view.tab) ? view.tab : "kids";
  const selectedKid = tab === "kids" && view.kidId ? kids.find((kid) => kid.id === view.kidId) ?? null : null;
  const counts: Record<Tab, number> = { kids: kids.length, drives: drives.length, codes: codes.length, stationery: stationery.length, chapters: chapters.length };
  // Volunteer sessions last 2 hours, so they get a countdown; coordinator sessions last weeks.
  const showTimer = user.role === "volunteer";

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <Link className="brand" href="/dashboard" onClick={(event) => { event.preventDefault(); navigate({ tab: "kids", kidId: null }); }} aria-label="VidyaLog dashboard home">
          <BrandMark /><span className="brand-name">Vidya<span>Log</span></span>
        </Link>
        <div className="user-area">
          <span className="user-avatar" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span>
          <span className="user-label"><strong>{user.displayName}</strong><small>{roleNames[user.role]}{user.chapter ? ` · ${user.chapter}` : ""}</small></span>
          <button type="button" className="signout-button" onClick={signOut}><Icon name="logout" size={16} /><span>Sign out</span></button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow-label">Kids’ learning journeys</span>
            <h1>Hello, {user.displayName.split(" ")[0]}</h1>
            <p>{user.role === "volunteer" ? "Thank you for teaching today." : "Keep every child’s learning journey moving forward."}</p>
          </div>
          <div className="heading-side">
            {showTimer && user.expiresAt && <SessionTimer expiresAt={user.expiresAt} />}
            {isCoordinator && <button type="button" className="primary-action" onClick={() => setModal({ type: "kid", kid: null })}><Icon name="plus" size={16} />Add a child</button>}
          </div>
        </div>

        <div className="toast-region" aria-live="polite">
          {error && <div className="alert alert-error" role="alert"><Icon name="alert" /><span>{error}</span><button type="button" className="icon-button" onClick={() => setError("")} aria-label="Dismiss message"><Icon name="x" size={16} /></button></div>}
          {notice && <div className="alert alert-success" role="status"><Icon name="check" /><span>{notice}</span><button type="button" className="icon-button" onClick={() => setNotice("")} aria-label="Dismiss message"><Icon name="x" size={16} /></button></div>}
        </div>

        <nav className="dashboard-tabs" aria-label="Dashboard sections">
          {allowedTabs.map((item) => (
            <button key={item} type="button" aria-current={tab === item ? "page" : undefined} className={tab === item ? "active" : ""} onClick={() => navigate({ tab: item, kidId: null })}>
              <Icon name={tabLabels[item].icon} size={17} />{tabLabels[item].label}<span className="tab-count">{counts[item]}</span>
            </button>
          ))}
        </nav>

        {tab === "kids" && (selectedKid
          ? <KidDetail
              key={selectedKid.id}
              kid={selectedKid}
              user={user}
              canManageKids={isCoordinator}
              onBack={() => navigate({ tab: "kids", kidId: null })}
              onEdit={() => setModal({ type: "kid", kid: selectedKid })}
              onSaved={(message) => { showNotice(message); void reload("kids", "drives"); }}
              onError={showError}
            />
          : <ChildrenTab kids={kids} user={user} chapters={chapters} onOpen={(kid) => navigate({ tab: "kids", kidId: kid.id })} />)}

        {tab === "drives" && <DrivesTab drives={drives} user={user} />}

        {tab === "codes" && (
          <CodesTab
            codes={codes}
            user={user}
            onCopy={copy}
            onCreate={(preset) => setModal({ type: "code", preset })}
            onRevoke={(code) => setConfirm({
              title: `Revoke ${code.displayName}’s code?`,
              message: <p>They will be signed out immediately{code.role === "volunteer" ? " and any unsaved session notes will be lost" : ""}. This cannot be undone.</p>,
              confirmLabel: "Revoke code",
              tone: "danger",
              action: async () => { await readJson(`/api/codes/${code.id}`, { method: "DELETE" }); await reload("codes"); showNotice("Access code revoked."); },
            })}
            onResetAdmin={() => setConfirm({
              title: "Reset the admin code?",
              message: <><p>A new admin code will be created and <strong>every previous admin code will stop working</strong>. Other devices signed in as admin will be signed out.</p><p>You will stay signed in here. Save the new code somewhere safe.</p></>,
              confirmLabel: "Reset admin code",
              tone: "danger",
              action: async () => {
                const result = await readJson<{ code: string }>("/api/codes/admin-reset", { method: "POST" });
                await reload("codes");
                setModal({ type: "codeReveal", code: result.code, name: "your admin access" });
              },
            })}
          />
        )}

        {tab === "stationery" && (
          <StationeryTab
            items={stationery}
            user={user}
            chapters={chapters}
            canManage={isCoordinator}
            pendingId={pendingStockId}
            onAdd={() => setModal({ type: "stationery", item: null })}
            onEdit={(item) => setModal({ type: "stationery", item })}
            onAdjust={async (item, delta) => {
              setPendingStockId(item.id);
              try {
                const result = await readJson<{ quantity: number; updatedAt: string }>(`/api/stationery/${item.id}`, { method: "PATCH", body: JSON.stringify({ delta }) });
                setStationery((items) => items.map((entry) => entry.id === item.id ? { ...entry, quantity: result.quantity, updatedAt: result.updatedAt } : entry));
              } catch (reason) { showError(errorMessage(reason, "Could not update stock.")); }
              finally { setPendingStockId(null); }
            }}
            onRemove={(item) => setConfirm({
              title: `Remove ${item.name}?`,
              message: <p>{item.name} will be removed from the {item.chapter} stationery list.</p>,
              confirmLabel: "Remove item",
              tone: "danger",
              action: async () => { await readJson(`/api/stationery/${item.id}`, { method: "DELETE" }); await reload("stationery"); showNotice(`${item.name} removed from the list.`); },
            })}
          />
        )}

        {tab === "chapters" && <ChaptersTab chapters={chapters} kids={kids} onAdd={() => setModal({ type: "chapter" })} />}
      </div>

      {modal?.type === "kid" && (
        <KidFormModal
          kid={modal.kid}
          user={user}
          chapters={chapters}
          onClose={() => setModal(null)}
          onSaved={(message) => { setModal(null); showNotice(message); void reload("kids"); }}
        />
      )}
      {modal?.type === "code" && (
        <CodeFormModal
          preset={modal.preset}
          user={user}
          kids={kids}
          codes={codes}
          chapters={chapters}
          onClose={() => setModal(null)}
          onCreated={(code, name) => { setModal({ type: "codeReveal", code, name }); void reload("codes"); }}
        />
      )}
      {modal?.type === "codeReveal" && <CodeRevealModal code={modal.code} name={modal.name} onCopy={copy} onClose={() => setModal(null)} />}
      {modal?.type === "stationery" && (
        <StationeryFormModal item={modal.item} user={user} chapters={chapters} onClose={() => setModal(null)} onSaved={(message) => { setModal(null); showNotice(message); void reload("stationery"); }} />
      )}
      {modal?.type === "chapter" && <ChapterFormModal onClose={() => setModal(null)} onSaved={(message) => { setModal(null); showNotice(message); void reload("chapters"); }} />}
      {confirm && <ConfirmDialog options={confirm} busy={confirmBusy} onCancel={() => setConfirm(null)} onConfirm={runConfirm} />}
    </main>
  );
}
