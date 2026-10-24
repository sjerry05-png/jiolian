"use client";

import { Clock, Lock, MapPin, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { rsvp } from "@/app/actions/fit";
import { PriceStairs } from "@/components/price-stairs";
import { Button } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { BOOKING_LABEL, dateTimeLabel, dayLabel, LOCATION_LABEL, money, priceFor, timeLabel } from "@/lib/format";
import type { Booking, SessionOverview } from "@/lib/types";

/** 學員看到的一堂課：時間地點、即時人數與價格、報名按鈕 */
export function SessionTicket({
  session,
  booking,
  showGroup = false,
}: {
  session: SessionOverview;
  booking: Booking | null;
  showGroup?: boolean;
}) {
  const { pending, error, run } = useAction();
  const counted = booking && ["going", "late_cancel", "attended", "no_show"].includes(booking.status);
  const [guests, setGuests] = useState(booking?.guests ?? 0);
  const started = session.has_started;
  const myStatus = booking?.status ?? null;
  const isGoing = myStatus === "going";

  // 預估：如果我（加上家人）報名，價格會變成多少
  const myCount = 1 + guests;
  const othersCount = session.headcount - (counted ? 1 + (booking?.guests ?? 0) : 0);
  const projected = Math.min(othersCount + myCount, session.capacity);
  const projectedPrice = priceFor(session.price_ladder, projected);
  const guestsChanged = isGoing && guests !== (booking?.guests ?? 0);
  const minGuests = session.is_locked && isGoing ? (booking?.guests ?? 0) : 0;
  const full = othersCount + myCount > session.capacity;

  return (
    <article className="overflow-hidden rounded-2xl bg-surface">
      <div className="flex items-stretch">
        <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-track px-2 py-3 text-track-ink">
          <span className="text-xs opacity-80">{dayLabel(session.starts_at)}</span>
          <span className="num text-2xl font-bold leading-tight">{timeLabel(session.starts_at)}</span>
          <span className="text-[0.6875rem] opacity-80">{session.duration_min} 分鐘</span>
        </div>
        <div className="min-w-0 flex-1 px-4 py-3">
          <p className="font-medium text-ink">
            {session.title ?? (showGroup ? session.group_name : "小團課")}
            {showGroup && session.title ? <span className="ml-2 text-sm font-normal text-ink-3">{session.group_name}</span> : null}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-2">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {LOCATION_LABEL[session.location_type]}
              {session.location ? `・${session.location}` : ""}
            </span>
          </p>
          <p className="mt-1 text-sm text-ink-2">
            目前 <span className="num font-bold text-ink">{session.headcount}</span> 人，每人{" "}
            <span className="num font-bold text-track">{money(session.price_now)}</span>
            {session.price_if_one_more && !started ? (
              <span className="ml-1 rounded bg-lane-soft px-1.5 py-0.5 text-xs text-lane-ink">
                再 1 人 → {money(session.price_if_one_more)}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {!started ? (
        <div className="border-t border-line px-4 py-3">
          <PriceStairs ladder={session.price_ladder} headcount={session.headcount} compact />
        </div>
      ) : null}

      <div className="space-y-3 border-t border-line px-4 py-3">
        {session.is_locked && !started ? (
          <p className="flex items-start gap-1.5 text-sm text-warn">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            已過取消期限，現在取消仍要付費；還是可以加人。
          </p>
        ) : !started ? (
          <p className="flex items-center gap-1.5 text-sm text-ink-3">
            <Clock className="size-4" aria-hidden />
            {dateTimeLabel(session.lock_at)} 前可以免費取消
          </p>
        ) : null}

        {started ? (
          <p className="text-sm text-ink-2">
            {myStatus ? `你的狀態：${BOOKING_LABEL[myStatus]}` : "這堂課已經開始"}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-2">同行家人（沒有帳號的小孩等）</span>
              <div className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5 ring-1 ring-line">
                <button
                  type="button"
                  aria-label="少一位家人"
                  className="flex size-8 items-center justify-center rounded-full disabled:opacity-30"
                  disabled={guests <= minGuests || pending}
                  onClick={() => setGuests((g) => Math.max(minGuests, g - 1))}
                >
                  <Minus className="size-4" />
                </button>
                <output className="num w-6 text-center font-bold">{guests}</output>
                <button
                  type="button"
                  aria-label="多一位家人"
                  className="flex size-8 items-center justify-center rounded-full disabled:opacity-30"
                  disabled={guests >= 5 || pending}
                  onClick={() => setGuests((g) => Math.min(5, g + 1))}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {isGoing && !guestsChanged ? (
                <Button className="flex-1" variant="secondary" disabled>
                  ✓ 已報名{(booking?.guests ?? 0) > 0 ? `（含 ${booking?.guests} 位家人）` : ""}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  disabled={pending || full}
                  onClick={() => run(() => rsvp(session.id, true, guests))}
                >
                  {full ? "人數已滿" : guestsChanged ? `更新為 ${myCount} 人` : `我要來，每人 ${money(projectedPrice)}`}
                </Button>
              )}
              {myStatus !== "declined" && myStatus !== "late_cancel" ? (
                <Button
                  variant={isGoing ? "danger" : "secondary"}
                  disabled={pending}
                  onClick={() => {
                    if (isGoing && session.is_locked && !window.confirm("已過取消期限，取消後仍需付這堂的費用。確定取消嗎？")) return;
                    run(() => rsvp(session.id, false, 0));
                  }}
                >
                  {isGoing ? "取消" : "不來"}
                </Button>
              ) : (
                <span className="flex items-center px-2 text-sm text-ink-3">{BOOKING_LABEL[myStatus]}</span>
              )}
            </div>
          </>
        )}
        {error ? <p className="text-sm text-stop">{error}</p> : null}
      </div>
    </article>
  );
}
