import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { DailyJournalError, logDailyJournal } from "@/lib/daily-journal";
import {
  getVoiceToolArguments,
  isAuthorizedVoiceRequest,
  readVoiceToolBody,
  voiceToolJson,
  voiceUnauthorizedResponse,
} from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

function readJournalText(args: Record<string, unknown>) {
  const value = args.journalText ?? args.daySummary ?? args.summary ?? args.text;
  return typeof value === "string" ? value : "";
}

export async function POST(req: Request) {
  if (!isAuthorizedVoiceRequest(req)) {
    return voiceUnauthorizedResponse();
  }

  const body = await readVoiceToolBody(req);
  const args = getVoiceToolArguments(body);
  const journalText = readJournalText(args);

  if (!journalText.trim()) {
    return voiceToolJson(body, { ok: false, error: "Journal text is required" }, { status: 400 });
  }

  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return voiceToolJson(body, { ok: false, error: "Supabase is unavailable" });
  }

  try {
    const result = await logDailyJournal(userId, journalText);

    return voiceToolJson(body, {
      ok: true,
      logDate: result.logDate,
      scores: result.scores,
      confirmation: `Logged ${result.scores.length} check-in scores for ${result.logDate}.`,
    });
  } catch (error) {
    if (error instanceof DailyJournalError) {
      return voiceToolJson(body, { ok: false, error: error.message }, { status: error.status });
    }

    return voiceToolJson(body, { ok: false, error: "Could not log journal" }, { status: 500 });
  }
}
