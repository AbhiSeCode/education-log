import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/db";

export const SESSION_COOKIE = "seekho_session";
export type Role = "admin" | "manager" | "reviewer" | "volunteer";

export type AccessCode = {
  _id: ObjectId;
  displayName: string;
  codeHash: string;
  encryptedCode?: string;
  role: Role;
  chapter: string | null;
  kidIds: ObjectId[];
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt?: Date;
  createdBy: ObjectId | null;
};

export type SessionRecord = {
  _id: ObjectId;
  tokenHash: string;
  codeId: ObjectId;
  role: Role;
  displayName: string;
  chapter: string | null;
  kidIds: ObjectId[];
  driveId: ObjectId | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");

function accessCodeEncryptionKey() {
  const encryptionSecret = process.env.ACCESS_CODE_ENCRYPTION_KEY;
  if (!encryptionSecret || encryptionSecret.length < 32) throw new Error("ACCESS_CODE_ENCRYPTION_KEY is required to protect access codes.");
  return createHash("sha256").update(`vidyalog-access-codes:${encryptionSecret}`).digest();
}

export function encryptAccessCode(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", accessCodeEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptAccessCode(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted access code.");
  const decipher = createDecipheriv("aes-256-gcm", accessCodeEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

// Six letters from a 24-letter alphabet gives ~191M combinations; sign-in is also rate limited per IP.
export const ACCESS_CODE_LENGTH = 6;

export function generateAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: ACCESS_CODE_LENGTH }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export async function generateUniqueAccessCode(codes: Collection<AccessCode>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateAccessCode();
    if (!await codes.findOne({ codeHash: hashSecret(code) }, { projection: { _id: 1 } })) return code;
  }
  throw new Error("Unable to generate a unique access code.");
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function getSession(): Promise<SessionRecord | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  // One round trip: the session and the status of the code it came from, so a revoked code ends the session immediately.
  const [found] = await db.collection<SessionRecord>("sessions").aggregate<SessionRecord & { code: Pick<AccessCode, "revokedAt" | "expiresAt">[] }>([
    { $match: { tokenHash: hashSecret(token) } },
    { $limit: 1 },
    { $lookup: { from: "accessCodes", localField: "codeId", foreignField: "_id", as: "code", pipeline: [{ $project: { revokedAt: 1, expiresAt: 1 } }] } },
  ]).toArray();
  const now = new Date();
  if (!found || (found.expiresAt && found.expiresAt <= now)) return null;
  const code = found.code[0];
  if (!code || code.revokedAt || (code.expiresAt && code.expiresAt <= now)) return null;
  const session: SessionRecord & { code?: unknown } = { ...found };
  delete session.code;
  return session;
}

export function canReadChapter(session: SessionRecord, chapter: string) {
  return session.role === "admin" || session.chapter === chapter;
}

export function canReadKid(session: SessionRecord, kidId: ObjectId, chapter: string) {
  if (session.role === "admin") return true;
  if (session.role === "volunteer") return session.kidIds.some((id) => id.equals(kidId));
  return session.chapter === chapter;
}

/** 401 when the session is missing or ended (the client sends the user back to sign in), 403 when the role is not allowed. */
export function accessDenied(session: SessionRecord | null, message: string) {
  if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again.", sessionExpired: true }, { status: 401 });
  return NextResponse.json({ error: message }, { status: 403 });
}
