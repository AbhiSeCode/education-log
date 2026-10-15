import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { SESSION_COOKIE, type AccessCode, type Role, type SessionRecord, hashSecret, normalizeCode } from "@/lib/auth";
import { ensureIndexes, getDb } from "@/lib/db";
import { chapterDriveDate } from "@/lib/drives";

const ttlMs: Partial<Record<Role, number>> = {
  volunteer: 2 * 60 * 60 * 1000,
  reviewer: 30 * 24 * 60 * 60 * 1000,
  manager: 30 * 24 * 60 * 60 * 1000,
};
const MAX_FAILURES_PER_WINDOW = 10;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { code?: unknown } | null;
    const normalizedCode = typeof body?.code === "string" ? normalizeCode(body.code) : "";
    // Current codes are 6 letters; earlier 5-letter and longer legacy codes stay valid until they expire.
    if (!body || typeof body.code !== "string" || normalizedCode.length < 5 || normalizedCode.length > 80) {
      return NextResponse.json({ error: "Enter a valid access code." }, { status: 400 });
    }

    const db = await getDb();
    // Indexes already exist after the first run; build them in the background instead of delaying sign-in.
    ensureIndexes().catch((error) => console.error("Index setup failed", error));
    const now = new Date();
    const forwarded = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const ipHash = hashSecret(forwarded);
    const attempts = db.collection("authAttempts");
    // Both lookups run together to save a database round trip, but the limit is still enforced before the code
    // result is used, so a blocked client cannot keep guessing until one matches.
    const [recentFailures, code] = await Promise.all([
      attempts.countDocuments({ ipHash, createdAt: { $gte: new Date(now.getTime() - 15 * 60 * 1000) } }),
      db.collection<AccessCode>("accessCodes").findOne({ codeHash: hashSecret(normalizedCode) }),
    ]);
    if (recentFailures >= MAX_FAILURES_PER_WINDOW) return NextResponse.json({ error: "Too many incorrect attempts. Wait 15 minutes, then try again." }, { status: 429 });

    if (!code || code.revokedAt || (code.expiresAt && code.expiresAt <= now) || (code.role !== "admin" && !code.chapter)) {
      await attempts.insertOne({ ipHash, createdAt: now, expiresAt: new Date(now.getTime() + 60 * 60 * 1000) });
      return NextResponse.json({ error: "That code is invalid or has expired. Ask your coordinator for help." }, { status: 401 });
    }

    const maxExpiry = ttlMs[code.role] ? new Date(now.getTime() + ttlMs[code.role]!) : null;
    const expiresAt = code.expiresAt && maxExpiry
      ? new Date(Math.min(code.expiresAt.getTime(), maxExpiry.getTime()))
      : code.expiresAt ?? maxExpiry;
    const sessionToken = randomBytes(32).toString("base64url");
    const sessionId = new ObjectId();
    let driveId: ObjectId | null = null;

    if (code.role === "volunteer") {
      const chapter = code.chapter!;
      const driveDate = chapterDriveDate(now);
      const drives = db.collection("drives");
      const dailyDrive = {
        $setOnInsert: { _id: new ObjectId(), chapter, driveDate, kidIds: [], createdAt: now, status: "in_progress" },
        $addToSet: { volunteerCodeIds: code._id, volunteerNames: code.displayName, assignedKidIds: { $each: code.kidIds } },
        $set: { updatedAt: now },
      };
      const options = { returnDocument: "after" as const, projection: { _id: 1 } };
      let drive;
      try {
        drive = await drives.findOneAndUpdate({ chapter, driveDate }, dailyDrive, { ...options, upsert: true });
      } catch (error) {
        // Two volunteers signing in at the same moment can race on the upsert; the second one joins the drive the first created.
        if ((error as { code?: number }).code !== 11000) throw error;
        drive = await drives.findOneAndUpdate({ chapter, driveDate }, dailyDrive, options);
      }
      driveId = (drive?._id as ObjectId | undefined) ?? null;
    }

    const session: SessionRecord = {
      _id: sessionId,
      tokenHash: hashSecret(sessionToken),
      codeId: code._id,
      role: code.role,
      displayName: code.displayName,
      chapter: code.chapter,
      kidIds: code.kidIds,
      driveId,
      createdAt: now,
      expiresAt,
    };
    await db.collection<SessionRecord>("sessions").insertOne(session);

    const response = NextResponse.json({
      user: { displayName: code.displayName, role: code.role, chapter: code.chapter },
      expiresAt: expiresAt?.toISOString() ?? null,
    });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(expiresAt ? { expires: expiresAt } : {}),
    });
    return response;
  } catch (error) {
    console.error("Access-code sign-in failed", error);
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
