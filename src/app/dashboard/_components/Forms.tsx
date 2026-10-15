"use client";

import { FormEvent, useEffect, useState } from "react";
import { codeIsActive, compressPhoto, errorMessage, readJson } from "./api";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import type { Chapter, Code, CodePreset, Kid, Role, StationeryItem, User } from "./types";

const MAX_VOLUNTEER_KIDS = 5;

function FormError({ message }: { message: string }) {
  return message ? <div className="alert alert-error" role="alert"><Icon name="alert" />{message}</div> : null;
}

function ChapterSelect({ chapters, value, defaultValue, onChange }: { chapters: Chapter[]; value?: string; defaultValue?: string; onChange?: (value: string) => void }) {
  return (
    <label>Chapter
      <select name="chapter" required {...(onChange ? { value, onChange: (event) => onChange(event.target.value) } : { defaultValue })}>
        {chapters.map((chapter) => <option key={chapter.id} value={chapter.name}>{chapter.name}</option>)}
      </select>
    </label>
  );
}

function HistoryFields() {
  return (
    <details className="history-fields">
      <summary>Add learning from before VidyaLog <span className="field-hint">Optional · saved as permanent, read-only history</span></summary>
      <div className="history-fields-body">
        <label>Date taught <span className="field-hint">Leave blank if unknown</span><input name="pastDate" type="date" max={new Date().toISOString().slice(0, 10)} /></label>
        <label>What had they learned?<textarea name="pastTaught" rows={3} placeholder="Topics or activities already covered" /></label>
        <label>Homework to continue<textarea name="pastHomework" rows={2} placeholder="Any practice already assigned" /></label>
        <label>Private team note <span className="field-hint">Only admins, managers, and reviewers can see this</span><textarea name="pastPrivateFeedback" rows={2} placeholder="Optional note for the team" /></label>
      </div>
    </details>
  );
}

async function appendHistoricalLesson(kidId: string, form: FormData) {
  const taught = String(form.get("pastTaught") ?? "").trim();
  const homework = String(form.get("pastHomework") ?? "").trim();
  const privateFeedback = String(form.get("pastPrivateFeedback") ?? "").trim();
  const date = String(form.get("pastDate") ?? "");
  if (!taught && !homework && !privateFeedback) return false;
  await readJson(`/api/kids/${kidId}/lessons`, { method: "POST", body: JSON.stringify({ source: "pre_vidyalog", taught, homework, privateFeedback, date }) });
  return true;
}

export function KidFormModal({ kid, user, chapters, onClose, onSaved }: { kid: Kid | null; user: User; chapters: Chapter[]; onClose: () => void; onSaved: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const image = form.get("image");
      if (image instanceof File && image.size) form.set("image", await compressPhoto(image));
      const kidId = kid
        ? (await readJson(`/api/kids/${kid.id}`, { method: "PUT", body: form }), kid.id)
        : (await readJson<{ kid: Kid }>("/api/kids", { method: "POST", body: form })).kid.id;
      let historySaved = false;
      let historyFailed = false;
      try { historySaved = await appendHistoricalLesson(kidId, form); } catch { historyFailed = true; }
      const subject = kid ? "Profile updated" : "Child profile added";
      onSaved(historyFailed ? `${subject}, but past history could not be saved. Edit the profile to add it again.` : historySaved ? `${subject} with past learning history.` : `${subject}.`);
    } catch (reason) {
      const message = errorMessage(reason, kid ? "Could not update the child." : "Could not add the child.");
      if (message) setError(message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title={kid ? "Update child profile" : "Add a child"} onClose={onClose}>
      <form className="modal-form" onSubmit={submit} encType="multipart/form-data">
        <FormError message={error} />
        <label>Child’s name<input name="name" required maxLength={100} defaultValue={kid?.name} placeholder="Full name" /></label>
        <div className="form-pair">
          <label>Age<input name="age" type="number" inputMode="numeric" required min="1" max="100" defaultValue={kid?.age} placeholder="Age" /></label>
          <label>Gender
            <select name="gender" required defaultValue={kid?.gender ?? ""}>
              <option value="" disabled>Select</option><option>Girl</option><option>Boy</option>
            </select>
          </label>
        </div>
        {kid ? null : user.role === "admin" ? <ChapterSelect chapters={chapters} defaultValue={chapters[0]?.name ?? ""} /> : <p className="field-hint">Chapter: {user.chapter}</p>}
        <label className="check-label"><input name="goesToSchool" type="checkbox" value="true" defaultChecked={kid?.goesToSchool} /> Goes to school</label>
        <label>Photo <span className="field-hint">{kid ? "Optional · leave empty to keep the current photo" : "Optional · resized and compressed before saving"}</span>
          <span className="photo-field">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimize */}
            {preview && <img src={preview} alt="Selected photo preview" />}
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }} />
          </span>
        </label>
        <HistoryFields />
        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
          <button className="primary-action" disabled={busy}>{busy ? "Saving…" : kid ? "Save changes" : "Save profile"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function CodeRevealModal({ code, name, onCopy, onClose }: { code: string; name: string; onCopy: (value: string) => void; onClose: () => void }) {
  return (
    <Modal title="Access code ready" onClose={onClose}>
      <div className="new-code-view">
        <span className="success-mark"><Icon name="check" /></span>
        <p>Share this code with <strong>{name || "the user"}</strong>. You can find it again under Access codes while it is active.</p>
        <code>{code}</code>
        <button type="button" className="primary-action" onClick={() => onCopy(code)} data-autofocus><Icon name="copy" size={16} />Copy code</button>
        <button type="button" className="secondary-action" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

type CodeFormProps = { preset: CodePreset; user: User; kids: Kid[]; codes: Code[]; chapters: Chapter[]; onClose: () => void; onCreated: (code: string, name: string) => void };

export function CodeFormModal({ preset, user, kids, codes, chapters, onClose, onCreated }: CodeFormProps) {
  const [role, setRole] = useState<Role | "">(preset.role);
  const presetChapter = kids.find((kid) => preset.kidIds.includes(kid.id))?.chapter;
  const [chapter, setChapter] = useState(user.role === "admin" ? presetChapter ?? chapters[0]?.name ?? "" : user.chapter ?? "");
  const [selected, setSelected] = useState<string[]>(preset.kidIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chapterKids = kids.filter((kid) => kid.chapter === chapter);
  const reservedBy = (kidId: string) => codes.find((code) => code.role === "volunteer" && codeIsActive(code) && code.kidIds.includes(kidId));

  function toggle(kidId: string, checked: boolean) {
    setSelected((current) => checked ? [...current, kidId] : current.filter((id) => id !== kidId));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();
    const kidIds = role === "volunteer" ? selected.filter((id) => chapterKids.some((kid) => kid.id === id)) : [];
    if (role === "volunteer" && (kidIds.length < 1 || kidIds.length > MAX_VOLUNTEER_KIDS)) { setError(`Choose between 1 and ${MAX_VOLUNTEER_KIDS} children for this volunteer.`); return; }
    setBusy(true); setError("");
    try {
      const result = await readJson<{ code: string }>("/api/codes", { method: "POST", body: JSON.stringify({ displayName, role, chapter, kidIds }) });
      onCreated(result.code, displayName);
    } catch (reason) {
      const message = errorMessage(reason, "Could not create the code.");
      if (message) setError(message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Create an access code" description="Volunteer codes last 2 hours. Manager and reviewer codes last 30 days." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <FormError message={error} />
        <label>Name<input name="displayName" required maxLength={80} defaultValue={preset.displayName} placeholder="Who is this code for?" /></label>
        <label>Role
          <select name="role" required value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="" disabled>Choose a role</option>
            <option value="volunteer">Volunteer · teaches assigned children</option>
            <option value="reviewer">Reviewer · reads notes and feedback</option>
            {user.role === "admin" && <option value="manager">Manager · runs a chapter</option>}
          </select>
        </label>
        {user.role === "admin" && <ChapterSelect chapters={chapters} value={chapter} onChange={(value) => { setChapter(value); setSelected([]); }} />}
        {role === "volunteer" && (
          <fieldset className="assign-fieldset">
            <legend>Assign children <span className={`assign-count ${selected.length > MAX_VOLUNTEER_KIDS ? "is-over" : ""}`}>{selected.length} of {MAX_VOLUNTEER_KIDS} selected</span></legend>
            <span className="field-hint">Children who already have an active volunteer code are unavailable.</span>
            {chapterKids.length ? (
              <div className="assign-list">
                {chapterKids.map((kid) => {
                  const checked = selected.includes(kid.id);
                  const reserved = reservedBy(kid.id);
                  const disabled = !checked && (Boolean(reserved) || selected.length >= MAX_VOLUNTEER_KIDS);
                  return (
                    <label className={`assign-option ${disabled ? "is-disabled" : ""}`} key={kid.id}>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => toggle(kid.id, event.target.checked)} />
                      <span>{kid.name}{reserved && !checked ? <small>with {reserved.displayName}</small> : null}</span>
                    </label>
                  );
                })}
              </div>
            ) : <p className="field-hint">No children in this chapter yet.</p>}
          </fieldset>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
          <button className="primary-action" disabled={busy}>{busy ? "Creating…" : "Create code"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function StationeryFormModal({ item, user, chapters, onClose, onSaved }: { item: StationeryItem | null; user: User; chapters: Chapter[]; onClose: () => void; onSaved: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const body = { name: form.get("name"), quantity: Number(form.get("quantity")), ...(user.role === "admin" ? { chapter: form.get("chapter") } : {}) };
      await readJson(item ? `/api/stationery/${item.id}` : "/api/stationery", { method: item ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved(item ? "Stationery item updated." : "Stationery item added.");
    } catch (reason) {
      const message = errorMessage(reason, "Could not save this item.");
      if (message) setError(message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title={item ? "Edit stationery item" : "Add stationery item"} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <FormError message={error} />
        <label>Item name<input name="name" required maxLength={80} defaultValue={item?.name ?? ""} placeholder="e.g. Pencils" /></label>
        <label>Quantity<input name="quantity" type="number" inputMode="numeric" required min="0" max="1000000" step="1" defaultValue={item?.quantity ?? 0} /></label>
        {user.role === "admin" ? <ChapterSelect chapters={chapters} defaultValue={item?.chapter ?? chapters[0]?.name ?? ""} /> : <p className="field-hint">Chapter: {user.chapter}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
          <button className="primary-action" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Add item"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ChapterFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await readJson("/api/chapters", { method: "POST", body: JSON.stringify({ name: form.get("name") }) });
      onSaved("Chapter added.");
    } catch (reason) {
      const message = errorMessage(reason, "Could not add this chapter.");
      if (message) setError(message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Add a chapter" description="New chapters are available for child profiles, access codes, and stationery." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <FormError message={error} />
        <label>Chapter name<input name="name" required maxLength={60} placeholder="e.g. Green Park" /></label>
        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
          <button className="primary-action" disabled={busy}>{busy ? "Saving…" : "Add chapter"}</button>
        </div>
      </form>
    </Modal>
  );
}
