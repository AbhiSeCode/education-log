import { NextResponse } from "next/server";
import { Binary, ObjectId } from "mongodb";
import { accessDenied, getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PUT(request: Request, context: RouteContext<"/api/kids/[id]">) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) return accessDenied(session, "Only admins and managers can update child profiles.");
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Child not found." }, { status: 404 });
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim().slice(0, 100);
    const age = Number(form.get("age"));
    const gender = String(form.get("gender") ?? "").trim();
    const goesToSchool = String(form.get("goesToSchool")) === "true";
    const image = form.get("image");
    if (!name || !Number.isInteger(age) || age < 1 || age > 100 || !["Girl", "Boy"].includes(gender)) {
      return NextResponse.json({ error: "Check the child’s name, age, and gender." }, { status: 400 });
    }
    if (image !== null && image !== "" && !(image instanceof File && image.size === 0) && (!(image instanceof File) || !["image/jpeg", "image/webp"].includes(image.type) || image.size > 500 * 1024)) {
      return NextResponse.json({ error: "Choose a compressed JPG or WebP image up to 500 KB." }, { status: 400 });
    }
    const db = await getDb();
    const kidId = new ObjectId(id);
    const kidQuery = session.role === "admin" ? { _id: kidId } : { _id: kidId, chapter: session.chapter ?? "__no_chapter__" };
    const kid = await db.collection("kids").findOne(kidQuery);
    if (!kid) return NextResponse.json({ error: "Child not found." }, { status: 404 });
    const hasNewImage = image instanceof File && image.size > 0;
    await db.collection("kids").updateOne(kidQuery, { $set: { name, age, gender, goesToSchool, updatedAt: new Date(), ...(hasNewImage ? { hasImage: true } : {}) } });
    if (hasNewImage) await db.collection("kidPhotos").updateOne(
      { kidId },
      { $set: { data: new Binary(Buffer.from(await image.arrayBuffer())), contentType: image.type, updatedAt: new Date() } },
      { upsert: true },
    );
    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Child profile update failed", error);
    return NextResponse.json({ error: "Could not update this child profile." }, { status: 503 });
  }
}
