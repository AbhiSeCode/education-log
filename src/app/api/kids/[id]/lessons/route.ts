import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { accessDenied, canReadKid, getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lessonSubjects, parseSubjects, type ProgressLevel, type Subject, type SubjectEntry } from "@/lib/lessons";

type KidAccess = { _id: ObjectId; chapter: string; name: string };
type Lesson = {
  _id: ObjectId;
  childId: ObjectId;
  driveId?: ObjectId | null;
  volunteerName: string;
  taught: string;
  homework: string;
  privateFeedback: string;
  subjects?: SubjectEntry[];
  /** Legacy single-subject fields from notes saved before multi-subject support. */
  subject?: Subject | null;
  progress?: ProgressLevel | null;
  createdAt: Date;
  source?: "pre_vidyalog" | "session";
  dateKnown?: boolean;
  volunteerCodeId?: ObjectId;
};

type NoteBody = { taught?: unknown; homework?: unknown; privateFeedback?: unknown; subjects?: unknown };

function readNote(body: NoteBody | null) {
  return {
    taught: typeof body?.taught === "string" ? body.taught.trim().slice(0, 4000) : "",
    homework: typeof body?.homework === "string" ? body.homework.trim().slice(0, 2000) : "",
    privateFeedback: typeof body?.privateFeedback === "string" ? body.privateFeedback.trim().slice(0, 2000) : "",
    subjects: parseSubjects(body?.subjects),
  };
}

export async function GET(_request: Request, context: RouteContext<"/api/kids/[id]/lessons">) {
  try {
    const session = await getSession();
    if (!session) return accessDenied(session, "");
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Child not found." }, { status: 404 });
    const db = await getDb();
    const childId = new ObjectId(id);
    const kid = await db.collection<KidAccess>("kids").findOne({ _id: childId });
    if (!kid || !canReadKid(session, childId, kid.chapter)) return NextResponse.json({ error: "Child not found." }, { status: 404 });
    const lessons = await db.collection<Lesson>("lessons").find({ childId }).sort({ createdAt: -1 }).toArray();
    const latestVolunteerLesson = session.role === "volunteer" && session.driveId
      ? await db.collection<Lesson>("lessons").findOne({ childId, driveId: session.driveId, volunteerCodeId: session.codeId, source: { $ne: "pre_vidyalog" } }, { sort: { createdAt: -1 } })
      : null;
    return NextResponse.json({
      kid: { id: kid._id.toString(), name: kid.name },
      lessons: lessons.map((lesson) => {
        const canEdit = Boolean(latestVolunteerLesson && lesson._id.equals(latestVolunteerLesson._id));
        return {
          id: lesson._id.toString(), driveId: lesson.driveId?.toString() ?? null, volunteerName: lesson.volunteerName,
          taught: lesson.taught, homework: lesson.homework, subjects: lessonSubjects(lesson),
          privateFeedback: session.role === "volunteer" ? null : lesson.privateFeedback,
          source: lesson.source ?? "session", dateKnown: lesson.dateKnown ?? true,
          canEdit,
          editablePrivateFeedback: canEdit ? lesson.privateFeedback : null,
          createdAt: lesson.createdAt.toISOString(),
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Learning history is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request, context: RouteContext<"/api/kids/[id]/lessons">) {
  try {
    const session = await getSession();
    if (!session || !["volunteer", "admin", "manager"].includes(session.role)) return accessDenied(session, "Only volunteers, admins, and managers can add learning history.");
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Child not found." }, { status: 404 });
    const body = await request.json().catch(() => null) as (NoteBody & { source?: unknown; date?: unknown }) | null;
    const isHistorical = ["admin", "manager"].includes(session.role) && body?.source === "pre_vidyalog";
    if (session.role === "volunteer" && body?.source !== undefined) return NextResponse.json({ error: "Volunteers can only add session notes." }, { status: 403 });
    if (["admin", "manager"].includes(session.role) && !isHistorical) return NextResponse.json({ error: "Admins and managers can only append historical learning entries." }, { status: 403 });
    const note = readNote(body);
    if (!note.taught && !note.homework && !note.privateFeedback) return NextResponse.json({ error: "Add a lesson note, homework, or private feedback." }, { status: 400 });
    const dateString = typeof body?.date === "string" ? body.date : "";
    if (isHistorical && dateString && !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return NextResponse.json({ error: "Enter a valid date." }, { status: 400 });
    const db = await getDb();
    const childId = new ObjectId(id);
    const kid = await db.collection<KidAccess>("kids").findOne({ _id: childId });
    if (!kid || !canReadKid(session, childId, kid.chapter)) return NextResponse.json({ error: "Child not found." }, { status: 404 });
    if (!isHistorical && !session.driveId) return NextResponse.json({ error: "Start a volunteer drive before adding notes." }, { status: 409 });
    const now = isHistorical && dateString ? new Date(`${dateString}T12:00:00.000Z`) : new Date();
    if (isHistorical && Number.isNaN(now.getTime())) return NextResponse.json({ error: "Enter a valid date." }, { status: 400 });
    if (isHistorical && now.getTime() > Date.now() + 24 * 60 * 60 * 1000) return NextResponse.json({ error: "Past history cannot have a future date." }, { status: 400 });
    const doc = {
      _id: new ObjectId(), childId, driveId: isHistorical ? null : session.driveId, chapter: kid.chapter,
      volunteerName: isHistorical ? "Before VidyaLog" : session.displayName, volunteerCodeId: session.codeId, userRole: session.role,
      ...note, createdAt: now, source: isHistorical ? "pre_vidyalog" : "session", dateKnown: !isHistorical || Boolean(dateString),
    };
    const duplicate = NextResponse.json({ error: "You already have session notes for this child today. Edit your latest entry instead." }, { status: 409 });
    if (!isHistorical) {
      const previous = await db.collection<Lesson>("lessons").findOne({ childId, driveId: session.driveId, volunteerCodeId: session.codeId, source: { $ne: "pre_vidyalog" } }, { projection: { _id: 1 } });
      if (previous) return duplicate;
    }
    try { await db.collection("lessons").insertOne(doc); }
    catch (error) {
      // The unique "one_note_per_drive" index catches two submits that race past the check above.
      if ((error as { code?: number }).code === 11000) return duplicate;
      throw error;
    }
    if (!isHistorical && session.driveId) await db.collection("drives").updateOne({ _id: session.driveId }, { $addToSet: { kidIds: childId }, $set: { updatedAt: now } });
    return NextResponse.json({ lesson: { id: doc._id.toString(), volunteerName: doc.volunteerName, taught: note.taught, homework: note.homework, createdAt: now.toISOString() } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save this session note." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/kids/[id]/lessons">) {
  try {
    const session = await getSession();
    if (!session || session.role !== "volunteer" || !session.driveId) return accessDenied(session, "Only an active volunteer can edit session notes.");
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Child not found." }, { status: 404 });
    const body = await request.json().catch(() => null) as (NoteBody & { lessonId?: unknown }) | null;
    if (typeof body?.lessonId !== "string" || !ObjectId.isValid(body.lessonId)) return NextResponse.json({ error: "Choose a valid note to update." }, { status: 400 });
    const note = readNote(body);
    if (!note.taught && !note.homework && !note.privateFeedback) return NextResponse.json({ error: "Add a lesson note, homework, or private feedback." }, { status: 400 });
    const db = await getDb();
    const childId = new ObjectId(id);
    const kid = await db.collection<KidAccess>("kids").findOne({ _id: childId });
    if (!kid || !canReadKid(session, childId, kid.chapter)) return NextResponse.json({ error: "Child not found." }, { status: 404 });
    const collection = db.collection<Lesson>("lessons");
    const latest = await collection.findOne({ childId, driveId: session.driveId, volunteerCodeId: session.codeId, source: { $ne: "pre_vidyalog" } }, { sort: { createdAt: -1 } });
    const lessonId = new ObjectId(body.lessonId);
    if (!latest || !latest._id.equals(lessonId)) return NextResponse.json({ error: "Only your latest note from this drive can be edited." }, { status: 403 });
    const updatedAt = new Date();
    await collection.updateOne({ _id: lessonId, childId, driveId: session.driveId, volunteerCodeId: session.codeId }, { $set: { ...note, updatedAt }, $unset: { subject: "", progress: "" } });
    return NextResponse.json({ updated: true, updatedAt: updatedAt.toISOString() });
  } catch {
    return NextResponse.json({ error: "Could not update this session note." }, { status: 503 });
  }
}
