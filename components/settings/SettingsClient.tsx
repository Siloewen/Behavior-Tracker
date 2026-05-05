"use client";

import { useState } from "react";

interface Settings {
  phone_number: string | null;
  alert_threshold: number;
  alert_consecutive_weeks: number;
  sms_alerts_enabled: boolean;
}

interface Props {
  initialSettings: Settings | null;
}

export default function SettingsClient({ initialSettings }: Props) {
  const [phone, setPhone] = useState(initialSettings?.phone_number ?? "");
  const [threshold, setThreshold] = useState(initialSettings?.alert_threshold ?? 2.5);
  const [smsEnabled, setSmsEnabled] = useState(initialSettings?.sms_alerts_enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_number: phone || null,
        alert_threshold: threshold,
        sms_alerts_enabled: smsEnabled && !!phone,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <div className="glass rounded-2xl p-5 space-y-5">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">
            Phone number for SMS alerts
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+1 587 000 0000"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent/50"
          />
          <p className="text-[10px] text-white/25 mt-1">Include country code. Alerts sent via SMS — you can reply 1-5, including halves like 3.5, to log a score.</p>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">
            Alert threshold (below this avg = drift)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="text-sm font-mono text-accent w-6">{threshold}</span>
          </div>
          <p className="text-[10px] text-white/25 mt-1">Default: 2.5 — alerts fire when a pillar stays below this for 2+ weeks</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">SMS drift alerts</p>
            <p className="text-xs text-white/30">Requires phone number above</p>
          </div>
          <button
            onClick={() => setSmsEnabled(!smsEnabled)}
            className={`w-11 h-6 rounded-full transition-colors ${smsEnabled && phone ? "bg-accent" : "bg-white/10"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${smsEnabled && phone ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save settings"}
        </button>
      </div>

    </div>
  );
}
