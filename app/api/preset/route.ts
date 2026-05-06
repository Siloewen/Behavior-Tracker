import { getAppUserId, isOfflineAppUserId } from "@/lib/app-user";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PRESET = [
  {
    label: "Sobriety & Clarity",
    description: "Stay sharp, clear-headed, and fully in control. No substances, no numbing.",
    priority_rank: 1,
    color: "#7c6af7",
    indicators: [
      { label: "No cannabis today", cadence: "daily" as const },
      { label: "No alcohol today", cadence: "daily" as const },
      { label: "No gambling today", cadence: "daily" as const },
    ],
  },
  {
    label: "Physical Edge",
    description: "Build a body you're proud of. Move with intention every day.",
    priority_rank: 2,
    color: "#34d399",
    indicators: [
      { label: "Exercised or trained today", cadence: "daily" as const },
    ],
  },
  {
    label: "Builder Mindset",
    description: "Ship things that matter. Do meaningful, focused work every day.",
    priority_rank: 3,
    color: "#60a5fa",
    indicators: [
      { label: "Did deep, focused work today", cadence: "daily" as const },
    ],
  },
  {
    label: "Real Connection",
    description: "Show up fully for the people who matter most.",
    priority_rank: 4,
    color: "#f59e0b",
    indicators: [
      { label: "Spent quality time with friends or family", cadence: "daily" as const },
    ],
  },
];

export async function POST() {
  const userId = await getAppUserId();
  if (isOfflineAppUserId(userId)) {
    return NextResponse.json({ error: "Supabase is unavailable" }, { status: 503 });
  }

  const supabase = createServiceClient();

  // Only load preset if no pillars exist
  const { data: existing } = await supabase
    .from("pillars")
    .select("id")
    .eq("user_id", userId)
    .is("archived_at", null)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Pillars already exist" }, { status: 409 });
  }

  for (const p of PRESET) {
    const { data: pillar, error: pillarErr } = await supabase
      .from("pillars")
      .insert({
        user_id: userId,
        label: p.label,
        description: p.description,
        priority_rank: p.priority_rank,
        color: p.color,
      })
      .select("id")
      .single();

    if (pillarErr || !pillar) {
      return NextResponse.json({ error: pillarErr?.message ?? "Insert failed" }, { status: 500 });
    }

    const { error: indErr } = await supabase.from("behavioral_indicators").insert(
      p.indicators.map((ind) => ({
        pillar_id: pillar.id,
        label: ind.label,
        cadence: ind.cadence,
      }))
    );

    if (indErr) {
      return NextResponse.json({ error: indErr.message }, { status: 500 });
    }
  }

  const { data: pillars } = await supabase
    .from("pillars")
    .select("*, behavioral_indicators(*)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("priority_rank");

  return NextResponse.json({ pillars: pillars ?? [] });
}
