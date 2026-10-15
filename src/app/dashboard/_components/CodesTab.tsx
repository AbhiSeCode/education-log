"use client";

import { useMemo, useState } from "react";
import { codeIsActive, prettyDate } from "./api";
import { Icon, type IconName } from "./Icon";
import { roleNames, type Code, type CodePreset, type Role, type User } from "./types";

type Status = "active" | "ended" | "all";
const roleIcons: Record<Role, IconName> = { admin: "lock", manager: "home", reviewer: "book", volunteer: "pencil" };

type Props = {
  codes: Code[];
  user: User;
  onCreate: (preset: CodePreset) => void;
  onRevoke: (code: Code) => void;
  onResetAdmin: () => void;
  onCopy: (value: string) => void;
};

export function CodesTab({ codes, user, onCreate, onRevoke, onResetAdmin, onCopy }: Props) {
  const [status, setStatus] = useState<Status>("active");
  const [role, setRole] = useState<Role | "">("");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const active = codes.filter(codeIsActive).length;
    return { active, ended: codes.length - active, all: codes.length };
  }, [codes]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-IN");
    return codes.filter((code) => {
      const active = codeIsActive(code);
      if (status === "active" && !active) return false;
      if (status === "ended" && active) return false;
      if (role && code.role !== role) return false;
      return !term || code.displayName.toLocaleLowerCase("en-IN").includes(term) || code.kidNames.some((name) => name.toLocaleLowerCase("en-IN").includes(term));
    });
  }, [codes, status, role, query]);

  const canRevoke = (code: Code) => codeIsActive(code) && code.role !== "admin" && !(user.role === "manager" && code.role === "manager");

  return (
    <>
      <div className="section-intro">
        <div><h2>Access codes</h2><p>Share a code with each volunteer, reviewer, or manager. Active codes stay visible here.</p></div>
        <div className="section-actions">
          {user.role === "admin" && <button type="button" className="secondary-action" onClick={onResetAdmin}><Icon name="refresh" size={16} />Reset admin code</button>}
          {user.role === "manager" && <button type="button" className="secondary-action" onClick={() => onCreate({ role: "volunteer", displayName: user.displayName, kidIds: [] })}>Volunteer code for me</button>}
          <button type="button" className="primary-action" onClick={() => onCreate({ role: "", displayName: "", kidIds: [] })}><Icon name="plus" size={16} />Create a code</button>
        </div>
      </div>

      <div className="list-toolbar">
        <div className="segmented" role="group" aria-label="Filter by status">
          {(["active", "ended", "all"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>
              {value === "active" ? "Active" : value === "ended" ? "Ended" : "All"} <span>{counts[value]}</span>
            </button>
          ))}
        </div>
        <label className="select-field">
          <span className="sr-only">Filter by role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as Role | "")}>
            <option value="">All roles</option>
            {(["volunteer", "reviewer", "manager", "admin"] as const).filter((item) => user.role === "admin" || item !== "admin").map((item) => <option key={item} value={item}>{roleNames[item]}</option>)}
          </select>
        </label>
        <label className="search-field">
          <Icon name="search" />
          <span className="sr-only">Search codes</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or child" />
        </label>
      </div>

      {visible.length ? (
        <div className="card-list">
          {visible.map((code) => {
            const active = codeIsActive(code);
            return (
              <article className={`code-row ${active ? "" : "is-ended"}`} key={code.id}>
                <div className="code-person">
                  <span className="row-icon"><Icon name={roleIcons[code.role] ?? "key"} /></span>
                  <div>
                    <strong>{code.displayName}</strong>
                    <small>{roleNames[code.role] ?? code.role} · {code.chapter ?? "All chapters"}</small>
                    {code.kidNames.length > 0 && <small className="code-kids">Children: {code.kidNames.join(", ")}</small>}
                  </div>
                </div>
                <div className="code-expiry">
                  <span className={`status-pill ${active ? "is-live" : code.revokedAt ? "is-danger" : ""}`}>{code.revokedAt ? "Revoked" : active ? "Active" : "Expired"}</span>
                  <small>{code.expiresAt ? `${active ? "Expires" : "Ended"} ${prettyDate(code.revokedAt ?? code.expiresAt)}` : "No expiry"}</small>
                </div>
                <div className="code-secret">
                  {code.accessCode
                    ? <><code>{code.accessCode}</code><button type="button" className="icon-button" onClick={() => onCopy(code.accessCode!)} aria-label={`Copy code for ${code.displayName}`}><Icon name="copy" size={17} /></button></>
                    : <small>{active ? "Older code · not viewable" : "Code hidden"}</small>}
                </div>
                <div className="code-row-actions">
                  {code.role === "volunteer" && code.kidIds.length > 0 && (
                    active
                      ? <small className="muted-text" title="Children can only have one active volunteer code at a time.">Repeat available after this code ends</small>
                      : <button type="button" className="secondary-action compact" onClick={() => onCreate({ role: "volunteer", displayName: "", kidIds: code.kidIds })}>Repeat assignment</button>
                  )}
                  {canRevoke(code) && <button type="button" className="danger-link" onClick={() => onRevoke(code)}>Revoke</button>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state"><Icon name="key" size={22} /><strong>{codes.length ? "No codes match these filters" : "No codes yet"}</strong><p>{codes.length ? "Try another status, role, or name." : "Create a code for a volunteer or reviewer to get started."}</p></div>
      )}
    </>
  );
}
