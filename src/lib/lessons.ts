// Shared by the lesson API and the dashboard so both validate against the same options.
export const SUBJECTS = ["Reading", "Writing", "Maths", "English", "Hindi", "Science", "Art & craft", "General knowledge", "Other"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const PROGRESS_LEVELS = [
  { value: 1, label: "Needs help", hint: "Found it hard today" },
  { value: 2, label: "Getting there", hint: "Understood with support" },
  { value: 3, label: "Confident", hint: "Can do it on their own" },
] as const;
export type ProgressLevel = (typeof PROGRESS_LEVELS)[number]["value"];

/** One subject covered in a session, with how the child did in it. A session can cover several subjects. */
export type SubjectEntry = { subject: Subject; progress: ProgressLevel | null };

export function parseSubject(value: unknown): Subject | null {
  return typeof value === "string" && (SUBJECTS as readonly string[]).includes(value) ? value as Subject : null;
}

export function parseProgress(value: unknown): ProgressLevel | null {
  const number = Number(value);
  return PROGRESS_LEVELS.some((level) => level.value === number) ? number as ProgressLevel : null;
}

/** Validates a list of { subject, progress } entries, dropping unknown subjects and duplicates. */
export function parseSubjects(value: unknown): SubjectEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = new Map<Subject, SubjectEntry>();
  for (const item of value.slice(0, SUBJECTS.length)) {
    const subject = parseSubject((item as { subject?: unknown } | null)?.subject);
    if (subject && !entries.has(subject)) entries.set(subject, { subject, progress: parseProgress((item as { progress?: unknown }).progress) });
  }
  return [...entries.values()];
}

/** Notes saved before multi-subject support stored a single subject/progress pair. */
export function lessonSubjects(lesson: { subjects?: SubjectEntry[] | null; subject?: Subject | null; progress?: ProgressLevel | null }): SubjectEntry[] {
  if (lesson.subjects?.length) return lesson.subjects;
  return lesson.subject ? [{ subject: lesson.subject, progress: lesson.progress ?? null }] : [];
}
