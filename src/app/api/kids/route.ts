import { NextResponse } from "next/server";
import { Binary, ObjectId } from "mongodb";
import { accessDenied, canReadKid, getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

type KidRecord = {
  _id: ObjectId;
  name: string;
  age: number;
  gender: string;
  goesToSchool: boolean;
  chapter: string;
  hasImage?: boolean;
  createdAt: Date;
  updatedAt?: Date;
};

type KidActivity = { lastLessonAt?: Date | null; notedThisDrive?: boolean };

function serializeKid(kid: KidRecord, activity: KidActivity = {}) {
  return {
    lastLessonAt: activity.lastLessonAt?.toISOString() ?? null,
    notedThisDrive: activity.notedThisDrive ?? false,
    id: kid._id.toString(), name: kid.name, age: kid.age, gender: kid.gender,
    goesToSchool: kid.goesToSchool, chapter: kid.chapter,
    // The version query changes when the profile is updated, so a new photo is not hidden by the old one.
    imageUrl: kid.hasImage ? `/api/kids/${kid._id.toString()}/photo?v=${(kid.updatedAt ?? kid.createdAt).getTime()}` : null,
    initial: kid.name.trim().slice(0, 1).toUpperCase(),
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in to view children." }, { status: 401 });
    const db = await getDb();
    const query = session.role === "admin"
      ? {}
      : session.role === "volunteer"
        ? { _id: { $in: session.kidIds } }
        : { chapter: session.chapter ?? "__no_chapter__" };
    const kids = (await db.collection<KidRecord>("kids").find(query).sort({ name: 1 }).toArray())
      .filter((kid) => canReadKid(session, kid._id, kid.chapter));
    const kidIds = kids.map((kid) => kid._id);
    const [latest, notedThisDrive] = kidIds.length ? await Promise.all([
      db.collection("lessons").aggregate<{ _id: ObjectId; lastLessonAt: Date }>([
        { $match: { childId: { $in: kidIds }, dateKnown: { $ne: false } } },
        { $group: { _id: "$childId", lastLessonAt: { $max: "$createdAt" } } },
      ]).toArray(),
      session.role === "volunteer" && session.driveId
        ? db.collection("lessons").distinct("childId", { childId: { $in: kidIds }, driveId: session.driveId, volunteerCodeId: session.codeId })
        : Promise.resolve([] as ObjectId[]),
    ]) : [[], []];
    const lastByKid = new Map(latest.map((item) => [item._id.toString(), item.lastLessonAt]));
    const noted = new Set((notedThisDrive as ObjectId[]).map(String));
    return NextResponse.json({ kids: kids.map((kid) => serializeKid(kid, { lastLessonAt: lastByKid.get(kid._id.toString()) ?? null, notedThisDrive: noted.has(kid._id.toString()) })) });
  } catch {
    return NextResponse.json({ error: "Children are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) return accessDenied(session, "Only admins and managers can add children.");
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim().slice(0, 100);
    const age = Number(form.get("age"));
    const gender = String(form.get("gender") ?? "").trim();
    const goesToSchool = String(form.get("goesToSchool")) === "true";
    const chapter = session.role === "admin" ? String(form.get("chapter") ?? "") : session.chapter ?? "";
    const image = form.get("image");
    if (!name || !Number.isInteger(age) || age < 1 || age > 100 || !["Girl", "Boy"].includes(gender)) {
      return NextResponse.json({ error: "Check the child’s name, age, gender, school status, and chapter." }, { status: 400 });
    }
    if (image !== null && image !== "" && !(image instanceof File && image.size === 0) && (!(image instanceof File) || !["image/jpeg", "image/webp"].includes(image.type) || image.size > 500 * 1024)) {
      return NextResponse.json({ error: "Choose a compressed JPG or WebP image up to 500 KB." }, { status: 400 });
    }

    const db = await getDb();
    if (!chapter || !await db.collection("chapters").findOne({ name: chapter }, { projection: { _id: 1 } })) {
      return NextResponse.json({ error: "Choose a valid chapter." }, { status: 400 });
    }
    const id = new ObjectId();
    let hasImage = false;
    if (image instanceof File && image.size > 0) {
      await db.collection("kidPhotos").insertOne({ kidId: id, data: new Binary(Buffer.from(await image.arrayBuffer())), contentType: image.type, updatedAt: new Date() });
      hasImage = true;
    }
    const kid: KidRecord = { _id: id, name, age, gender, goesToSchool, chapter, createdAt: new Date(), ...(hasImage ? { hasImage: true } : {}) };
    try { await db.collection<KidRecord>("kids").insertOne(kid); }
    catch (error) {
      if (hasImage) await db.collection("kidPhotos").deleteOne({ kidId: id }).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ kid: serializeKid(kid) }, { status: 201 });
  } catch (error) {
    console.error("Child profile creation failed", error);
    return NextResponse.json({ error: "Could not save this child profile." }, { status: 503 });
  }
}
