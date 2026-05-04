import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}

const APP_TIME_ZONE = "America/Edmonton";

function ymdFromDate(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function formatYmd(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

export function dateKey(date: Date = new Date()): string {
  const { year, month, day } = ymdFromDate(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

export function effectiveLogDate(logDate: string, createdAt?: string | null): string {
  if (!createdAt) return logDate;

  const createdDate = dateKey(new Date(createdAt));
  const log = parseDateKey(logDate);
  const created = parseDateKey(createdDate);
  const logTime = Date.UTC(log.year, log.month - 1, log.day);
  const createdTime = Date.UTC(created.year, created.month - 1, created.day);
  const dayDiff = Math.round((logTime - createdTime) / (1000 * 60 * 60 * 24));

  return Math.abs(dayDiff) <= 1 ? createdDate : logDate;
}

export function getWeekStart(date: Date | string = new Date()): string {
  const { year, month, day } =
    typeof date === "string" ? parseDateKey(date) : ymdFromDate(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = d.getUTCDay();
  const diff = d.getUTCDate() - weekday + (weekday === 0 ? -6 : 1); // Monday
  d.setUTCDate(diff);
  return formatYmd(d);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function today(): string {
  return dateKey();
}

export const PILLAR_COLORS = [
  "#7c6af7",
  "#34d399",
  "#f59e0b",
  "#f87171",
  "#60a5fa",
];

export function scoreLabel(score: number): string {
  if (score >= 4.5) return "Strong";
  if (score >= 3.5) return "Good";
  if (score >= 2.5) return "Mixed";
  if (score >= 1.5) return "Weak";
  return "Absent";
}

export function scoreColor(score: number): string {
  if (score >= 4) return "text-emerald-400";
  if (score >= 3) return "text-yellow-400";
  return "text-red-400";
}

// 0–100% position between Bad Path (1.5) and Good Path (4.5)
export function identityPct(score: number): number {
  return Math.round(Math.max(0, Math.min(100, ((score - 1.5) / 3) * 100)));
}
