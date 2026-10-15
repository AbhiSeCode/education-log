import { NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { chapterDriveDate } from "@/lib/drives";

type StoredDrive = {
  _id: ObjectId;
  chapter: string;
  driveDate?: string;
  createdAt: Date;
  status: string;
  volunteerName?: string;
  volunteerCodeId?: ObjectId;
  volunteerCodeIds?: ObjectId[];
  volunteerNames?: string[];
  kidIds?: ObjectId[];
};

type StoredLesson = {
  driveId: ObjectId;
  childId: ObjectId;
  volunteerName: string;
  volunteerCodeId?: ObjectId;
};

type DriveGroup = {
  id: string;
  driveDate: string;
  chapter: string;
  createdAt: Date;
  volunteerNames: Set<string>;
  childIds: Set<string>;
  teacherChildren: Map<string, Set<string>>;
  sourceDrives: StoredDrive[];
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in to view drives." }, { status: 401 });
    const db = await getDb();
    const query: Filter<StoredDrive> = session.role === "admin"
      ? {}
      : session.role === "volunteer"
        ? { $or: [{ volunteerCodeIds: session.codeId }, { volunteerCodeId: session.codeId }] }
        : { chapter: session.chapter ?? "" };
    const records = await db.collection<StoredDrive>("drives").find(query).sort({ createdAt: -1 }).limit(500).toArray();
    const driveIds = records.map((drive) => drive._id);
    const lessons = driveIds.length
      ? await db.collection<StoredLesson>("lessons").find({ driveId: { $in: driveIds } }).toArray()
      : [];
    const driveById = new Map(records.map((drive) => [drive._id.toString(), drive]));
    const allKidIds = [...new Set([
      ...records.flatMap((drive) => (drive.kidIds ?? []).map(String)),
      ...lessons.map((lesson) => lesson.childId.toString()),
    ])].map((id) => new ObjectId(id));
    const kids = allKidIds.length
      ? await db.collection("kids").find({ _id: { $in: allKidIds } }, { projection: { name: 1 } }).toArray()
      : [];
    const kidNames = new Map(kids.map((kid) => [kid._id.toString(), kid.name as string]));
    const groups = new Map<string, DriveGroup>();

    for (const drive of records) {
      const driveDate = drive.driveDate ?? chapterDriveDate(drive.createdAt);
      const key = `${drive.chapter}:${driveDate}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          id: key, driveDate, chapter: drive.chapter, createdAt: drive.createdAt,
          volunteerNames: new Set(), childIds: new Set(), teacherChildren: new Map(), sourceDrives: [],
        };
        groups.set(key, group);
      }
      group.sourceDrives.push(drive);
      if (drive.createdAt > group.createdAt) group.createdAt = drive.createdAt;
      const names = drive.volunteerNames ?? (drive.volunteerName ? [drive.volunteerName] : []);
      for (const name of names) {
        if (session.role !== "volunteer" || name === session.displayName) group.volunteerNames.add(name);
      }
      for (const kidId of drive.kidIds ?? []) {
        if (session.role !== "volunteer" || session.kidIds.some((assigned) => assigned.equals(kidId))) group.childIds.add(kidId.toString());
      }
    }

    for (const lesson of lessons) {
      const sourceDrive = driveById.get(lesson.driveId.toString());
      if (!sourceDrive) continue;
      if (session.role === "volunteer") {
        const belongsToCode = lesson.volunteerCodeId?.equals(session.codeId) || sourceDrive.volunteerCodeId?.equals(session.codeId);
        const assignedChild = session.kidIds.some((assigned) => assigned.equals(lesson.childId));
        if (!belongsToCode || !assignedChild) continue;
      }
      const driveDate = sourceDrive.driveDate ?? chapterDriveDate(sourceDrive.createdAt);
      const group = groups.get(`${sourceDrive.chapter}:${driveDate}`);
      if (!group) continue;
      group.childIds.add(lesson.childId.toString());
      group.volunteerNames.add(lesson.volunteerName);
      const children = group.teacherChildren.get(lesson.volunteerName) ?? new Set<string>();
      children.add(lesson.childId.toString());
      group.teacherChildren.set(lesson.volunteerName, children);
    }

    const today = chapterDriveDate(new Date());
    const drives = [...groups.values()]
      .sort((a, b) => b.driveDate.localeCompare(a.driveDate))
      .slice(0, 200)
      .map((drive) => {
        const visibleKidIds = [...drive.childIds].filter((id) => kidNames.has(id));
        return {
          id: drive.id,
          driveDate: drive.driveDate,
          chapter: drive.chapter,
          volunteerNames: [...drive.volunteerNames],
          childNames: visibleKidIds.map((id) => kidNames.get(id)!),
          teachers: [...drive.teacherChildren.entries()].map(([name, childIds]) => ({
            name,
            childNames: [...childIds].map((id) => kidNames.get(id)).filter((name): name is string => Boolean(name)),
          })),
          createdAt: drive.createdAt.toISOString(),
          status: drive.driveDate === today ? "in_progress" : "completed",
        };
      });
    return NextResponse.json({ drives });
  } catch {
    return NextResponse.json({ error: "Drive history is unavailable." }, { status: 503 });
  }
}
