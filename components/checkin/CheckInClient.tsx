"use client";

import { useState, useRef, useEffect } from "react";
import type { PillarWithIndicators, DailyLog } from "@/lib/types";
import { cn, identityPct } from "@/lib/utils";
import ScoreSlider from "./ScoreSlider";

interface Props {
  pillars: PillarWithIndicators[];
  existingLogs: DailyLog[];
  weekAvg: number | null;
}

type JournalScore = { score: number; reasoning: string };

export default function CheckInClient({ pillars, existingLogs, weekAvg }: Props) {
  const initialScores: Record<string, number> = {};
  for (const log of existingLogs) {
    initialScores[log.indicator_id] = log.score;
  }

  const initialReasons: Record<string, string> = {};
  for (const log of existingLogs) {
    if (log.note) initialReasons[log.indicator_id] = log.note;
  }

  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [reasons, setReasons] = useState<Record<string, string>>(initialReasons);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [journalText, setJournalText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(Object.keys(initialReasons).length > 0);
  const [showSliders, setShowSliders] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const allIndicators = pillars.flatMap((p) => p.behavioral_indicators);
  const answered = Object.keys(scores).filter((id) => scores[id] > 0).length;
  const total = allIndicators.filter((i) => i.cadence === "daily").length;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [journalText]);

  async function analyzeJournal() {
    if (!journalText.trim() || analyzing) return;
    setAnalyzing(true);

    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: journalText }),
    });

    const data = await res.json();

    if (data.scores) {
      const newScores: Record<string, number> = {};
      const newReasons: Record<string, string> = {};
      for (const s of data.scores as Array<{ indicator_id: string } & JournalScore>) {
        newScores[s.indicator_id] = s.score;
        newReasons[s.indicator_id] = s.reasoning;
      }
      setScores((prev) => ({ ...prev, ...newScores }));
      setReasons((prev) => ({ ...prev, ...newReasons }));
      setAnalyzed(true);
    }

    setAnalyzing(false);
  }

  async function logScore(indicatorId: string, score: number) {
    setScores((prev) => ({ ...prev, [indicatorId]: score }));
    setSaving((prev) => ({ ...prev, [indicatorId]: true }));

    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indicatorId, score }),
    });

    if (!res.ok) console.error("Could not save check-in", await res.text());

    setSaving((prev) => ({ ...prev, [indicatorId]: false }));
    setSaved((prev) => ({ ...prev, [indicatorId]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [indicatorId]: false })), 1200);
  }

  const dateStr = new Date().toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (pillars.length === 0) {
    return (
      <div className="text-center pt-16">
        <h1 className="text-xl font-semibold">Good to see you.</h1>
        <p className="text-white/40 text-sm mt-2">Start by defining your pillars.</p>
        <a
          href="/pillars"
          className="mt-6 inline-block bg-accent text-white text-sm px-6 py-3 rounded-lg"
        >
          Set up pillars →
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs text-white/30 uppercase tracking-widest">{dateStr}</p>
        <h1 className="text-xl font-semibold mt-1">How was your day?</h1>
        <p className="text-xs text-white/25 mt-0.5">
          {answered}/{total} scored
        </p>
      </div>

      {/* Path score widget */}
      {weekAvg !== null && (
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40">This week's path</p>
            <span className="text-sm font-semibold tabular-nums">{identityPct(weekAvg)}%</span>
          </div>
          <div
            className="relative h-1.5 rounded-full"
            style={{
              background: "linear-gradient(to right, #f87171 0%, #fbbf24 50%, #34d399 100%)",
            }}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border border-white/60 shadow"
              style={{ left: `${Math.max(3, Math.min(97, identityPct(weekAvg)))}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-red-400/50">Bad Path</span>
            <span className="text-[9px] text-emerald-400/50">Good Path</span>
          </div>
        </div>
      )}

      {/* Journal entry */}
      <div className="glass rounded-2xl p-4 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Journal</p>
        <textarea
          ref={textareaRef}
          value={journalText}
          onChange={(e) => setJournalText(e.target.value)}
          placeholder="Just write what you did today. Went to the gym, worked on the AI project for a few hours, had dinner with the family, didn't drink..."
          className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/20 resize-none outline-none leading-relaxed min-h-[80px]"
          rows={3}
        />
        <button
          onClick={analyzeJournal}
          disabled={analyzing || !journalText.trim()}
          className="mt-3 w-full bg-accent hover:bg-accent-dim disabled:opacity-30 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          {analyzing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Analyzing…
            </span>
          ) : (
            "Score my day"
          )}
        </button>
      </div>

      {/* Scores — shown after journal analysis or if manually scored */}
      {(analyzed || answered > 0) && (
        <div className="space-y-3">
          {pillars.map((pillar) => (
            <div key={pillar.id} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: pillar.color }}
                />
                <span className="text-sm font-medium">{pillar.label}</span>
              </div>

              <div className="space-y-4">
                {pillar.behavioral_indicators.map((ind) => (
                  <div key={ind.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-white/55">{ind.label}</span>
                      <span
                        className={cn(
                          "text-[10px] transition-colors",
                          saving[ind.id]
                            ? "text-white/30"
                            : saved[ind.id]
                            ? "text-emerald-400"
                            : "text-white/0"
                        )}
                      >
                        {saving[ind.id] ? "saving…" : "saved"}
                      </span>
                    </div>
                    {reasons[ind.id] && (
                      <p className="text-[10px] text-white/30 italic mb-2 leading-relaxed">
                        {reasons[ind.id]}
                      </p>
                    )}
                    <ScoreSlider
                      value={scores[ind.id] ?? 0}
                      color={pillar.color}
                      onChange={(v) => logScore(ind.id, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowSliders(false)}
            className="w-full text-[10px] text-white/20 hover:text-white/40 py-2 transition-colors"
          >
            Adjust scores manually ↑
          </button>
        </div>
      )}

      {/* Manual score prompt — shown when nothing scored yet */}
      {!analyzed && answered === 0 && (
        <button
          onClick={() => setShowSliders(true)}
          className="w-full text-[10px] text-white/20 hover:text-white/40 py-2 transition-colors text-center"
        >
          Score manually instead
        </button>
      )}

      {/* Manual sliders — always visible if showSliders forced on, or if no journal */}
      {showSliders && !analyzed && (
        <div className="space-y-3 mt-2">
          {pillars.map((pillar) => (
            <div key={pillar.id} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: pillar.color }}
                />
                <span className="text-sm font-medium">{pillar.label}</span>
              </div>
              <div className="space-y-4">
                {pillar.behavioral_indicators.map((ind) => (
                  <div key={ind.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/55">{ind.label}</span>
                      <span
                        className={cn(
                          "text-[10px] transition-colors",
                          saving[ind.id]
                            ? "text-white/30"
                            : saved[ind.id]
                            ? "text-emerald-400"
                            : "text-white/0"
                        )}
                      >
                        {saving[ind.id] ? "saving…" : "saved"}
                      </span>
                    </div>
                    <ScoreSlider
                      value={scores[ind.id] ?? 0}
                      color={pillar.color}
                      onChange={(v) => logScore(ind.id, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {answered === total && total > 0 && (
        <div className="mt-4 glass rounded-2xl p-4 text-center">
          <p className="text-sm text-white/60">All done for today.</p>
          <p className="text-xs text-white/25 mt-1">Check your Path to see where you're heading.</p>
        </div>
      )}
    </div>
  );
}
