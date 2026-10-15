import type { SubjectEntry } from "@/lib/lessons";

export type Role = "admin" | "manager" | "reviewer" | "volunteer";
export type User = { displayName: string; role: Role; chapter: string | null; expiresAt: string | null };
export type Kid = {
  id: string; name: string; age: number; gender: string; goesToSchool: boolean; chapter: string;
  imageUrl: string | null; initial: string; lastLessonAt: string | null; notedThisDrive: boolean;
};
export type Lesson = {
  id: string; volunteerName: string; taught: string; homework: string; subjects: SubjectEntry[];
  privateFeedback: string | null; editablePrivateFeedback?: string | null; createdAt: string;
  source?: "pre_vidyalog" | "session"; dateKnown?: boolean; canEdit?: boolean;
};
export type Drive = {
  id: string; driveDate: string; chapter: string; volunteerNames: string[];
  teachers: { name: string; childNames: string[] }[]; childNames: string[]; createdAt: string; status: string;
};
export type Code = {
  id: string; displayName: string; role: Role; chapter: string | null; kidIds: string[]; kidNames: string[];
  accessCode: string | null; createdAt: string; expiresAt: string | null; revokedAt: string | null; expired: boolean;
};
export type StationeryItem = { id: string; chapter: string; name: string; quantity: number; updatedAt: string };
export type Chapter = { id: string; name: string; createdAt: string };

export const TABS = ["kids", "drives", "codes", "stationery", "chapters"] as const;
export type Tab = (typeof TABS)[number];

export const roleNames: Record<Role, string> = { admin: "Admin", manager: "Manager", reviewer: "Reviewer", volunteer: "Volunteer" };

export type CodePreset = { role: Role | ""; displayName: string; kidIds: string[] };
