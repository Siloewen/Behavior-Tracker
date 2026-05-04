"use client";

import { useState } from "react";
import type { PillarWithIndicators } from "@/lib/types";
import PillarCard from "./PillarCard";
import PillarModal from "./PillarModal";

interface Props {
  initialPillars: PillarWithIndicators[];
}

export default function PillarsClient({ initialPillars }: Props) {
  const [pillars, setPillars] = useState<PillarWithIndicators[]>(initialPillars);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PillarWithIndicators | null>(null);
  const [loadingPreset, setLoadingPreset] = useState(false);

  async function refresh() {
    const res = await fetch("/api/pillars");
    const data = await res.json();
    setPillars(data.pillars ?? []);
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: PillarWithIndicators) {
    setEditing(p);
    setModalOpen(true);
  }

  async function loadPreset() {
    setLoadingPreset(true);
    const res = await fetch("/api/preset", { method: "POST" });
    const data = await res.json();
    if (data.pillars) setPillars(data.pillars);
    setLoadingPreset(false);
  }

  async function archive(id: string) {
    const res = await fetch("/api/pillars", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archived_at: new Date().toISOString() }),
    });
    const data = await res.json();
    setPillars(data.pillars ?? []);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Pillars</h1>
          <p className="text-xs text-white/30 mt-0.5">Who you want to become</p>
        </div>
        {pillars.length < 5 && (
          <button
            onClick={openNew}
            className="bg-accent hover:bg-accent-dim text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add pillar
          </button>
        )}
      </div>

      {pillars.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-white/40 text-sm mb-1">No pillars yet.</p>
          <p className="text-white/20 text-xs mb-5">Add up to 5 character pillars to start tracking.</p>
          <button
            onClick={loadPreset}
            disabled={loadingPreset}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors mb-3"
          >
            {loadingPreset ? "Loading…" : "Load my preset"}
          </button>
          <p className="text-[10px] text-white/20">
            Sobriety & Clarity · Physical Edge · Builder Mindset · Real Connection
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pillars.map((pillar, i) => (
            <PillarCard
              key={pillar.id}
              pillar={pillar}
              rank={i + 1}
              onEdit={() => openEdit(pillar)}
              onArchive={() => archive(pillar.id)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-white/20 mt-4 text-center">
        {pillars.length}/5 pillars · {pillars.reduce((n, p) => n + p.behavioral_indicators.length, 0)} indicators
      </p>

      {modalOpen && (
        <PillarModal
          editing={editing}
          nextRank={pillars.length + 1}
          usedColors={pillars.filter(p => p.id !== editing?.id).map(p => p.color)}
          onClose={() => setModalOpen(false)}
          onSave={async () => { setModalOpen(false); await refresh(); }}
        />
      )}
    </div>
  );
}
