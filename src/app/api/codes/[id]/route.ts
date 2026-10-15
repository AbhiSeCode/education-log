import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { accessDenied, getSession, type AccessCode } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(_request: Request, context: RouteContext<"/api/codes/[id]">) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) return accessDenied(session, "Not authorized.");
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid code record." }, { status: 400 });
    const db = await getDb();
    const code = await db.collection<AccessCode>("accessCodes").findOne({ _id: new ObjectId(id) });
    if (!code || code.role === "admin") return NextResponse.json({ error: "Code record not found." }, { status: 404 });
    if (session.role === "manager" && (code.chapter !== session.chapter || code.role === "manager")) return NextResponse.json({ error: "Only an admin can revoke manager codes." }, { status: 403 });
    await db.collection("accessCodes").updateOne({ _id: code._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    await db.collection("sessions").updateMany({ codeId: code._id }, { $set: { expiresAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not revoke this code." }, { status: 503 });
  }
}
