import { NextResponse } from "next/server";
import { Binary, ObjectId } from "mongodb";
import { canReadKid, getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(_request: Request, context: RouteContext<"/api/kids/[id]/photo">) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in to view this photo." }, { status: 401 });
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    const db = await getDb();
    const kidId = new ObjectId(id);
    const kid = await db.collection<{ _id: ObjectId; chapter: string; hasImage?: boolean }>("kids").findOne({ _id: kidId });
    if (!kid || !canReadKid(session, kid._id, kid.chapter) || !kid.hasImage) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    const photo = await db.collection<{ kidId: ObjectId; data: Binary; contentType: string }>("kidPhotos").findOne({ kidId });
    if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    const raw = photo.data.value();
    const payload = new ArrayBuffer(raw.byteLength);
    new Uint8Array(payload).set(raw);
    return new NextResponse(payload, {
      headers: {
        "Content-Type": photo.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo service is unavailable." }, { status: 503 });
  }
}
