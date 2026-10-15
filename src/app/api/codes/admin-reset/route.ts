import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { accessDenied, encryptAccessCode, generateUniqueAccessCode, getSession, hashSecret, type AccessCode } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return accessDenied(session, "Only an admin can reset the admin code.");
    const db = await getDb();
    const now = new Date();
    const codes = db.collection<AccessCode>("accessCodes");
    const code = await generateUniqueAccessCode(codes);
    const replacement: AccessCode = {
      _id: new ObjectId(), displayName: session.displayName, codeHash: hashSecret(code), encryptedCode: encryptAccessCode(code), role: "admin",
      chapter: null, kidIds: [], createdAt: now, expiresAt: null, createdBy: session.codeId,
    };
    await codes.insertOne(replacement);
    const priorAdmins = await db.collection<AccessCode>("accessCodes").find({ role: "admin", _id: { $ne: replacement._id }, revokedAt: { $exists: false } }, { projection: { _id: 1 } }).toArray();
    const priorAdminIds = priorAdmins.map((item) => item._id);
    await db.collection<AccessCode>("accessCodes").updateMany({ _id: { $in: priorAdminIds } }, { $set: { revokedAt: now } });
    await db.collection("sessions").updateMany({ codeId: { $in: priorAdminIds }, _id: { $ne: session._id } }, { $set: { expiresAt: now } });
    await db.collection("sessions").updateOne({ _id: session._id }, { $set: { codeId: replacement._id, displayName: session.displayName, role: "admin", chapter: null, kidIds: [], expiresAt: null } });
    return NextResponse.json({ code, message: "Save this admin code now. The previous admin code has been revoked." });
  } catch (error) {
    console.error("Admin code reset failed", error);
    return NextResponse.json({ error: "Could not reset the admin code." }, { status: 503 });
  }
}
