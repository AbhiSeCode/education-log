import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { encryptAccessCode, generateUniqueAccessCode, hashSecret, type AccessCode } from "@/lib/auth";
import { ensureIndexes, getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const expected = process.env.ADMIN_SETUP_SECRET;
    if (!expected || expected.length < 24) return NextResponse.json({ error: "Admin setup is not enabled. Set an ADMIN_SETUP_SECRET of at least 24 characters." }, { status: 503 });
    const body = await request.json().catch(() => null) as { secret?: unknown; displayName?: unknown } | null;
    const provided = typeof body?.secret === "string" ? hashSecret(body.secret) : "";
    const expectedHash = hashSecret(expected);
    if (provided.length !== expectedHash.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expectedHash))) {
      return NextResponse.json({ error: "Setup credentials are not valid." }, { status: 401 });
    }
    const db = await getDb();
    await ensureIndexes();
    const codes = db.collection<AccessCode>("accessCodes");
    if (await codes.findOne({ role: "admin", revokedAt: { $exists: false } })) {
      return NextResponse.json({ error: "An active admin code already exists." }, { status: 409 });
    }
    const code = await generateUniqueAccessCode(codes);
    await codes.insertOne({
      _id: new ObjectId(),
      displayName: typeof body?.displayName === "string" && body.displayName.trim() ? body.displayName.trim().slice(0, 80) : "First admin",
      codeHash: hashSecret(code),
      encryptedCode: encryptAccessCode(code),
      role: "admin",
      chapter: null,
      kidIds: [],
      createdAt: new Date(),
      expiresAt: null,
      createdBy: null,
    });
    return NextResponse.json({ code, message: "Save this code now. It will not be shown again." }, { status: 201 });
  } catch (error) {
    console.error("Admin bootstrap failed", error);
    return NextResponse.json({ error: "Admin setup is temporarily unavailable." }, { status: 503 });
  }
}
