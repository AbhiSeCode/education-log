import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { accessDenied, getSession } from "@/lib/auth";
import { ensureIndexes, getDb } from "@/lib/db";

type StationeryItem = {
  _id: ObjectId;
  chapter: string;
  name: string;
  nameKey: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

function serialize(item: StationeryItem) {
  return { id: item._id.toString(), chapter: item.chapter, name: item.name, quantity: item.quantity, updatedAt: item.updatedAt.toISOString() };
}

function canManage(role: string) {
  return role === "admin" || role === "manager";
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager", "reviewer"].includes(session.role)) return accessDenied(session, "Not authorized to view stationery.");
    const db = await getDb();
    const query = session.role === "admin" ? {} : { chapter: session.chapter ?? "__no_chapter__" };
    const items = await db.collection<StationeryItem>("stationery").find(query).sort({ name: 1 }).toArray();
    return NextResponse.json({ items: items.map(serialize) });
  } catch {
    return NextResponse.json({ error: "Stationery stock is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !canManage(session.role)) return accessDenied(session, "Only admins and managers can update stationery.");
    const body = await request.json().catch(() => null) as { name?: unknown; quantity?: unknown; chapter?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const quantity = Number(body?.quantity);
    const chapter = session.role === "admin" ? (typeof body?.chapter === "string" ? body.chapter : "") : session.chapter;
    if (!name || !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000 || !chapter) {
      return NextResponse.json({ error: "Enter an item name and a whole-number quantity of 0 to 1,000,000." }, { status: 400 });
    }
    await ensureIndexes();
    const db = await getDb();
    if (!await db.collection("chapters").findOne({ name: chapter }, { projection: { _id: 1 } })) return NextResponse.json({ error: "Choose a valid chapter." }, { status: 400 });
    const now = new Date();
    const item: StationeryItem = { _id: new ObjectId(), chapter, name, nameKey: name.toLocaleLowerCase("en-IN"), quantity, createdAt: now, updatedAt: now };
    try { await db.collection<StationeryItem>("stationery").insertOne(item); }
    catch (error) {
      if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "This item is already listed for this chapter." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ item: serialize(item) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not add this stationery item." }, { status: 503 });
  }
}
