"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { relativeDay } from "./api";
import { Icon } from "./Icon";
import type { Chapter, Kid, User } from "./types";

export function KidAvatar({ kid, large = false }: { kid: Kid; large?: boolean }) {
  const size = large ? 72 : 48;
  // Photos are served from an authenticated route, so Next image optimization is skipped (it would fetch without the session cookie).
  return kid.imageUrl
    ? <Image className={`kid-avatar ${large ? "large" : ""}`} src={kid.imageUrl} alt="" width={size} height={size} unoptimized />
    : <span className={`kid-avatar avatar-${(kid.initial.charCodeAt(0) % 5) + 1} ${large ? "large" : ""}`} aria-hidden="true">{kid.initial}</span>;
}

export function ChildrenTab({ kids, user, chapters, onOpen }: { kids: Kid[]; user: User; chapters: Chapter[]; onOpen: (kid: Kid) => void }) {
  const [query, setQuery] = useState("");
  const [chapter, setChapter] = useState("");
  const isVolunteer = user.role === "volunteer";
  const showChapterFilter = user.role === "admin" && chapters.length > 1;

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-IN");
    return kids.filter((kid) => (!term || kid.name.toLocaleLowerCase("en-IN").includes(term)) && (!chapter || kid.chapter === chapter));
  }, [kids, query, chapter]);
  const doneCount = kids.filter((kid) => kid.notedThisDrive).length;

  return (
    <>
      <div className="section-intro">
        <div>
          <h2>{isVolunteer ? "Your children today" : "Children"}</h2>
          <p>{isVolunteer ? "Open a child to see where the last volunteer left off, then record today’s session." : "Choose a child to see their learning story."}</p>
        </div>
      </div>

      {isVolunteer && kids.length > 0 && (
        <div className="drive-progress" role="status">
          <div className="drive-progress-text">
            <strong>{doneCount === kids.length ? "All session notes recorded — thank you!" : `${doneCount} of ${kids.length} session notes recorded`}</strong>
            <span>Each child needs one note per drive.</span>
          </div>
          <div className="progress-track" aria-hidden="true"><span style={{ width: `${(doneCount / kids.length) * 100}%` }} /></div>
        </div>
      )}

      {kids.length > 6 && (
        <div className="list-toolbar">
          <label className="search-field">
            <Icon name="search" />
            <span className="sr-only">Search children</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" />
          </label>
          {showChapterFilter && (
            <label className="select-field">
              <span className="sr-only">Filter by chapter</span>
              <select value={chapter} onChange={(event) => setChapter(event.target.value)}>
                <option value="">All chapters</option>
                {chapters.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {visible.length ? (
        <div className="kids-grid">
          {visible.map((kid) => (
            <button type="button" className={`kid-card ${isVolunteer && kid.notedThisDrive ? "is-done" : ""}`} key={kid.id} onClick={() => onOpen(kid)}>
              <KidAvatar kid={kid} />
              <span className="kid-card-text">
                <strong>{kid.name}</strong>
                <small>{kid.age} years · {kid.goesToSchool ? "In school" : "Not in school"}{user.role === "admin" ? ` · ${kid.chapter}` : ""}</small>
                <span className="kid-card-last">
                  <Icon name="clock" size={14} />
                  {kid.lastLessonAt ? `Last session: ${relativeDay(kid.lastLessonAt)}` : "No sessions yet"}
                </span>
              </span>
              {isVolunteer && kid.notedThisDrive
                ? <span className="kid-done-badge"><Icon name="check" size={14} />Done</span>
                : <Icon name="chevronRight" className="kid-arrow" />}
            </button>
          ))}
        </div>
      ) : kids.length ? (
        <div className="empty-state"><Icon name="search" size={22} /><strong>No children match</strong><p>Try a different name or chapter.</p></div>
      ) : (
        <div className="empty-state">
          <Icon name="sparkle" size={22} />
          <strong>No children to show yet</strong>
          <p>{user.role === "admin" || user.role === "manager" ? "Add the first child profile to get started." : "Your coordinator will assign children to your code."}</p>
        </div>
      )}
    </>
  );
}
