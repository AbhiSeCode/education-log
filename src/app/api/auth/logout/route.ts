import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, hashSecret } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try { await (await getDb()).collection("sessions").updateOne({ tokenHash: hashSecret(token) }, { $set: { expiresAt: new Date() } }); }
    catch { console.error("Could not expire the signed-out session in storage"); }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
