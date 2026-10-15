"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PROGRESS_LEVELS, SUBJECTS, type ProgressLevel, type Subject, type SubjectEntry } from "@/lib/lessons";
import { errorMessage, prettyDate, readJson, relativeDay } from "./api";
import { KidAvatar } from "./ChildrenTab";
import { Icon } from "./Icon";
import type { Kid, Lesson, User } from "./types";

const progressLabel = (value: ProgressLevel) => PROGRESS_LEVELS.find((level) => level.value === value)?.label ?? "";

function LessonTags({ lesson }: { lesson: Lesson }) {
  if (!lesson.subjects.length) return null;
  return (
    <div className="lesson-tags">
      {lesson.subjects.map((entry) => (
        <span key={entry.subject} className={`tag ${entry.progress ? `progress-${entry.progress}` : ""}`}>
          {entry.subject}{entry.progress ? ` · ${progressLabel(entry.progress)}` : ""}
        </span>
      ))}
    </div>
  );
}

/** Pick any number of subjects for today; each picked subject gets its own progress choice. */
function SubjectPicker({ value, onChange }: { value: SubjectEntry[]; onChange: (value: SubjectEntry[]) => void }) {
  const picked = new Set(value.map((entry) => entry.subject));
  const toggle = (subject: Subject) => onChange(picked.has(subject) ? value.filter((entry) => entry.subject !== subject) : [...value, { subject, progress: null }]);
  const setProgress = (subject: Subject, progress: ProgressLevel) => onChange(value.map((entry) => entry.subject === subject ? { ...entry, progress } : entry));

  return (
    <fieldset className="subject-picker">
      <legend>Subjects covered today <span className="field-hint">Choose all that apply</span></legend>
      <div className="subject-chips">
        {SUBJECTS.map((subject) => (
          <button key={subject} type="button" className="subject-chip" aria-pressed={picked.has(subject)} onClick={() => toggle(subject)}>
            {picked.has(subject) && <Icon name="check" size={14} />}{subject}
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <div className="subject-progress-list">
          {value.map((entry) => (
            <div key={entry.subject} className="subject-progress-row" role="radiogroup" aria-label={`How did ${entry.subject} go?`}>
              <strong>{entry.subject}</strong>
              <div className="progress-options">
                {PROGRESS_LEVELS.map((level) => (
                  <label key={level.value} className={`progress-option progress-${level.value}`} title={level.hint}>
                    <input type="radio" name={`progress-${entry.subject}`} value={level.value} checked={entry.progress === level.value} onChange={() => setProgress(entry.subject, level.value)} />
                    <span>{level.label}</span>
                  </label>
                ))}
              </div>
              <button type="button" className="icon-button" onClick={() => toggle(entry.subject)} aria-label={`Remove ${entry.subject}`}><Icon name="x" size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function SessionForm({ kid, editableLesson, onSaved }: { kid: Kid; editableLesson: Lesson | undefined; onSaved: (message: string) => void }) {
  const [subjects, setSubjects] = useState<SubjectEntry[]>(editableLesson?.subjects ?? []);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      await readJson(`/api/kids/${kid.id}/lessons`, {
        method: editableLesson ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(editableLesson ? { lessonId: editableLesson.id } : {}),
          subjects, taught: form.get("taught"), homework: form.get("homework"), privateFeedback: form.get("privateFeedback"),
        }),
      });
      onSaved(editableLesson ? "Your session note was updated." : `Session note saved for ${kid.name}.`);
    } catch (reason) {
      const message = errorMessage(reason, "Could not save the session notes.");
      if (message) setFormError(message);
    } finally { setBusy(false); }
  }

  return (
    <form className="session-form" onSubmit={submit}>
      <div className="session-form-title">
        <span className="session-form-icon"><Icon name="pencil" /></span>
        <div>
          <strong>{editableLesson ? "Edit today’s session note" : "Record today’s session"}</strong>
          <small>{editableLesson ? "You can keep improving this note until your session ends." : "One note per child for this drive. Add every subject you covered."}</small>
        </div>
      </div>
      {formError && <div className="alert alert-error" role="alert"><Icon name="alert" />{formError}</div>}
      <SubjectPicker value={subjects} onChange={setSubjects} />
      <label>What did you teach today?<textarea name="taught" rows={3} defaultValue={editableLesson?.taught ?? ""} placeholder="Topics, activities, or progress…" /></label>
      <label>Homework to practise<textarea name="homework" rows={2} defaultValue={editableLesson?.homework ?? ""} placeholder="What should they work on before next time?" /></label>
      <label>Private feedback <span className="field-hint">Only managers, reviewers, and admins can see this.</span><textarea name="privateFeedback" rows={2} defaultValue={editableLesson?.editablePrivateFeedback ?? ""} placeholder="Anything helpful for the team to know…" /></label>
      <button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : editableLesson ? "Update note" : "Save session note"}</button>
    </form>
  );
}

type Props = {
  kid: Kid;
  user: User;
  canManageKids: boolean;
  onBack: () => void;
  onEdit: () => void;
  onSaved: (message: string) => void;
  onError: (message: string | null) => void;
};

export function KidDetail({ kid, user, canManageKids, onBack, onEdit, onSaved, onError }: Props) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [version, setVersion] = useState(0);
  const canAddLesson = user.role === "volunteer";

  // Parent renders this with key={kid.id}, so switching children starts fresh and a slow response for one child cannot overwrite another's.
  useEffect(() => {
    let alive = true;
    readJson<{ lessons: Lesson[] }>(`/api/kids/${kid.id}/lessons`)
      .then((result) => { if (alive) setLessons(result.lessons); })
      .catch((reason: unknown) => { if (alive) { setLessons([]); onError(errorMessage(reason, "Could not load learning history.")); } });
    return () => { alive = false; };
  }, [kid.id, version, onError]);

  const editableLesson = lessons?.find((lesson) => lesson.canEdit);
  const previousLesson = lessons?.find((lesson) => !lesson.canEdit);

  const subjectProgress = useMemo(() => {
    const latest = new Map<Subject, SubjectEntry>();
    for (const lesson of lessons ?? []) {
      for (const entry of lesson.subjects) if (entry.progress && !latest.has(entry.subject)) latest.set(entry.subject, entry);
    }
    return [...latest.values()];
  }, [lessons]);

  return (
    <section className="kid-detail">
      <button type="button" className="text-back" onClick={onBack}><Icon name="arrowLeft" size={16} />All children</button>

      <div className="detail-profile">
        <KidAvatar kid={kid} large />
        <div className="detail-profile-text">
          <span className="eyebrow-label">Child profile · {kid.chapter}</span>
          <h2>{kid.name}</h2>
          <p>{kid.age} years · {kid.gender} · {kid.goesToSchool ? "Goes to school" : "Not currently in school"}</p>
        </div>
        {canManageKids && <button type="button" className="secondary-action" onClick={onEdit}><Icon name="pencil" size={16} />Edit profile</button>}
      </div>

      {lessons && lessons.length > 0 && (
        <div className="kid-stats">
          <div><strong>{lessons.length}</strong><span>{lessons.length === 1 ? "learning entry" : "learning entries"}</span></div>
          <div><strong>{kid.lastLessonAt ? relativeDay(kid.lastLessonAt) : "—"}</strong><span>last session</span></div>
          <div className="kid-stats-subjects">
            <span>Progress by subject</span>
            {subjectProgress.length ? (
              <div className="lesson-tags">
                {subjectProgress.map((entry) => <span key={entry.subject} className={`tag progress-${entry.progress}`}>{entry.subject}: {progressLabel(entry.progress!)}</span>)}
              </div>
            ) : <small>Add a subject and progress to session notes to see this.</small>}
          </div>
        </div>
      )}

      {previousLesson && (
        <article className="last-time-card">
          <div className="last-time-heading">
            <span className="last-time-icon"><Icon name="book" /></span>
            <div className="last-time-title">
              <strong>Last time</strong>
              <small>{previousLesson.dateKnown === false ? "Date not recorded" : relativeDay(previousLesson.createdAt)} · {previousLesson.volunteerName}</small>
            </div>
            <LessonTags lesson={previousLesson} />
          </div>
          {previousLesson.taught && <p><b>What they learned:</b> {previousLesson.taught}</p>}
          {previousLesson.homework && <p className="last-time-homework"><Icon name="homework" size={16} /><span><b>Homework to check:</b> {previousLesson.homework}</span></p>}
        </article>
      )}

      {canAddLesson && lessons && (
        <SessionForm
          key={editableLesson?.id ?? "new"}
          kid={kid}
          editableLesson={editableLesson}
          onSaved={(message) => { setVersion((value) => value + 1); onSaved(message); }}
        />
      )}

      <div className="history-heading">
        <div><h3>Learning history</h3><p>Every session, newest first.</p></div>
      </div>

      {lessons === null ? (
        <div className="lesson-list" aria-busy="true">{[0, 1].map((item) => <div key={item} className="skeleton-row" />)}</div>
      ) : lessons.length ? (
        <ol className="lesson-list">
          {lessons.map((lesson) => (
            <li className="lesson-card-row" key={lesson.id}>
              <div className="lesson-date" aria-hidden="true">
                <span>{lesson.dateKnown === false ? "—" : new Date(lesson.createdAt).toLocaleDateString("en-IN", { day: "2-digit" })}</span>
                <small>{lesson.dateKnown === false ? "" : new Date(lesson.createdAt).toLocaleDateString("en-IN", { month: "short" })}</small>
              </div>
              <div className="lesson-content">
                <div className="lesson-meta">
                  <strong>
                    {lesson.volunteerName}
                    {lesson.source === "pre_vidyalog" && <small className="history-badge">Past history</small>}
                    {lesson.canEdit && <small className="history-badge is-mine">Your note today</small>}
                  </strong>
                  <time dateTime={lesson.createdAt}>{lesson.dateKnown === false ? "Date not recorded" : prettyDate(lesson.createdAt)}</time>
                </div>
                <LessonTags lesson={lesson} />
                {lesson.taught && <p><b>Lesson:</b> {lesson.taught}</p>}
                {lesson.homework && <p><b>Homework:</b> {lesson.homework}</p>}
                {lesson.privateFeedback && <p className="private-feedback"><b>Team note:</b> {lesson.privateFeedback}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-state"><Icon name="sparkle" size={22} /><strong>A fresh page</strong><p>No session notes yet. {canAddLesson ? "Yours will be the first." : "The first volunteer can start the story here."}</p></div>
      )}
    </section>
  );
}
