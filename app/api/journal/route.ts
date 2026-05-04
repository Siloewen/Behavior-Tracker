import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { DailyJournalError, logDailyJournal } from "@/lib/daily-journal";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { text } = await req.json();
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Journal text is required" }, { status: 400 });
  }

  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 });
  }

  try {
    const { scores } = await logDailyJournal(userId, text);
    return NextResponse.json({ scores });
  } catch (error) {
    if (error instanceof DailyJournalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not log journal" }, { status: 500 });
  }
}
