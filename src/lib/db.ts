import "server-only";
import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "seekho_saathi";

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
  var mongoIndexesPromise: Promise<void> | undefined;
}

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (!global.mongoClientPromise) {
    const client = new MongoClient(uri, { appName: "VidyaLog" });
    global.mongoClientPromise = client.connect().catch((error) => {
      global.mongoClientPromise = undefined;
      throw error;
    });
  }
  return (await global.mongoClientPromise).db(dbName);
}

async function createIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection("accessCodes").createIndex({ codeHash: 1 }, { unique: true }),
    db.collection("accessCodes").createIndex({ role: 1, chapter: 1, createdAt: -1 }),
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: "date" } } }),
    db.collection("kids").createIndex({ chapter: 1, name: 1 }),
    db.collection("kidPhotos").createIndex({ kidId: 1 }, { unique: true }),
    db.collection("drives").createIndex({ chapter: 1, createdAt: -1 }),
    db.collection("drives").createIndex({ chapter: 1, driveDate: 1 }, { unique: true, partialFilterExpression: { driveDate: { $type: "string" } } }),
    db.collection("lessons").createIndex({ childId: 1, createdAt: -1 }),
    db.collection("authAttempts").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("authAttempts").createIndex({ ipHash: 1, createdAt: -1 }),
    db.collection("stationery").createIndex({ chapter: 1, nameKey: 1 }, { unique: true }),
    db.collection("chapters").createIndex({ nameKey: 1 }, { unique: true }),
  ]);
  // One session note per child, drive, and volunteer code. Older data may already hold duplicates,
  // so a failure here is logged rather than blocking sign-in; the route still checks before inserting.
  await db.collection("lessons")
    .createIndex({ childId: 1, driveId: 1, volunteerCodeId: 1 }, { unique: true, name: "one_note_per_drive", partialFilterExpression: { source: "session" } })
    .catch((error) => console.error("Could not create the one-note-per-drive index", error));
}

/** Creates indexes once per server process instead of on every request. */
export function ensureIndexes() {
  global.mongoIndexesPromise ??= createIndexes().catch((error) => {
    global.mongoIndexesPromise = undefined;
    throw error;
  });
  return global.mongoIndexesPromise;
}
