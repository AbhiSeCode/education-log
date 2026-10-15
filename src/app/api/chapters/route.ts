import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { accessDenied, getSession } from "@/lib/auth";
import { ensureIndexes, getDb } from "@/lib/db";

type Chapter = { _id: ObjectId; name: string; nameKey: string; createdAt: Date };

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return accessDenied(session, "Only admins can manage chapters.");
    const db = await getDb();
    const chapters = db.collection<Chapter>("chapters");
    let result = await chapters.find().sort({ name: 1 }).toArray();
    // Saket is the initial chapter for this deployment; future chapters are admin-created.
    if (!result.some((chapter) => chapter.nameKey === "saket")) {
      await ensureIndexes();
      await chapters.updateOne(
        { nameKey: "saket" },
        { $setOnInsert: { _id: new ObjectId(), name: "Saket", nameKey: "saket", createdAt: new Date() } },
        { upsert: true },
      );
      result = await chapters.find().sort({ name: 1 }).toArray();
    }
    return NextResponse.json({ chapters: result.map(({ _id, name, createdAt }) => ({ id: _id.toString(), name, createdAt: createdAt.toISOString() })) });
  } catch {
    return NextResponse.json({ error: "Chapters are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return accessDenied(session, "Only admins can add chapters.");
    const body = await request.json().catch(() => null) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 60) : "";
    if (!name || !/[\p{L}\p{N}]/u.test(name)) return NextResponse.json({ error: "Enter a valid chapter name." }, { status: 400 });
    await ensureIndexes();
    const db = await getDb();
    const chapter: Chapter = { _id: new ObjectId(), name, nameKey: name.toLocaleLowerCase("en-IN"), createdAt: new Date() };
    try { await db.collection<Chapter>("chapters").insertOne(chapter); }
    catch (error) {
      if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "A chapter with this name already exists." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ chapter: { id: chapter._id.toString(), name: chapter.name, createdAt: chapter.createdAt.toISOString() } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not add this chapter." }, { status: 503 });
  }
}
