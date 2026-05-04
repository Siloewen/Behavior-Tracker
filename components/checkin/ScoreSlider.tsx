"use client";

import { cn } from "@/lib/utils";

const LABELS = ["", "1 — Absent", "2 — Weak", "3 — Mixed", "4 — Good", "5 — Strong"];

interface Props {
  value: number;
  color: string;
  onChange: (value: number) => void;
}

export default function ScoreSlider({ value, color, onChange }: Props) {
  return (
    <div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-medium transition-all",
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
            {n}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-[10px] text-white/30 mt-1 text-right">{LABELS[value]}</p>
      )}
    </div>
  );
}
