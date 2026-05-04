export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Pillar {
  id: string;
  user_id: string;
  label: string;
  description: string;
  priority_rank: number;
  color: string;
  archived_at: string | null;
  created_at: string;
}

export interface BehavioralIndicator {
  id: string;
  pillar_id: string;
  label: string;
  cadence: "daily" | "weekly";
  created_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  indicator_id: string;
  score: number;
  note: string | null;
  created_at: string;
}

export interface WeeklySummary {
  id: string;
  user_id: string;
  week_start: string;
  pillar_scores: Record<string, number>;
  narrative_text: string | null;
  generated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  phone_number: string | null;
  alert_threshold: number;
  alert_consecutive_weeks: number;
  sms_alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SmsPendingReply {
  id: string;
  user_id: string;
  phone_number: string;
  pillar_id: string;
  indicator_ids: string[];
  log_date: string;
  expires_at: string;
  created_at: string;
}

export interface VoiceCheckinCall {
  id: string;
  user_id: string;
  call_date: string;
  phone_number: string;
  vapi_call_id: string | null;
  status: "creating" | "created" | "failed";
  error: string | null;
  response_json: Json | null;
  created_at: string;
  updated_at: string;
}

export interface PillarWithIndicators extends Pillar {
  behavioral_indicators: BehavioralIndicator[];
}

export interface DailyLogWithIndicator extends DailyLog {
  behavioral_indicators: BehavioralIndicator & {
    pillars: Pillar;
  };
}

// Supabase DB type — matches the shape @supabase/supabase-js expects
export type Database = {
  public: {
    Tables: {
      pillars: {
        Row: Pillar;
        Insert: Omit<Pillar, "id" | "created_at">;
        Update: Partial<Omit<Pillar, "id" | "created_at">>;
        Relationships: [];
      };
      behavioral_indicators: {
        Row: BehavioralIndicator;
        Insert: Omit<BehavioralIndicator, "id" | "created_at">;
        Update: Partial<Omit<BehavioralIndicator, "id" | "created_at">>;
        Relationships: [];
      };
      daily_logs: {
        Row: DailyLog;
        Insert: Omit<DailyLog, "id" | "created_at">;
        Update: Partial<Omit<DailyLog, "id" | "created_at">>;
        Relationships: [];
      };
      weekly_summaries: {
        Row: WeeklySummary;
        Insert: Omit<WeeklySummary, "id" | "generated_at">;
        Update: Partial<Omit<WeeklySummary, "id" | "generated_at">>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettings;
        Insert: Omit<UserSettings, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<UserSettings, "id" | "created_at">>;
        Relationships: [];
      };
      sms_pending_replies: {
        Row: SmsPendingReply;
        Insert: Omit<SmsPendingReply, "id" | "created_at">;
        Update: Partial<Omit<SmsPendingReply, "id" | "created_at">>;
        Relationships: [];
      };
      voice_checkin_calls: {
        Row: VoiceCheckinCall;
        Insert: Omit<VoiceCheckinCall, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<VoiceCheckinCall, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
