import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assessment, BodyInfo, Booking, Goal, GoalRating, Group, Profile, SessionOverview, Wellbeing } from "@/lib/types";

const GROUP_COLS =
  "id, coach_id, name, description, default_location_type, default_location, default_duration_min, price_ladder, lock_hours, invite_code, archived_at, created_at";

/** 學員目前所在的小團 */
export async function studentGroups(supabase: SupabaseClient, userId: string): Promise<Group[]> {
  const { data: memberships } = await supabase
    .from("fit_group_members")
    .select("group_id")
    .eq("user_id", userId)
    .is("left_at", null);
  const ids = (memberships ?? []).map((m) => m.group_id as string);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("fit_groups").select(GROUP_COLS).in("id", ids).order("created_at");
  return (data ?? []) as Group[];
}

/** 教練開的小團 */
export async function coachGroups(supabase: SupabaseClient, coachId: string, includeArchived = false): Promise<Group[]> {
  let q = supabase.from("fit_groups").select(GROUP_COLS).eq("coach_id", coachId).order("created_at");
  if (!includeArchived) q = q.is("archived_at", null);
  const { data } = await q;
  return (data ?? []) as Group[];
}

export async function getGroup(supabase: SupabaseClient, groupId: string): Promise<Group | null> {
  const { data } = await supabase.from("fit_groups").select(GROUP_COLS).eq("id", groupId).maybeSingle();
  return (data as Group | null) ?? null;
}

const SESSION_COLS =
  "id, group_id, group_name, coach_id, title, starts_at, duration_min, location_type, location, price_ladder, lock_at, status, coach_note, settled_at, capacity, headcount, price_now, price_if_one_more, is_locked, has_started";

export async function upcomingSessions(
  supabase: SupabaseClient,
  groupIds: string[],
  opts: { limit?: number; untilDays?: number; includeCancelled?: boolean } = {},
): Promise<SessionOverview[]> {
  if (groupIds.length === 0) return [];
  // 開始後 3 小時內的課也算「進行中／待結算」，仍列在上方
  const from = new Date(Date.now() - 3 * 3600_000).toISOString();
  let q = supabase
    .from("fit_session_overview")
    .select(SESSION_COLS)
    .in("group_id", groupIds)
    .gte("starts_at", from)
    .order("starts_at");
  if (!opts.includeCancelled) q = q.neq("status", "cancelled");
  if (opts.untilDays) q = q.lte("starts_at", new Date(Date.now() + opts.untilDays * 86400_000).toISOString());
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as SessionOverview[];
}

export async function pastSessions(
  supabase: SupabaseClient,
  groupIds: string[],
  limit = 20,
): Promise<SessionOverview[]> {
  if (groupIds.length === 0) return [];
  const { data } = await supabase
    .from("fit_session_overview")
    .select(SESSION_COLS)
    .in("group_id", groupIds)
    .lt("starts_at", new Date(Date.now() - 3 * 3600_000).toISOString())
    .order("starts_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as SessionOverview[];
}

/** 已開始但還沒結算的課（教練待辦） */
export async function unsettledSessions(supabase: SupabaseClient, groupIds: string[]): Promise<SessionOverview[]> {
  if (groupIds.length === 0) return [];
  const { data } = await supabase
    .from("fit_session_overview")
    .select(SESSION_COLS)
    .in("group_id", groupIds)
    .eq("status", "scheduled")
    .lt("starts_at", new Date().toISOString())
    .order("starts_at");
  return (data ?? []) as SessionOverview[];
}

export async function getSession(supabase: SupabaseClient, sessionId: string): Promise<SessionOverview | null> {
  const { data } = await supabase.from("fit_session_overview").select(SESSION_COLS).eq("id", sessionId).maybeSingle();
  return (data as SessionOverview | null) ?? null;
}

const BOOKING_COLS = "session_id, user_id, status, guests, price_per_person, amount_due, paid_at, paid_method";

export async function bookingsForSessions(supabase: SupabaseClient, sessionIds: string[]): Promise<Booking[]> {
  if (sessionIds.length === 0) return [];
  const { data } = await supabase.from("fit_bookings").select(BOOKING_COLS).in("session_id", sessionIds);
  return (data ?? []) as Booking[];
}

export async function profilesByIds(supabase: SupabaseClient, ids: string[]): Promise<Map<string, Profile>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("fit_profiles").select("id, display_name, role, phone, bio, large_text").in("id", unique);
  return new Map(((data ?? []) as Profile[]).map((p) => [p.id, p]));
}

export async function activeMembers(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{ user_id: string; joined_at: string }[]> {
  const { data } = await supabase
    .from("fit_group_members")
    .select("user_id, joined_at")
    .eq("group_id", groupId)
    .is("left_at", null)
    .order("joined_at");
  return (data ?? []) as { user_id: string; joined_at: string }[];
}

// ── 中高齡功能 ──

const ASSESSMENT_COLS =
  "id, user_id, measured_on, chair_stand, arm_curl, step_2min, sit_reach, back_scratch, up_and_go, grip, single_leg, bp_sys, bp_dia, hr_rest, screen_answers, doctor_ok, note, recorded_by, created_at";

/** 一位學員的體能小考、生活目標、每週感受、基本資料（本人或教練才讀得到） */
export async function seniorData(supabase: SupabaseClient, userId: string) {
  const [bodyRes, assessRes, goalsRes, ratingsRes, wellRes] = await Promise.all([
    supabase.from("fit_body_info").select("user_id, birth_year, sex").eq("user_id", userId).maybeSingle<BodyInfo>(),
    supabase.from("fit_assessments").select(ASSESSMENT_COLS).eq("user_id", userId).order("measured_on"),
    supabase
      .from("fit_goals")
      .select("id, user_id, title, share_with_group, created_by, achieved_at, archived_at, created_at")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("fit_goal_ratings").select("goal_id, user_id, rated_on, score, rated_by, created_at").eq("user_id", userId).order("rated_on"),
    supabase
      .from("fit_wellbeing")
      .select("user_id, week_start, pain, pain_area, sleep, energy, note, updated_at")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(12),
  ]);
  return {
    body: bodyRes.data ?? null,
    assessments: (assessRes.data ?? []) as Assessment[],
    goals: (goalsRes.data ?? []) as Goal[],
    ratings: (ratingsRes.data ?? []) as GoalRating[],
    wellbeing: (wellRes.data ?? []) as Wellbeing[],
  };
}

/** 本週的週一（台灣日期 YYYY-MM-DD） */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = (dt.getUTCDay() + 6) % 7; // 週一 = 0
  dt.setUTCDate(dt.getUTCDate() - wd);
  return dt.toISOString().slice(0, 10);
}
