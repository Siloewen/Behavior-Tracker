"use client";

import { cn, scoreLabel } from "@/lib/utils";

const SCORE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

interface Props {
  value: number;
  color: string;
  onChange: (value: number) => void;
}

export default function ScoreSlider({ value, color, onChange }: Props) {
  return (
    <div>
      <div className="grid grid-cols-9 gap-1">
        {SCORE_OPTIONS.map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "h-8 rounded-lg text-[10px] font-medium transition-all",
              value === n
                ? "text-white scale-105 shadow-lg"
                : value > 0 && n <= value
                ? "text-white/70"
                : "bg-white/5 text-white/25 hover:bg-white/10"
            )}
            style={
              value >= n
                ? { backgroundColor: color, opacity: 0.2 + (n / 5) * 0.8 }
                : undefined
            }
          >
            {formatScore(n)}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-[10px] text-white/30 mt-1 text-right">
          {formatScore(value)} — {scoreLabel(value)}
        </p>
      )}
    </div>
  );
}
