import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type IndicatorInput = {
  label: string;
  cadence: "daily" | "weekly";
};

async function loadPillars(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pillars")
    .select("*, behavioral_indicators(*)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("priority_rank");

  if (error) throw error;
  return data ?? [];
}

export async function GET() {
  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) return NextResponse.json({ pillars: [] });

  const pillars = await loadPillars(userId);
  return NextResponse.json({ pillars });
}

export async function POST(req: Request) {
  const body = await req.json();
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const description = typeof body.description === "string" ? body.description : "";
  const color = typeof body.color === "string" ? body.color : "#7c6af7";
  const indicators = Array.isArray(body.indicators)
    ? (body.indicators as IndicatorInput[]).filter(ind => ind.label?.trim())
    : [];

  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase is unavailable" }, { status: 503 });
  }

  let pillarId = typeof body.id === "string" ? body.id : null;

  if (pillarId) {
    const { data: existing } = await supabase
      .from("pillars")
      .select("id")
      .eq("id", pillarId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Pillar not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("pillars")
      .update({ label, description, color })
      .eq("id", pillarId)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: deleteError } = await supabase
      .from("behavioral_indicators")
      .delete()
      .eq("pillar_id", pillarId);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  } else {
    const priorityRank = typeof body.priority_rank === "number" ? body.priority_rank : 1;
    const { data, error } = await supabase
      .from("pillars")
      .insert({ user_id: userId, label, description, color, priority_rank: priorityRank })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    pillarId = data.id;
  }

  if (indicators.length && pillarId) {
    const { error } = await supabase.from("behavioral_indicators").insert(
      indicators.map(ind => ({
        pillar_id: pillarId,
        label: ind.label.trim(),
        cadence: ind.cadence === "weekly" ? "weekly" : "daily",
      }))
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pillars = await loadPillars(userId);
  return NextResponse.json({ pillars });
}

export async function PATCH(req: Request) {
  const { id, archived_at } = await req.json();

  if (typeof id !== "string") {
    return NextResponse.json({ error: "Pillar id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase is unavailable" }, { status: 503 });
  }

  const { error } = await supabase
    .from("pillars")
    .update({ archived_at: archived_at ?? new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pillars = await loadPillars(userId);
  return NextResponse.json({ pillars });
}
