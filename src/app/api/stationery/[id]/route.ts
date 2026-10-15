import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { accessDenied, getSession } from "@/lib/auth";
import { ensureIndexes, getDb } from "@/lib/db";

function canManage(role: string) {
  return role === "admin" || role === "manager";
}

function chapterScope(session: { role: string; chapter: string | null }) {
  return session.role === "admin" ? {} : { chapter: session.chapter ?? "__no_chapter__" };
}

export async function PATCH(request: Request, context: RouteContext<"/api/stationery/[id]">) {
  try {
    const session = await getSession();
    if (!session || !canManage(session.role)) return accessDenied(session, "Only admins and managers can update stationery.");
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Stationery item not found." }, { status: 404 });
    const body = await request.json().catch(() => null) as { name?: unknown; quantity?: unknown; delta?: unknown; chapter?: unknown } | null;
    await ensureIndexes();
    const db = await getDb();
    const filter = { _id: new ObjectId(id), ...chapterScope(session) };

    // Relative +/- changes use $inc so two people adjusting stock at once do not overwrite each other.
    if (body && Object.hasOwn(body, "delta")) {
      const delta = Number(body.delta);
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000000) return NextResponse.json({ error: "Enter a whole-number change." }, { status: 400 });
      const bounds = delta < 0 ? { quantity: { $gte: -delta } } : { quantity: { $lte: 1000000 - delta } };
      const updated = await db.collection("stationery").findOneAndUpdate({ ...filter, ...bounds }, { $inc: { quantity: delta }, $set: { updatedAt: new Date() } }, { returnDocument: "after" });
      if (!updated) {
        const exists = await db.collection("stationery").countDocuments(filter);
        return exists
          ? NextResponse.json({ error: "Stock cannot go below 0 or above 1,000,000." }, { status: 400 })
          : NextResponse.json({ error: "Stationery item not found." }, { status: 404 });
      }
      return NextResponse.json({ updated: true, quantity: updated.quantity, updatedAt: (updated.updatedAt as Date).toISOString() });
    }

    const set: { name?: string; nameKey?: string; quantity?: number; chapter?: string; updatedAt: Date } = { updatedAt: new Date() };
    if (body && Object.hasOwn(body, "name")) {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      if (!name) return NextResponse.json({ error: "Enter an item name." }, { status: 400 });
      set.name = name;
      set.nameKey = name.toLocaleLowerCase("en-IN");
    }
    if (body && Object.hasOwn(body, "quantity")) {
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) return NextResponse.json({ error: "Quantity must be a whole number from 0 to 1,000,000." }, { status: 400 });
      set.quantity = quantity;
    }
    if (body && Object.hasOwn(body, "chapter") && session.role === "admin") {
      const chapter = typeof body.chapter === "string" ? body.chapter : "";
      if (!chapter || !await db.collection("chapters").findOne({ name: chapter }, { projection: { _id: 1 } })) return NextResponse.json({ error: "Choose a valid chapter." }, { status: 400 });
      set.chapter = chapter;
    }
    if (Object.keys(set).length === 1) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    try {
      const result = await db.collection("stationery").updateOne(filter, { $set: set });
      if (!result.matchedCount) return NextResponse.json({ error: "Stationery item not found." }, { status: 404 });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "This item is already listed for this chapter." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ updated: true });
  } catch {
    return NextResponse.json({ error: "Could not update this stationery item." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/stationery/[id]">) {
  try {
    const session = await getSession();
    if (!session || !canManage(session.role)) return accessDenied(session, "Only admins and managers can remove stationery.");
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Stationery item not found." }, { status: 404 });
    const db = await getDb();
    const result = await db.collection("stationery").deleteOne({ _id: new ObjectId(id), ...chapterScope(session) });
    if (!result.deletedCount) return NextResponse.json({ error: "Stationery item not found." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Could not remove this stationery item." }, { status: 503 });
  }
}
