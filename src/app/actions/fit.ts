"use server";

// 揪練的所有寫入動作。每個動作只是呼叫資料庫 RPC（權限與商業規則都在資料庫裡檢查），
// 成功後 refresh() 讓畫面重新抓資料。

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/auth";
import { SIZE_COOKIE } from "@/lib/config";
import type { TestKey } from "@/lib/fitness";
import { callRpc } from "@/lib/rpc";
import type { ActionResult, BookingStatus, LocationType, MessageKind, PaidMethod, Role } from "@/lib/types";

async function run<T>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const result = await callRpc<T>(fn, args);
  if (result.ok) refresh();
  return result;
}

function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

// ── 個人資料 ──
export async function setupProfile(
  displayName: string,
  role: Role,
  next: string | null,
  largeText = false,
): Promise<ActionResult> {
  const r = await callRpc("fit_setup_profile", { p_display_name: displayName, p_role: role });
  if (!r.ok) return r;
  if (largeText) {
    const lt = await setLargeText(true);
    if (!lt.ok) return lt;
  }
  redirect(safeNext(next) ?? (role === "coach" ? "/coach/groups/new" : homePathFor(role)));
}

export async function updateProfile(displayName: string, phone: string, bio: string) {
  return run("fit_update_profile", { p_display_name: displayName, p_phone: phone, p_bio: bio });
}

// ── 小團 ──
export interface GroupInput {
  name: string;
  description: string;
  locationType: LocationType;
  location: string;
  durationMin: number;
  lockHours: number;
  ladder: number[];
}

export async function createGroup(input: GroupInput): Promise<ActionResult> {
  const r = await callRpc<string>("fit_create_group", {
    p_name: input.name,
    p_price_ladder: input.ladder,
    p_description: input.description,
    p_location_type: input.locationType,
    p_location: input.location,
    p_lock_hours: input.lockHours,
    p_duration_min: input.durationMin,
  });
  if (!r.ok) return r;
  redirect(`/coach/groups/${r.data}?tab=members&created=1`);
}

export async function updateGroup(groupId: string, input: GroupInput) {
  return run<number>("fit_update_group", {
    p_group_id: groupId,
    p_name: input.name,
    p_price_ladder: input.ladder,
    p_description: input.description,
    p_location_type: input.locationType,
    p_location: input.location,
    p_lock_hours: input.lockHours,
    p_duration_min: input.durationMin,
  });
}

export async function regenerateInvite(groupId: string) {
  return run<string>("fit_regenerate_invite", { p_group_id: groupId });
}

export async function setGroupArchived(groupId: string, archived: boolean) {
  return run("fit_set_group_archived", { p_group_id: groupId, p_archived: archived });
}

export async function joinGroup(code: string): Promise<ActionResult> {
  const r = await callRpc<string>("fit_join_group", { p_code: code });
  if (!r.ok) return r;
  redirect(`/me?joined=${r.data}`);
}

export async function leaveGroup(groupId: string, userId?: string): Promise<ActionResult> {
  const r = await callRpc("fit_leave_group", { p_group_id: groupId, p_user_id: userId ?? null });
  if (!r.ok) return r;
  if (!userId) redirect("/me");
  refresh();
  return { ok: true, data: undefined };
}

// ── 課程 ──
export interface SessionInput {
  startsAt: string; // ISO
  durationMin: number;
  locationType: LocationType;
  location: string;
  title: string;
}

export async function createSessions(
  groupId: string,
  input: SessionInput & { repeatWeeks: number; enrollAll: boolean },
) {
  return run<string[]>("fit_create_sessions", {
    p_group_id: groupId,
    p_starts_at: input.startsAt,
    p_duration_min: input.durationMin,
    p_location_type: input.locationType,
    p_location: input.location,
    p_title: input.title,
    p_repeat_weeks: input.repeatWeeks,
    p_enroll_all: input.enrollAll,
  });
}

export async function updateSession(sessionId: string, input: SessionInput) {
  return run("fit_update_session", {
    p_session_id: sessionId,
    p_starts_at: input.startsAt,
    p_duration_min: input.durationMin,
    p_location_type: input.locationType,
    p_location: input.location,
    p_title: input.title,
  });
}

export async function setSessionNote(sessionId: string, note: string) {
  return run("fit_set_session_note", { p_session_id: sessionId, p_note: note });
}

export async function cancelSession(sessionId: string) {
  return run("fit_cancel_session", { p_session_id: sessionId });
}

export async function rsvp(sessionId: string, going: boolean, guests: number) {
  return run<{ status: BookingStatus; locked: boolean; headcount: number; price_per_person: number }>("fit_rsvp", {
    p_session_id: sessionId,
    p_going: going,
    p_guests: guests,
  });
}

export async function setAttendance(sessionId: string, userId: string, status: BookingStatus, guests?: number) {
  return run("fit_coach_set_attendance", {
    p_session_id: sessionId,
    p_user_id: userId,
    p_status: status,
    p_guests: guests ?? null,
  });
}

export async function settleSession(sessionId: string) {
  return run<{ headcount: number; price_per_person: number; total: number }>("fit_settle_session", {
    p_session_id: sessionId,
  });
}

export async function setPayment(sessionId: string, userId: string, method: PaidMethod | null) {
  return run("fit_set_payment", { p_session_id: sessionId, p_user_id: userId, p_method: method });
}

// ── 作業與打卡 ──
export async function createHabit(
  groupId: string,
  title: string,
  daysPerWeek: number,
  detail: string,
  memberId: string | null,
) {
  return run<string>("fit_create_habit", {
    p_group_id: groupId,
    p_title: title,
    p_days_per_week: daysPerWeek,
    p_detail: detail,
    p_member_id: memberId,
  });
}

export async function updateHabit(habitId: string, title: string, daysPerWeek: number, detail: string) {
  return run("fit_update_habit", { p_habit_id: habitId, p_title: title, p_days_per_week: daysPerWeek, p_detail: detail });
}

export async function archiveHabit(habitId: string) {
  return run("fit_archive_habit", { p_habit_id: habitId });
}

export async function checkin(habitId: string, day: string | null, feeling: number | null, note: string | null) {
  return run<string>("fit_checkin", { p_habit_id: habitId, p_day: day, p_feeling: feeling, p_note: note });
}

export async function undoCheckin(habitId: string, day: string | null) {
  return run("fit_undo_checkin", { p_habit_id: habitId, p_day: day });
}

export async function reactCheckin(checkinId: string, reaction: string | null, comment: string) {
  return run("fit_react_checkin", { p_checkin_id: checkinId, p_reaction: reaction, p_comment: comment });
}

// ── 身體數據 ──
export async function addMetric(input: {
  userId: string | null;
  measuredOn: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  waistCm: number | null;
  note: string;
}) {
  return run<string>("fit_add_metric", {
    p_user_id: input.userId,
    p_measured_on: input.measuredOn,
    p_weight_kg: input.weightKg,
    p_body_fat_pct: input.bodyFatPct,
    p_waist_cm: input.waistCm,
    p_note: input.note,
  });
}

export async function deleteMetric(metricId: string) {
  return run("fit_delete_metric", { p_metric_id: metricId });
}

// ── 訊息 ──
export async function sendMessage(recipientId: string, body: string, kind: MessageKind, groupId: string | null) {
  return run<string>("fit_send_message", {
    p_recipient_id: recipientId,
    p_body: body,
    p_kind: kind,
    p_group_id: groupId,
  });
}

export async function markRead(senderId: string | null) {
  return run<number>("fit_mark_read", { p_sender_id: senderId });
}

// ── 中高齡：長輩模式、基本資料、體能小考、生活目標、每週感受 ──

export async function setLargeText(on: boolean): Promise<ActionResult> {
  const r = await callRpc("fit_set_large_text", { p_on: on });
  if (!r.ok) return r;
  const jar = await cookies();
  // 字級要在 <html> 上設定，伺服器渲染時就要知道，所以同時記在 cookie
  if (on) jar.set(SIZE_COOKIE, "lg", { path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
  else jar.delete(SIZE_COOKIE);
  refresh();
  return { ok: true, data: undefined };
}

export async function setBodyInfo(userId: string | null, birthYear: number | null, sex: "male" | "female" | null) {
  return run("fit_set_body_info", { p_user_id: userId, p_birth_year: birthYear, p_sex: sex });
}

export interface AssessmentInput {
  userId: string | null;
  measuredOn: string;
  screenAnswers: boolean[];
  doctorOk: boolean;
  values: Partial<Record<TestKey, number | null>>;
  bpSys: number | null;
  bpDia: number | null;
  hrRest: number | null;
  note: string;
  returnTo: string;
}

export async function saveAssessment(input: AssessmentInput): Promise<ActionResult> {
  const v = input.values;
  const r = await callRpc<string>("fit_save_assessment", {
    p_user_id: input.userId,
    p_measured_on: input.measuredOn,
    p_screen_answers: input.screenAnswers,
    p_doctor_ok: input.doctorOk,
    p_chair_stand: v.chair_stand ?? null,
    p_arm_curl: v.arm_curl ?? null,
    p_step_2min: v.step_2min ?? null,
    p_sit_reach: v.sit_reach ?? null,
    p_back_scratch: v.back_scratch ?? null,
    p_up_and_go: v.up_and_go ?? null,
    p_grip: v.grip ?? null,
    p_single_leg: v.single_leg ?? null,
    p_bp_sys: input.bpSys,
    p_bp_dia: input.bpDia,
    p_hr_rest: input.hrRest,
    p_note: input.note,
  });
  if (!r.ok) return r;
  const back = safeNext(input.returnTo) ?? "/me/progress";
  redirect(`${back}${back.includes("?") ? "&" : "?"}assessed=${r.data}#fitness`);
}

export async function deleteAssessment(assessmentId: string) {
  return run("fit_delete_assessment", { p_assessment_id: assessmentId });
}

export async function addGoal(userId: string | null, title: string, score: number, share: boolean) {
  return run<string>("fit_add_goal", { p_user_id: userId, p_title: title, p_score: score, p_share: share });
}

export async function rateGoal(goalId: string, score: number) {
  return run("fit_rate_goal", { p_goal_id: goalId, p_score: score });
}

export async function setGoalAchieved(goalId: string, achieved: boolean) {
  return run("fit_set_goal_achieved", { p_goal_id: goalId, p_achieved: achieved });
}

export async function updateGoal(goalId: string, title: string, share: boolean) {
  return run("fit_update_goal", { p_goal_id: goalId, p_title: title, p_share: share });
}

export async function archiveGoal(goalId: string) {
  return run("fit_archive_goal", { p_goal_id: goalId });
}

export async function saveWellbeing(pain: number, sleep: number, energy: number, painArea: string, note: string) {
  return run("fit_save_wellbeing", { p_pain: pain, p_sleep: sleep, p_energy: energy, p_pain_area: painArea, p_note: note });
}
