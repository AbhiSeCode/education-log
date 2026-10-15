import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { accessDenied, decryptAccessCode, encryptAccessCode, generateUniqueAccessCode, getSession, hashSecret, type AccessCode, type Role } from "@/lib/auth";
import { getDb } from "@/lib/db";

const allowedRoles: Role[] = ["volunteer", "reviewer", "manager"];

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) return accessDenied(session, "Not authorized.");
    const db = await getDb();
    const query = session.role === "admin" ? {} : { chapter: session.chapter ?? "__no_chapter__" };
    const codes = await db.collection<AccessCode>("accessCodes").find(query).sort({ createdAt: -1 }).limit(500).toArray();
    const assignedIds = [...new Set(codes.flatMap((code) => code.kidIds.map(String)))].map((id) => new ObjectId(id));
    const kids = assignedIds.length ? await db.collection("kids").find({ _id: { $in: assignedIds } }, { projection: { name: 1 } }).toArray() : [];
    const kidNames = new Map(kids.map((kid) => [kid._id.toString(), kid.name as string]));
    const now = new Date();
    return NextResponse.json({ codes: codes.map((code) => {
      const active = !code.revokedAt && (!code.expiresAt || code.expiresAt > now);
      return {
      id: code._id.toString(), displayName: code.displayName, role: code.role, chapter: code.chapter,
      // Only active codes are decrypted; revoked or expired codes cannot be used, so there is no reason to reveal them.
      accessCode: active && code.encryptedCode ? (() => { try { return decryptAccessCode(code.encryptedCode); } catch { return null; } })() : null,
      kidIds: code.kidIds.map(String), kidNames: code.kidIds.map((id) => kidNames.get(id.toString())).filter(Boolean),
      createdAt: code.createdAt.toISOString(), expiresAt: code.expiresAt?.toISOString() ?? null,
      revokedAt: code.revokedAt?.toISOString() ?? null, expired: Boolean(code.expiresAt && code.expiresAt <= now),
      };
    }) });
  } catch {
    return NextResponse.json({ error: "Code history is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) return accessDenied(session, "Not authorized.");
    const body = await request.json().catch(() => null) as { displayName?: unknown; role?: unknown; chapter?: unknown; kidIds?: unknown } | null;
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
    const role = body?.role as Role;
    if (!displayName || !allowedRoles.includes(role)) return NextResponse.json({ error: "Enter a name and choose a valid role." }, { status: 400 });
    if (session.role === "manager" && role === "manager") return NextResponse.json({ error: "Managers cannot create other manager codes." }, { status: 403 });
    const chapter = session.role === "manager" ? session.chapter : (typeof body?.chapter === "string" ? body.chapter : "");
    if (!chapter) return NextResponse.json({ error: "Choose a valid chapter." }, { status: 400 });

    const rawKidIds = Array.isArray(body?.kidIds) ? body.kidIds : [];
    if (role === "volunteer" && (rawKidIds.length < 1 || rawKidIds.length > 5)) return NextResponse.json({ error: "Assign between 1 and 5 children to a volunteer." }, { status: 400 });
    if (role !== "volunteer" && rawKidIds.length) return NextResponse.json({ error: "Only volunteer codes can have assigned children." }, { status: 400 });
    const kidIds = rawKidIds.map((id) => typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : null);
    if (kidIds.some((id) => !id) || new Set(rawKidIds).size !== rawKidIds.length) return NextResponse.json({ error: "One or more child selections are invalid." }, { status: 400 });

    const db = await getDb();
    if (!await db.collection("chapters").findOne({ name: chapter }, { projection: { _id: 1 } })) {
      return NextResponse.json({ error: "Choose a valid chapter." }, { status: 400 });
    }
    const codes = db.collection<AccessCode>("accessCodes");
    const ids = kidIds as ObjectId[];
    if (ids.length) {
      const matched = await db.collection("kids").countDocuments({ _id: { $in: ids }, chapter });
      if (matched !== ids.length) return NextResponse.json({ error: "One or more children are outside this chapter." }, { status: 400 });
      const now = new Date();
      const alreadyAssigned = await codes.findOne({
        role: "volunteer", kidIds: { $in: ids }, expiresAt: { $gt: now }, revokedAt: { $exists: false },
      }, { projection: { displayName: 1, expiresAt: 1 } });
      if (alreadyAssigned) return NextResponse.json({ error: `One or more children are already assigned to ${alreadyAssigned.displayName} until ${alreadyAssigned.expiresAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "their code expires"}.` }, { status: 409 });
    }
    const rawCode = await generateUniqueAccessCode(codes);
    const createdAt = new Date();
    const duration = role === "volunteer" ? 2 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const doc: AccessCode = {
      _id: new ObjectId(), displayName, codeHash: hashSecret(rawCode), encryptedCode: encryptAccessCode(rawCode), role, chapter,
      kidIds: ids, createdAt, expiresAt: new Date(createdAt.getTime() + duration), createdBy: session.codeId,
    };
    await codes.insertOne(doc);
    return NextResponse.json({
      code: rawCode,
      codeRecord: { id: doc._id.toString(), displayName, role, chapter, kidIds: ids.map(String), createdAt: createdAt.toISOString(), expiresAt: doc.expiresAt?.toISOString() },
      message: "Share this code with the person it is for. Coordinators can view it in code history while it is active.",
    }, { status: 201 });
  } catch (error) {
    console.error("Code creation failed", error);
    return NextResponse.json({ error: "Could not create the access code." }, { status: 503 });
  }
}
