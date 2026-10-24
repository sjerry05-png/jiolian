// 揪練資料型別（對應 supabase/migrations 裡的 fit_ 資料表與 RPC 回傳）

export type Role = "coach" | "student";
export type LocationType = "home" | "gym" | "outdoor" | "online";
export type SessionStatus = "scheduled" | "completed" | "cancelled";
export type BookingStatus = "going" | "declined" | "late_cancel" | "attended" | "no_show";
export type PaidMethod = "cash" | "transfer" | "linepay" | "other" | "waived";
export type MessageKind = "nudge" | "cheer" | "chat";
export type ProgressStatus = "red" | "yellow" | "green" | "none";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  phone: string | null;
  bio: string | null;
  large_text: boolean;
}

export interface Group {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  default_location_type: LocationType;
  default_location: string | null;
  default_duration_min: number;
  price_ladder: number[];
  lock_hours: number;
  invite_code: string;
  archived_at: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
}

export interface SessionOverview {
  id: string;
  group_id: string;
  group_name: string;
  coach_id: string;
  title: string | null;
  starts_at: string;
  duration_min: number;
  location_type: LocationType;
  location: string | null;
  price_ladder: number[];
  lock_at: string;
  status: SessionStatus;
  coach_note: string | null;
  settled_at: string | null;
  capacity: number;
  headcount: number;
  price_now: number;
  price_if_one_more: number | null;
  is_locked: boolean;
  has_started: boolean;
}

export interface Booking {
  session_id: string;
  user_id: string;
  status: BookingStatus;
  guests: number;
  price_per_person: number | null;
  amount_due: number | null;
  paid_at: string | null;
  paid_method: PaidMethod | null;
}

export interface Habit {
  id: string;
  group_id: string;
  member_id: string | null;
  title: string;
  detail: string | null;
  days_per_week: number;
  starts_on: string;
  ends_on: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface Checkin {
  id: string;
  habit_id: string;
  group_id: string;
  user_id: string;
  day: string;
  feeling: number | null;
  note: string | null;
  coach_reaction: string | null;
  coach_comment: string | null;
  created_at: string;
}

export interface Metric {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  note: string | null;
  recorded_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  group_id: string | null;
  sender_id: string;
  recipient_id: string;
  kind: MessageKind;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface MemberProgress {
  user_id: string;
  display_name: string;
  joined_at: string;
  week_target: number;
  week_done: number;
  last_checkin_day: string | null;
  days_since: number;
  streak: number;
  attended_30d: number;
  counted_30d: number;
  unpaid_amount: number | null;
  status: ProgressStatus;
}

export interface TodayHabit {
  habit_id: string;
  group_id: string;
  group_name: string;
  title: string;
  detail: string | null;
  days_per_week: number;
  is_personal: boolean;
  done_today: boolean;
  done_yesterday: boolean;
  week_done: number;
  today_feeling: number | null;
  coach_reaction: string | null;
  coach_comment: string | null;
}

export interface MySummary {
  streak: number;
  week_target: number;
  week_done: number;
  unread: number;
  unpaid: number;
}

export interface CoachStats {
  sessions: number;
  hours: number;
  people: number;
  avg_headcount: number | null;
  billed: number;
  collected: number;
  outstanding: number;
  solo_equivalent: number;
}

export interface GroupPreview {
  group_id: string;
  name: string;
  description: string | null;
  coach_name: string;
  member_count: number;
  price_ladder: number[];
  default_location_type: LocationType;
  default_location: string | null;
  is_archived: boolean;
  is_member: boolean;
}

// ── 中高齡功能 ──

export interface BodyInfo {
  user_id: string;
  birth_year: number | null;
  sex: "male" | "female" | null;
}

export interface Assessment {
  id: string;
  user_id: string;
  measured_on: string;
  chair_stand: number | null;
  arm_curl: number | null;
  step_2min: number | null;
  sit_reach: number | null;
  back_scratch: number | null;
  up_and_go: number | null;
  grip: number | null;
  single_leg: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
  hr_rest: number | null;
  screen_answers: boolean[];
  doctor_ok: boolean;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  share_with_group: boolean;
  created_by: string | null;
  achieved_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface GoalRating {
  goal_id: string;
  user_id: string;
  rated_on: string;
  score: number;
  rated_by: string | null;
  created_at: string;
}

export interface Wellbeing {
  user_id: string;
  week_start: string;
  pain: number;
  pain_area: string | null;
  sleep: number;
  energy: number;
  note: string | null;
  updated_at: string;
}

export interface BodyAlert {
  user_id: string;
  display_name: string;
  week_start: string;
  pain: number;
  prev_pain: number | null;
  pain_area: string | null;
  sleep: number;
  energy: number;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
