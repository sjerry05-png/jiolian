"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { cancelSession, setAttendance, setPayment, setSessionNote, settleSession, updateSession } from "@/app/actions/fit";
import { Avatar, Button, ErrorText, Input, Label, Select, Textarea } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { BOOKING_LABEL, isoToTaipeiLocal, LOCATION_LABEL, money, PAID_LABEL, taipeiLocalToIso } from "@/lib/format";
import type { Booking, BookingStatus, LocationType, PaidMethod, SessionOverview } from "@/lib/types";

const PRE_STATUSES: BookingStatus[] = ["going", "declined", "late_cancel"];
const POST_STATUSES: BookingStatus[] = ["attended", "no_show", "late_cancel", "declined"];

export function RosterRow({
  session,
  userId,
  name,
  booking,
  hasPayments,
}: {
  session: SessionOverview;
  userId: string;
  name: string;
  booking: Booking | null;
  hasPayments: boolean;
}) {
  const { pending, error, run } = useAction();
  const completed = session.status === "completed";
  const cancelled = session.status === "cancelled";
  const statuses = completed ? POST_STATUSES : PRE_STATUSES;
  const guests = booking?.guests ?? 0;
  const counted = booking && ["going", "late_cancel", "attended", "no_show"].includes(booking.status);
  const lockedAttendance = completed && hasPayments;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} id={userId} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{name}</p>
          <p className="text-sm text-ink-3">
            {booking ? BOOKING_LABEL[booking.status] : "還沒回覆"}
            {guests > 0 && counted ? `・帶 ${guests} 位家人` : ""}
          </p>
        </div>
        {completed && booking?.amount_due != null ? (
          <span className="num text-lg font-bold text-ink">{money(booking.amount_due)}</span>
        ) : null}
      </div>

      {!cancelled ? (
        <div className="mt-2.5 ml-12 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`st-${userId}`}>
            {name} 的出席狀態
          </label>
          <Select
            id={`st-${userId}`}
            className="h-10 w-32 text-[15px]"
            value={booking && statuses.includes(booking.status) ? booking.status : ""}
            disabled={pending || lockedAttendance}
            onChange={(e) => run(() => setAttendance(session.id, userId, e.target.value as BookingStatus))}
          >
            <option value="" disabled>
              {booking ? BOOKING_LABEL[booking.status] : "選擇狀態"}
            </option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {BOOKING_LABEL[s]}
              </option>
            ))}
          </Select>
          {counted && !lockedAttendance ? (
            <span className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5 ring-1 ring-line">
              <button
                type="button"
                aria-label={`${name} 少一位同行家人`}
                className="flex size-8 items-center justify-center rounded-full disabled:opacity-30"
                disabled={pending || guests === 0}
                onClick={() => run(() => setAttendance(session.id, userId, booking!.status, guests - 1))}
              >
                <Minus className="size-4" />
              </button>
              <span className="num w-12 text-center text-sm">+{guests} 人</span>
              <button
                type="button"
                aria-label={`${name} 多一位同行家人`}
                className="flex size-8 items-center justify-center rounded-full disabled:opacity-30"
                disabled={pending || guests >= 5}
                onClick={() => run(() => setAttendance(session.id, userId, booking!.status, guests + 1))}
              >
                <Plus className="size-4" />
              </button>
            </span>
          ) : null}
          {completed && booking?.amount_due != null ? (
            <>
              <label className="sr-only" htmlFor={`pay-${userId}`}>
                {name} 的收款
              </label>
              <Select
                id={`pay-${userId}`}
                className={`h-10 w-32 text-[15px] ${booking.paid_at ? "border-go text-go" : "border-stop/50 text-stop"}`}
                value={booking.paid_method ?? ""}
                disabled={pending}
                onChange={(e) => run(() => setPayment(session.id, userId, (e.target.value || null) as PaidMethod | null))}
              >
                <option value="">未收</option>
                {(Object.keys(PAID_LABEL) as PaidMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {m === "waived" ? "免收" : `已收・${PAID_LABEL[m]}`}
                  </option>
                ))}
              </Select>
            </>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-1.5 ml-12 text-sm text-stop">{error}</p> : null}
    </li>
  );
}

export function SettleButton({ session }: { session: SessionOverview }) {
  const { pending, error, run } = useAction();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => {
          if (window.confirm("結算後，還標「要來」的人會算出席。確定結算嗎？之後仍可修改點名。"))
            run(
              () => settleSession(session.id),
              (r) => setResult(`${r.headcount} 人上課，每人 ${money(r.price_per_person)}，共應收 ${money(r.total)}`),
            );
        }}
      >
        {pending ? "結算中…" : `下課結算（目前 ${session.headcount} 人，每人 ${money(session.price_now)}）`}
      </Button>
      {result ? <p className="text-sm text-go">{result}</p> : null}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function SessionAdmin({ session }: { session: SessionOverview }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(isoToTaipeiLocal(session.starts_at));
  const [duration, setDuration] = useState(session.duration_min);
  const [locationType, setLocationType] = useState<LocationType>(session.location_type);
  const [location, setLocation] = useState(session.location ?? "");
  const [title, setTitle] = useState(session.title ?? "");
  const { pending, error, run } = useAction();
  const cancel = useAction();

  if (!editing) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          改時間或地點
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={cancel.pending}
          onClick={() => {
            if (window.confirm("取消這堂課？已報名的學員都不用付費。")) cancel.run(() => cancelSession(session.id));
          }}
        >
          取消這堂課
        </Button>
        <ErrorText>{cancel.error}</ErrorText>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-2xl bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => updateSession(session.id, { startsAt: taipeiLocalToIso(start), durationMin: duration, locationType, location, title }),
          () => setEditing(false),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="e-start">上課時間</Label>
          <Input id="e-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="e-dur">多久</Label>
          <Select id="e-dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} 分鐘
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="e-lt">地點類型</Label>
          <Select id="e-lt" value={locationType} onChange={(e) => setLocationType(e.target.value as LocationType)}>
            {(["home", "gym", "outdoor", "online"] as LocationType[]).map((l) => (
              <option key={l} value={l}>
                {LOCATION_LABEL[l]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="e-loc">地點說明</Label>
          <Input id="e-loc" value={location} maxLength={100} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="e-title">這堂主題</Label>
          <Input id="e-title" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      <p className="text-sm text-ink-3">改時間時，取消期限會跟著平移。</p>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          儲存
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          取消
        </Button>
      </div>
    </form>
  );
}

export function SessionNote({ sessionId, note }: { sessionId: string; note: string | null }) {
  const [value, setValue] = useState(note ?? "");
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-2">
      <Label htmlFor="note" hint="只有你看得到">
        課堂筆記
      </Label>
      <Textarea
        id="note"
        value={value}
        maxLength={500}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="例如：林爸膝蓋不舒服，下次深蹲減量"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={pending || value === (note ?? "")} onClick={() => run(() => setSessionNote(sessionId, value), () => setSaved(true))}>
          儲存筆記
        </Button>
        {saved ? <span className="text-sm text-go">已儲存</span> : null}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
