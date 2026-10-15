import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({
      user: { displayName: session.displayName, role: session.role, chapter: session.chapter, expiresAt: session.expiresAt?.toISOString() ?? null },
    });
  } catch {
    return NextResponse.json({ error: "Session service is unavailable." }, { status: 503 });
  }
}
