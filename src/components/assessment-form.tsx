"use client";

import { AlertTriangle, ChevronDown, ShieldCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { saveAssessment } from "@/app/actions/fit";
import { TestTimer } from "@/components/test-timer";
import { Button, ErrorText, Input, Label, Textarea } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { formatValue, SCREEN_QUESTIONS, type Sex, TESTS, type TestDef, type TestKey, vitalsLevel } from "@/lib/fitness";
import { plainDateLabel, todayInTaipei } from "@/lib/format";
import type { Assessment } from "@/lib/types";

/**
 * 體能小考輸入：運動前安全檢查 → 血壓心跳 → 8 個項目（每項附測法與計時器）→ 儲存。
 * userId 為 null 代表學員自己在家測。
 */
export function AssessmentForm({
  userId,
  personName,
  sex,
  previous,
  returnTo,
}: {
  userId: string | null;
  personName: string;
  sex: Sex | null;
  previous: Assessment | null;
  returnTo: string;
}) {
  const today = todayInTaipei();
  const [day, setDay] = useState(today);
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => SCREEN_QUESTIONS.map(() => null));
  const [doctorOk, setDoctorOk] = useState(false);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [hr, setHr] = useState("");
  const [values, setValues] = useState<Record<TestKey, string>>(
    () => Object.fromEntries(TESTS.map((t) => [t.key, ""])) as Record<TestKey, string>,
  );
  const [note, setNote] = useState("");
  const { pending, error, run, setError } = useAction();

  const answered = answers.every((a) => a !== null);
  const anyYes = answers.some((a) => a === true);
  const screenPassed = answered && (!anyYes || doctorOk);
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const vitals = vitalsLevel(num(sys), num(dia), num(hr));

  const setValue = useCallback((key: TestKey, v: string) => setValues((cur) => ({ ...cur, [key]: v })), []);
  const filled = TESTS.filter((t) => values[t.key].trim() !== "");
  const invalid = filled.filter((t) => {
    const n = Number(values[t.key]);
    return !Number.isFinite(n) || n < t.min || n > t.max;
  });

  const allNo = () => {
    setAnswers(SCREEN_QUESTIONS.map(() => false));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenPassed) return setError("請先完成運動前安全檢查");
    if (vitals === "stop") return setError("血壓過高，今天先不要測");
    if (filled.length === 0) return setError("請至少填一項測驗結果");
    if (invalid.length > 0) return setError(`「${invalid[0].name}」的數字超出範圍（${invalid[0].min}～${invalid[0].max}）`);
    if ((sys.trim() === "") !== (dia.trim() === "")) return setError("血壓請收縮壓、舒張壓都填");
    run(() =>
      saveAssessment({
        userId,
        measuredOn: day,
        screenAnswers: answers.map((a) => a === true),
        doctorOk: anyYes && doctorOk,
        values: Object.fromEntries(filled.map((t) => [t.key, Number(values[t.key])])),
        bpSys: num(sys),
        bpDia: num(dia),
        hrRest: num(hr),
        note,
        returnTo,
      }),
    );
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="rounded-2xl bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-xl text-ink">1. 運動前安全檢查</h2>
            <p className="mt-0.5 text-sm text-ink-2">每次測之前都問一次（參考 PAR-Q 運動前自我評估）。</p>
          </div>
          <button type="button" onClick={allNo} className="text-sm text-track underline-offset-4 hover:underline">
            全部都「否」
          </button>
        </div>
        <ol className="mt-4 space-y-3">
          {SCREEN_QUESTIONS.map((q, i) => (
            <li key={q} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[0.9375rem] text-ink">
                <span className="num mr-1.5 text-ink-3">{i + 1}.</span>
                {q}
              </span>
              <span className="flex shrink-0 gap-2" role="group" aria-label={`第 ${i + 1} 題`}>
                {[
                  { v: false, label: "否" },
                  { v: true, label: "是" },
                ].map((o) => {
                  const on = answers[i] === o.v;
                  return (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={on}
                      aria-label={`第 ${i + 1} 題：${o.label}`}
                      onClick={() => setAnswers((cur) => cur.map((a, j) => (j === i ? o.v : a)))}
                      className={`h-10 min-w-16 rounded-xl border px-4 font-medium transition-colors ${
                        on
                          ? o.v
                            ? "border-stop bg-stop text-white"
                            : "border-go bg-go text-white"
                          : "border-line bg-surface text-ink-2 hover:border-ink-3"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </span>
            </li>
          ))}
        </ol>
        {anyYes ? (
          <div className="mt-4 rounded-xl bg-stop-soft p-3 text-stop">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
              有回答「是」，請先讓醫生知道你要做體能測驗，醫生同意後再測。
            </p>
            <label className="mt-2 flex items-center gap-2 text-ink">
              <input
                type="checkbox"
                checked={doctorOk}
                onChange={(e) => setDoctorOk(e.target.checked)}
                className="size-5 accent-[var(--track)]"
              />
              已取得醫生同意，可以做體能測驗
            </label>
          </div>
        ) : answered ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-go-soft px-3 py-2 text-go">
            <ShieldCheck className="size-5" aria-hidden />
            安全檢查通過
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl bg-surface p-4 sm:p-5">
        <h2 className="display text-xl text-ink">2. 量血壓、心跳</h2>
        <p className="mt-0.5 text-sm text-ink-2">選填。坐著休息 5 分鐘後量。</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="bp-sys">收縮壓</Label>
            <Input id="bp-sys" inputMode="numeric" value={sys} onChange={(e) => setSys(e.target.value)} placeholder="120" />
          </div>
          <div>
            <Label htmlFor="bp-dia">舒張壓</Label>
            <Input id="bp-dia" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="80" />
          </div>
          <div>
            <Label htmlFor="hr">心跳</Label>
            <Input id="hr" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="72" />
          </div>
        </div>
        {vitals === "high" ? (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-[0.9375rem] text-warn">
            偏高（超過 140/90 或心跳超過 100）。先坐著休息 5 分鐘再量一次；如果還是偏高，今天不要做「2 分鐘原地抬膝」。
          </p>
        ) : vitals === "stop" ? (
          <p className="mt-3 rounded-xl bg-stop-soft px-3 py-2 text-[0.9375rem] text-stop">
            血壓過高（180/110 以上），今天先不要測，請和醫生討論。
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-xl text-ink">3. 開始測驗</h2>
            <p className="mt-0.5 text-sm text-ink-2">沒有器材的項目可以跳過，有測的填就好。</p>
          </div>
          <div>
            <Label htmlFor="a-day">測驗日期</Label>
            <Input id="a-day" type="date" className="w-44" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
          </div>
        </div>
        <div className={`space-y-3 ${screenPassed && vitals !== "stop" ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!screenPassed}>
          {TESTS.map((t, i) => (
            <TestCard
              key={t.key}
              index={i + 1}
              def={t}
              value={values[t.key]}
              onChange={setValue}
              previous={previous ? (previous[t.key] as number | null) : null}
              previousDay={previous?.measured_on ?? null}
              sex={sex}
              extraCaution={t.key === "step_2min" && (anyYes || vitals !== "ok")}
            />
          ))}
        </div>
        {!screenPassed ? <p className="mt-2 text-sm text-ink-3">完成上面的安全檢查後就可以開始填。</p> : null}
      </section>

      <section className="rounded-2xl bg-surface p-4 sm:p-5">
        <Label htmlFor="a-note" hint="選填，300 字以內">
          備註
        </Label>
        <Textarea
          id="a-note"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：右膝有點緊，抬膝做到 1 分半先休息"
        />
      </section>

      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" disabled={pending || !screenPassed || filled.length === 0}>
        {pending ? "儲存中…" : `儲存${personName}的小考（${filled.length} 項）`}
      </Button>
    </form>
  );
}

function TestCard({
  index,
  def,
  value,
  onChange,
  previous,
  previousDay,
  sex,
  extraCaution,
}: {
  index: number;
  def: TestDef;
  value: string;
  onChange: (key: TestKey, v: string) => void;
  previous: number | null;
  previousDay: string | null;
  sex: Sex | null;
  extraCaution: boolean;
}) {
  const [open, setOpen] = useState(previous == null);
  const n = value.trim() === "" ? null : Number(value);
  const out = n != null && (!Number.isFinite(n) || n < def.min || n > def.max);
  const lowGrip = def.warnBelow && sex && n != null && n < def.warnBelow[sex];
  const onStop = useMemo(
    () => (sec: number) => onChange(def.key, String(Math.min(sec, def.max))),
    [def.key, def.max, onChange],
  );
  const inputId = `t-${def.key}`;

  return (
    <article className="rounded-2xl bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[1.0625rem] font-medium text-ink">
            <span className="num mr-1.5 text-ink-3">{index}</span>
            {def.name}
            <span className="ml-2 rounded-full bg-track-soft px-2 py-0.5 text-xs font-normal text-track">{def.short}</span>
          </h3>
          <p className="mt-0.5 text-sm text-ink-2">{def.life}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1 text-sm text-track"
        >
          怎麼測
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-xl bg-surface-2 p-3 text-[0.9375rem] text-ink-2">
          <p className="text-sm text-ink-3">準備：{def.equipment}</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            {def.howTo.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {def.caution ? (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${extraCaution ? "bg-stop-soft text-stop" : "bg-warn-soft text-warn"}`}>
          {extraCaution ? "注意：安全檢查或血壓有狀況，這項建議跳過。" : null}
          {def.caution}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        {def.timer ? <TestTimer timer={def.timer} label={def.name} onStopwatchResult={def.timer.kind === "stopwatch" ? onStop : undefined} /> : <span className="hidden sm:block" />}
        <div>
          <Label htmlFor={inputId} hint={previous != null ? `上次 ${formatValue(def.key, previous)}${previousDay ? `（${plainDateLabel(previousDay)}）` : ""}` : undefined}>
            成績（{def.unit}）
          </Label>
          <Input
            id={inputId}
            inputMode={def.min < 0 ? "text" : def.decimals > 0 ? "decimal" : "numeric"}
            className={`num w-full text-xl font-bold sm:w-40 ${out ? "border-stop" : ""}`}
            value={value}
            onChange={(e) => onChange(def.key, e.target.value.replace(/[^0-9.\-]/g, ""))}
            placeholder={def.min < 0 ? "負數代表碰不到" : "沒測就空白"}
            aria-invalid={out || undefined}
          />
        </div>
      </div>
      {out ? <p className="mt-1.5 text-sm text-stop">請填 {def.min}～{def.max} 之間</p> : null}
      {lowGrip ? (
        <p className="mt-1.5 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
          低於肌少症提醒值（{sex === "male" ? "男" : "女"}性 {def.warnBelow![sex!]} 公斤）。多練肌力，必要時請醫生評估。
        </p>
      ) : null}
    </article>
  );
}
