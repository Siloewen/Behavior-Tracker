"use client";

import { useState } from "react";
import type { PillarWithIndicators } from "@/lib/types";
import { PILLAR_COLORS } from "@/lib/utils";

interface Props {
  editing: PillarWithIndicators | null;
  nextRank: number;
  usedColors: string[];
  onClose: () => void;
  onSave: () => void;
}

export default function PillarModal({ editing, nextRank, usedColors, onClose, onSave }: Props) {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [color, setColor] = useState(
    editing?.color ?? PILLAR_COLORS.find(c => !usedColors.includes(c)) ?? PILLAR_COLORS[0]
  );
  const [indicators, setIndicators] = useState<Array<{ id?: string; label: string; cadence: "daily" | "weekly" }>>(
    editing?.behavioral_indicators.map(i => ({ id: i.id, label: i.label, cadence: i.cadence })) ?? [
      { label: "", cadence: "daily" },
    ]
  );
  const [saving, setSaving] = useState(false);

  function addIndicator() {
    if (indicators.length < 3) setIndicators([...indicators, { label: "", cadence: "daily" }]);
  }

  function removeIndicator(i: number) {
    setIndicators(indicators.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!label.trim()) return;
    setSaving(true);
    const res = await fetch("/api/pillars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing?.id,
        label,
        description,
        color,
        priority_rank: nextRank,
        indicators,
      }),
    });

    setSaving(false);
    if (res.ok) onSave();
    else console.error("Could not save pillar", await res.text());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold mb-5">
          {editing ? "Edit pillar" : "New pillar"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Label</label>
            <input
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Financially disciplined"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does living this pillar look like?"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Color</label>
            <div className="flex gap-2">
              {PILLAR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid ${c}` : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40">
                Behavioral indicators
              </label>
              {indicators.length < 3 && (
                <button onClick={addIndicator} className="text-xs text-accent hover:text-white transition-colors">
                  + Add
                </button>
              )}
            </div>
            <div className="space-y-2">
              {indicators.map((ind, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={ind.label}
                    onChange={e => {
                      const copy = [...indicators];
                      copy[i] = { ...copy[i], label: e.target.value };
                      setIndicators(copy);
                    }}
                    placeholder="e.g. Saved before spending today"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
                  />
                  <select
                    value={ind.cadence}
                    onChange={e => {
                      const copy = [...indicators];
                      copy[i] = { ...copy[i], cadence: e.target.value as "daily" | "weekly" };
                      setIndicators(copy);
                    }}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white/60 focus:outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  {indicators.length > 1 && (
                    <button onClick={() => removeIndicator(i)} className="text-white/25 hover:text-red-400 text-xs px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg py-2.5 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !label.trim()}
            className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
