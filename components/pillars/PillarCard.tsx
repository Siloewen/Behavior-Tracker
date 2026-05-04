"use client";

import type { PillarWithIndicators } from "@/lib/types";

interface Props {
  pillar: PillarWithIndicators;
  rank: number;
  onEdit: () => void;
  onArchive: () => void;
}

export default function PillarCard({ pillar, rank, onEdit, onArchive }: Props) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0 mt-0.5"
            style={{ backgroundColor: pillar.color }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/25 font-mono">#{rank}</span>
              <span className="font-medium text-sm truncate">{pillar.label}</span>
            </div>
            {pillar.description && (
              <p className="text-xs text-white/35 mt-0.5 line-clamp-2">{pillar.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="text-xs text-white/30 hover:text-white/70 transition-colors px-2 py-1"
          >
            Edit
          </button>
          <button
            onClick={onArchive}
            className="text-xs text-white/20 hover:text-red-400 transition-colors px-2 py-1"
          >
            Remove
          </button>
        </div>
      </div>

      {pillar.behavioral_indicators.length > 0 && (
        <div className="mt-3 pl-6 space-y-1">
          {pillar.behavioral_indicators.map((ind) => (
            <div key={ind.id} className="flex items-center gap-2 text-xs text-white/40">
              <span className="w-1 h-1 rounded-full bg-white/20" />
              {ind.label}
              {ind.cadence === "weekly" && (
                <span className="text-[10px] text-white/20 ml-auto">weekly</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
