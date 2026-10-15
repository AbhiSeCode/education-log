import type { Code } from "./types";

export const SESSION_ENDED_URL = "/?session=ended";

/** Thrown after a 401; the page is already navigating back to sign in, so callers should not show it as an error. */
export class SessionEndedError extends Error {}

export async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers } });
  const value = await response.json().catch(() => ({})) as T & { error?: string };
  if (response.status === 401) {
    window.location.replace(SESSION_ENDED_URL);
    throw new SessionEndedError(value.error ?? "Your session has ended.");
  }
  if (!response.ok) throw new Error(value.error ?? "Something went wrong.");
  return value;
}

/** Returns a message to show, or null when the error needs no message (the session ended and sign-in is loading). */
export function errorMessage(reason: unknown, fallback: string) {
  if (reason instanceof SessionEndedError) return null;
  return reason instanceof Error ? reason.message : fallback;
}

export function prettyDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export function prettyDriveDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T00:00:00+05:30`));
}

/** "Today", "Yesterday", "5 days ago", or a date for anything older than a month. */
export function relativeDay(date: string, now = Date.now()) {
  const dayKey = (time: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(time);
  const days = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(Date.parse(date)))) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return shortDate(date);
}

export function codeIsActive(code: Code) {
  return !code.revokedAt && (!code.expiresAt || Date.parse(code.expiresAt) > Date.now());
}

export async function compressPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("This photo format is not supported. Choose a JPG, PNG, or WebP image."); });
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this photo.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (mime: string, quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not compress this photo.")), mime, quality));
  let blob = await encode("image/webp", 0.78);
  if (blob.type !== "image/webp") blob = await encode("image/jpeg", 0.78);
  if (blob.size > 450 * 1024) blob = await encode(blob.type, 0.58);
  if (blob.size > 500 * 1024) throw new Error("This photo is still too large after compression. Choose another image.");
  const type = blob.type;
  return new File([blob], `child-photo.${type === "image/webp" ? "webp" : "jpg"}`, { type });
}
