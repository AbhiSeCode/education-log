"use client";

import { useMemo, useState } from "react";
import { prettyDate, prettyDriveDate } from "./api";
import { Icon } from "./Icon";
import type { Chapter, Drive, Kid, StationeryItem, User } from "./types";

export function DrivesTab({ drives, user }: { drives: Drive[]; user: User }) {
  return (
    <>
      <div className="section-intro">
        <div>
          <h2>Drive days</h2>
          <p>{user.role === "volunteer" ? "Drives you took part in." : "Who taught which children on each drive day."}</p>
        </div>
      </div>
      {drives.length ? (
        <div className="card-list">
          {drives.map((drive) => (
            <article className="drive-card" key={drive.id}>
              <span className="row-icon"><Icon name="calendar" /></span>
              <div className="drive-info">
                <div className="drive-title">
                  <strong>{prettyDriveDate(drive.driveDate)}</strong>
                  <span className={`status-pill ${drive.status === "in_progress" ? "is-live" : ""}`}>{drive.status === "in_progress" ? "Today" : "Completed"}</span>
                </div>
                <div className="drive-numbers">
                  <span><Icon name="users" size={15} />{drive.volunteerNames.length} {drive.volunteerNames.length === 1 ? "volunteer" : "volunteers"}</span>
                  <span><Icon name="book" size={15} />{drive.childNames.length} {drive.childNames.length === 1 ? "child" : "children"} taught</span>
                  {user.role === "admin" && <span><Icon name="home" size={15} />{drive.chapter}</span>}
                </div>
                {drive.teachers.length ? (
                  <ul className="drive-teachers">
                    {drive.teachers.map((teacher) => <li key={teacher.name}><strong>{teacher.name}</strong> taught {teacher.childNames.join(", ")}</li>)}
                  </ul>
                ) : <p className="muted-text">{drive.volunteerNames.length ? `${drive.volunteerNames.join(", ")} signed in · no session notes yet` : "No session notes yet"}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><Icon name="calendar" size={22} /><strong>No drives recorded yet</strong><p>A drive appears here when a volunteer signs in on a drive day.</p></div>
      )}
    </>
  );
}

export function ChaptersTab({ chapters, kids, onAdd }: { chapters: Chapter[]; kids: Kid[]; onAdd: () => void }) {
  return (
    <>
      <div className="section-intro">
        <div><h2>Chapters</h2><p>Chapters organize children, access codes, and stationery.</p></div>
        <button type="button" className="primary-action" onClick={onAdd}><Icon name="plus" size={16} />Add a chapter</button>
      </div>
      {chapters.length ? (
        <div className="chapter-cards">
          {chapters.map((chapter) => {
            const count = kids.filter((kid) => kid.chapter === chapter.name).length;
            return (
              <article className="chapter-card" key={chapter.id}>
                <span className="row-icon"><Icon name="home" /></span>
                <div><strong>{chapter.name}</strong><small>{count} {count === 1 ? "child" : "children"}</small></div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state"><Icon name="home" size={22} /><strong>No chapters yet</strong><p>Add a chapter to start organizing children and drives.</p></div>
      )}
    </>
  );
}

type StationeryProps = {
  items: StationeryItem[];
  user: User;
  chapters: Chapter[];
  canManage: boolean;
  pendingId: string | null;
  onAdd: () => void;
  onEdit: (item: StationeryItem) => void;
  onAdjust: (item: StationeryItem, delta: number) => void;
  onRemove: (item: StationeryItem) => void;
};

const LOW_STOCK = 5;

export function StationeryTab({ items, user, chapters, canManage, pendingId, onAdd, onEdit, onAdjust, onRemove }: StationeryProps) {
  const [chapter, setChapter] = useState("");
  const visible = useMemo(() => items.filter((item) => !chapter || item.chapter === chapter), [items, chapter]);
  const lowCount = items.filter((item) => item.quantity <= LOW_STOCK).length;

  return (
    <>
      <div className="section-intro">
        <div>
          <h2>Drive stationery</h2>
          <p>{user.role === "admin" ? "Current stock across all chapters." : `Current stock · ${user.chapter}`}{lowCount ? ` · ${lowCount} running low` : ""}</p>
        </div>
        {canManage && <button type="button" className="primary-action" onClick={onAdd}><Icon name="plus" size={16} />Add an item</button>}
      </div>
      {user.role === "admin" && chapters.length > 1 && items.length > 0 && (
        <div className="list-toolbar">
          <label className="select-field">
            <span className="sr-only">Filter by chapter</span>
            <select value={chapter} onChange={(event) => setChapter(event.target.value)}>
              <option value="">All chapters</option>
              {chapters.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
            </select>
          </label>
        </div>
      )}
      {visible.length ? (
        <div className="card-list">
          {visible.map((item) => {
            const pending = pendingId === item.id;
            return (
              <article className="stationery-row" key={item.id}>
                <div className="stationery-item-info">
                  <strong>{item.name}</strong>
                  <small>{user.role === "admin" ? `${item.chapter} · ` : ""}Updated {prettyDate(item.updatedAt)}</small>
                </div>
                <div className="stationery-quantity">
                  <strong>{item.quantity}</strong>
                  {item.quantity === 0 ? <span className="status-pill is-danger">Out of stock</span> : item.quantity <= LOW_STOCK ? <span className="status-pill is-warning">Low</span> : <span className="muted-text">in stock</span>}
                </div>
                {canManage && (
                  <div className="stationery-actions">
                    <div className="stepper" role="group" aria-label={`${item.name} quantity`}>
                      <button type="button" onClick={() => onAdjust(item, -1)} disabled={pending || item.quantity === 0} aria-label={`Decrease ${item.name} by one`}><Icon name="minus" size={16} /></button>
                      <button type="button" onClick={() => onAdjust(item, 1)} disabled={pending} aria-label={`Increase ${item.name} by one`}><Icon name="plus" size={16} /></button>
                    </div>
                    <button type="button" className="secondary-action compact" onClick={() => onEdit(item)}>Edit</button>
                    <button type="button" className="icon-button is-danger" onClick={() => onRemove(item)} aria-label={`Remove ${item.name}`}><Icon name="trash" size={17} /></button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state"><Icon name="package" size={22} /><strong>No stationery listed yet</strong><p>{canManage ? "Add the items available for your chapter." : "The chapter’s available stationery will appear here."}</p></div>
      )}
    </>
  );
}
