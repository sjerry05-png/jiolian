// 中高齡體能小考：項目說明、台灣常模、同齡排名、進步判斷
//
// 常模來源：Wang CW, et al. Functional Fitness Norms of Community-Dwelling Older Adults in Southern Rural Taiwan:
// A Cross-Sectional Study. Healthcare 2024;12(2):213（嘉義 3,332 位 55～95 歲社區長者）。
// 每格依序為第 10、30、50、70、90 百分位；年齡組 55–59、60–64 … 85–89、90–95。
//
// 「明顯進步」門檻：椅子坐立 2 次、握力 5 公斤有研究數字；其餘是教練實務參考值（找不到正式研究數字），畫面上會標示。

export type TestKey =
  | "chair_stand"
  | "arm_curl"
  | "step_2min"
  | "sit_reach"
  | "back_scratch"
  | "up_and_go"
  | "grip"
  | "single_leg";

export type Sex = "male" | "female";

export interface TestDef {
  key: TestKey;
  name: string;
  /** 一兩個字的白話：腿力、手臂力… */
  short: string;
  /** 對生活的意義，跟長輩說的話 */
  life: string;
  unit: string;
  better: "higher" | "lower";
  decimals: 0 | 1 | 2;
  min: number;
  max: number;
  /** 倒數計時（秒）；stopwatch = 碼錶正數 */
  timer?: { kind: "countdown"; seconds: number } | { kind: "stopwatch"; max?: number };
  meaningful: number;
  meaningfulFromResearch: boolean;
  equipment: string;
  howTo: string[];
  caution?: string;
  /** 低於這個值要特別提醒（目前只有握力：亞洲肌少症共識 AWGS 2019） */
  warnBelow?: Record<Sex, number>;
}

export const TESTS: TestDef[] = [
  {
    key: "chair_stand",
    name: "30 秒椅子坐立",
    short: "腿力",
    life: "從沙發、馬桶站起來不用扶",
    unit: "次",
    better: "higher",
    decimals: 0,
    min: 0,
    max: 60,
    timer: { kind: "countdown", seconds: 30 },
    meaningful: 2,
    meaningfulFromResearch: true,
    equipment: "約 43 公分高的椅子（靠牆放穩）",
    howTo: [
      "坐在椅子中間，雙腳踩穩，雙手交叉放胸前",
      "聽到開始就完全站直、再完全坐下，算 1 次",
      "30 秒內做越多越好；時間到時已站起一半以上也算 1 次",
    ],
  },
  {
    key: "arm_curl",
    name: "30 秒手臂屈舉",
    short: "手臂力",
    life: "提菜、抱孫子、拿鍋子",
    unit: "次",
    better: "higher",
    decimals: 0,
    min: 0,
    max: 60,
    timer: { kind: "countdown", seconds: 30 },
    meaningful: 2,
    meaningfulFromResearch: false,
    equipment: "啞鈴：男 8 磅（約 3.6 公斤）、女 5 磅（約 2.3 公斤）",
    howTo: [
      "坐在椅子上，慣用手拿啞鈴、手臂垂直在身體旁邊",
      "手肘彎起到底（掌心轉向上），再完全放下，算 1 次",
      "上臂貼住身體不要晃，30 秒內做越多越好",
    ],
  },
  {
    key: "step_2min",
    name: "2 分鐘原地抬膝",
    short: "心肺耐力",
    life: "走去市場、爬坡、逛街不會喘",
    unit: "次",
    better: "higher",
    decimals: 0,
    min: 0,
    max: 250,
    timer: { kind: "countdown", seconds: 120 },
    meaningful: 10,
    meaningfulFromResearch: false,
    equipment: "牆上貼一段膠帶，標出膝蓋要抬到的高度（大約大腿一半）",
    howTo: [
      "站在牆邊，原地踏步 2 分鐘，膝蓋要抬到膠帶的高度",
      "右膝每抬到一次算 1 次",
      "累了可以扶牆或停下來休息，計時不停",
    ],
    caution: "有心臟病、高血壓沒控制好、糖尿病、關節炎或腿部受傷的人，今天不要做這一項。",
  },
  {
    key: "sit_reach",
    name: "椅子坐姿體前彎",
    short: "下半身柔軟度",
    life: "自己穿襪子、剪腳指甲、彎腰撿東西",
    unit: "公分",
    better: "higher",
    decimals: 1,
    min: -50,
    max: 50,
    meaningful: 3,
    meaningfulFromResearch: false,
    equipment: "椅子、捲尺或直尺",
    howTo: [
      "坐在椅子前緣，一腳彎曲踩地，另一腳伸直、腳跟著地、腳尖朝上",
      "雙手中指疊好，慢慢往前伸向腳尖，停 2 秒",
      "量中指到腳尖的距離：碰不到記負數、超過記正數；做 2 次取好的",
    ],
    caution: "背痛、腰椎有問題或最近大腿後側拉傷的人不要做。",
  },
  {
    key: "back_scratch",
    name: "抓背",
    short: "肩膀柔軟度",
    life: "穿脫上衣、洗背、拿高處的東西",
    unit: "公分",
    better: "higher",
    decimals: 1,
    min: -60,
    max: 40,
    meaningful: 3,
    meaningfulFromResearch: false,
    equipment: "捲尺或直尺",
    howTo: [
      "一手從肩膀上方往背後伸，另一手從腰後往上伸",
      "兩手中指盡量靠近，不要硬拉",
      "量兩個中指的距離：碰不到記負數、重疊記正數；做 2 次取好的",
    ],
  },
  {
    key: "up_and_go",
    name: "2.44 公尺起身繞物",
    short: "敏捷與平衡",
    life: "起身接電話、過馬路不慌、比較不會跌倒",
    unit: "秒",
    better: "lower",
    decimals: 2,
    min: 2,
    max: 60,
    timer: { kind: "stopwatch", max: 60 },
    meaningful: 0.5,
    meaningfulFromResearch: false,
    equipment: "椅子、碼錶，椅子前方 2.44 公尺（8 英呎）放一個寶特瓶或角錐",
    howTo: [
      "坐好、雙手放在大腿上",
      "聽到開始就站起來，盡快走（不要跑）繞過瓶子再坐回椅子",
      "從「開始」到坐下的秒數；做 2 次取快的",
    ],
    caution: "旁邊要有人跟著保護，地面不要濕滑。",
  },
  {
    key: "grip",
    name: "握力",
    short: "整體肌力",
    life: "開罐子、擰毛巾、提重物",
    unit: "公斤",
    better: "higher",
    decimals: 1,
    min: 1,
    max: 90,
    meaningful: 5,
    meaningfulFromResearch: true,
    equipment: "電子握力計（約一千元）",
    howTo: ["站直，手臂自然垂在身體旁邊、不要碰到身體", "慣用手用力握 3 秒", "量 2 次取最大的"],
    warnBelow: { male: 28, female: 18 },
  },
  {
    key: "single_leg",
    name: "開眼單足立",
    short: "靜態平衡",
    life: "站著穿褲子、上下公車",
    unit: "秒",
    better: "higher",
    decimals: 1,
    min: 0,
    max: 120,
    timer: { kind: "stopwatch", max: 120 },
    meaningful: 5,
    meaningfulFromResearch: false,
    equipment: "碼錶，旁邊有牆或椅子可以扶",
    howTo: [
      "雙手叉腰，抬起一腳（不要靠在支撐腳上）",
      "站越久越好，最多 120 秒",
      "支撐腳移動、抬起的腳落地或手離開腰就停；做 2 次取好的",
    ],
    caution: "旁邊要有人保護，或站在牆邊、椅子旁。",
  },
];

export const TEST_BY_KEY = Object.fromEntries(TESTS.map((t) => [t.key, t])) as Record<TestKey, TestDef>;

// ─────────────── 台灣常模（Wang et al. 2024），[P10, P30, P50, P70, P90] ───────────────

type Row = [number, number, number, number, number];
type NormTable = Record<Sex, Row[]>;

export const NORM_AGE_BANDS = ["55–59", "60–64", "65–69", "70–74", "75–79", "80–84", "85–89", "90–95"] as const;

const NORMS: Partial<Record<TestKey, NormTable>> = {
  chair_stand: {
    male: [
      [14, 18, 20, 24, 28.2],
      [12.9, 16, 19, 23, 28.1],
      [13, 16, 19, 22, 27],
      [12, 15, 17, 20, 24.5],
      [10, 13.7, 16, 20, 23],
      [8, 12, 14, 17, 22],
      [5, 10, 12, 14, 18],
      [5, 7.4, 11, 12, 15.8],
    ],
    female: [
      [13.7, 17, 19, 22, 28],
      [13, 16, 18, 21, 26],
      [12, 15, 17, 19, 23],
      [11, 14, 16, 18, 22],
      [10, 12, 15, 17, 22],
      [6, 10, 12, 14.9, 18],
      [6, 8.1, 10.5, 12, 16],
      [3, 7.2, 10, 11, 16.2],
    ],
  },
  arm_curl: {
    male: [
      [16, 20, 23, 25, 30],
      [15, 18, 20, 24, 28],
      [15, 18, 21, 23, 27.6],
      [14.6, 17, 19, 21.2, 24],
      [12, 15, 17, 20, 24],
      [11, 15, 16.5, 19.5, 23.5],
      [10, 13.3, 15, 17, 20],
      [8, 11.2, 14, 16.8, 21.2],
    ],
    female: [
      [14, 17, 20, 22, 26],
      [13, 17, 19, 21, 25],
      [13, 16, 18, 20, 24],
      [12, 15, 18, 20, 23.7],
      [12, 15, 17, 19, 23],
      [8, 11, 15, 17, 20.4],
      [6.6, 11, 14, 16.2, 18],
      [4, 6.8, 10, 12.2, 19.4],
    ],
  },
  step_2min: {
    male: [
      [89.4, 102, 110, 116.9, 127],
      [89, 100, 108.5, 116, 127.3],
      [87, 98, 106, 114, 128.7],
      [79.1, 94, 103, 111, 121.9],
      [70.6, 90.9, 97, 107, 120],
      [72.1, 89, 99, 103.7, 117.9],
      [41.8, 80, 94, 102.2, 113],
      [30.5, 60, 80, 90.7, 99.8],
    ],
    female: [
      [90.2, 101, 109, 116, 125.8],
      [88.4, 101, 108, 115, 126.6],
      [83, 97, 105, 113, 125],
      [70, 92, 101, 108, 120.3],
      [68.6, 90, 100, 108, 118],
      [44.6, 77, 89, 100, 111.8],
      [50.6, 73.8, 89.5, 101.9, 110],
      [30, 52.3, 79, 88.7, 97.7],
    ],
  },
  sit_reach: {
    male: [
      [-10.6, -1, 1, 7, 16],
      [-9, 0.24, 4, 9, 16],
      [-10, -1.55, 2.5, 7, 14.7],
      [-10.92, -2, 2, 7, 15.6],
      [-14.2, -2, 1, 4, 10],
      [-18, -8.2, 0, 2, 8.4],
      [-20, -10.7, 0, 2, 4.9],
      [-24.2, -17.8, -10, -3, 2.6],
    ],
    female: [
      [-4, 3, 9, 14.09, 21.52],
      [0, 4, 9, 14, 20],
      [-1, 3, 7, 13, 19],
      [-2, 2, 5, 10, 17],
      [-3, 2, 4.26, 9, 16],
      [-9.1, 0, 3, 6, 13],
      [-15.3, -1, 0, 3, 9.3],
      [-4.5, 0, 1, 3.46, 10.5],
    ],
  },
  back_scratch: {
    male: [
      [-16.4, -6.2, -1, 3, 8.7],
      [-19.9, -8.7, -1, 3, 7],
      [-17, -6.05, -1, 2, 6.7],
      [-24, -14, -5.5, 1, 5],
      [-22, -14, -7, 1, 5],
      [-28, -17, -10, 0, 4],
      [-28.7, -17.7, -13, -4, 2],
      [-26.33, -13.3, -3.8, 3, 5],
    ],
    female: [
      [-7, 0, 3, 5.5, 9],
      [-8, 0, 3, 5, 8.3],
      [-13, -4, 1, 4, 8],
      [-12, -3.68, 1, 3, 7],
      [-15, -6.05, 0, 3, 7],
      [-19, -10, -3.46, 1, 6],
      [-23.3, -14, -6.5, -3, 3.3],
      [-23.5, -13.5, -9.5, -2, 3.5],
    ],
  },
  // 秒數越少越好：P10 = 最快的 10%
  up_and_go: {
    male: [
      [3.78, 4.3, 4.71, 5, 5.74],
      [4, 4.84, 5, 5.6, 6.49],
      [4.09, 4.81, 5.34, 5.99, 7],
      [4.48, 5.37, 5.94, 6.44, 7.37],
      [5, 5.86, 6.32, 7, 9.02],
      [5.23, 6.31, 7, 7.86, 10.66],
      [6, 6.76, 7.32, 8.86, 10.67],
      [6.26, 6.47, 7.99, 9.06, 14.58],
    ],
    female: [
      [4.13, 4.71, 5.11, 5.63, 6.52],
      [4.35, 4.9, 5.32, 5.84, 6.72],
      [4.7, 5.32, 5.78, 6.26, 7.3],
      [5, 5.72, 6.24, 6.94, 8],
      [5.44, 6.2, 6.81, 7.43, 9.23],
      [6.03, 6.75, 7.6, 8.81, 11.71],
      [6.18, 6.49, 7.63, 9.42, 17.63],
      [6.21, 6.62, 7.19, 8.7, 12.82],
    ],
  },
  grip: {
    male: [
      [25.17, 30.98, 37.4, 40.3, 45.9],
      [22.01, 30.72, 34.9, 38.74, 43.09],
      [25.06, 29.94, 35, 38.4, 44.32],
      [23.16, 27.9, 31.4, 34.9, 39.4],
      [19.99, 25.57, 29, 33.55, 38.02],
      [18.42, 23.78, 26.3, 29.34, 33.54],
      [17.52, 22.96, 24.7, 26.1, 30.97],
      [14.06, 16.38, 18.3, 23.08, 27.72],
    ],
    female: [
      [19.7, 22.9, 24.8, 27.55, 30.9],
      [17.66, 21.4, 23.9, 26.1, 29.2],
      [17.36, 20.49, 22.7, 24.9, 28.57],
      [16.1, 19.31, 21.65, 23.8, 27.1],
      [13.78, 17.47, 19.8, 22.1, 24.91],
      [11.89, 15.8, 17.9, 19.73, 22.41],
      [9.6, 13.7, 16.5, 18.3, 22.3],
      [9.1, 12.88, 14, 15.08, 19.24],
    ],
  },
};

export const NORM_SOURCE =
  "Wang 等人 2024 年發表的台灣嘉義社區長者常模（3,332 位、55～95 歲）";

export function hasNorms(key: TestKey): boolean {
  return Boolean(NORMS[key]);
}

/** 依出生年算年齡（只用年份，誤差 1 歲內） */
export function ageFromBirthYear(birthYear: number | null | undefined, today: string): number | null {
  if (!birthYear) return null;
  return Number(today.slice(0, 4)) - birthYear;
}

/** 年齡 → 常模年齡組（55 歲以下沒有常模） */
export function ageBandIndex(age: number | null): number | null {
  if (age == null || age < 55) return null;
  return Math.min(Math.floor((age - 55) / 5), NORM_AGE_BANDS.length - 1);
}

const KNOTS = [10, 30, 50, 70, 90];

/** 估計原始值在常模中的百分位（線性內插），回傳 0～100 */
function rawPercentile(row: Row, value: number): number {
  if (value <= row[0]) return value === row[0] ? 10 : 5;
  if (value >= row[4]) return value === row[4] ? 90 : 95;
  for (let i = 0; i < 4; i++) {
    const a = row[i];
    const b = row[i + 1];
    if (value >= a && value <= b) {
      if (b === a) return KNOTS[i + 1];
      return KNOTS[i] + ((value - a) / (b - a)) * (KNOTS[i + 1] - KNOTS[i]);
    }
  }
  return 50;
}

export interface PeerRank {
  /** 贏過同齡同性別約幾 % 的人（越高越好，秒數項目已反轉） */
  beats: number;
  tier: "top" | "good" | "average" | "low" | "weak";
  tierLabel: string;
  bandLabel: string;
  /** 跟哪個年齡組的「平均」差不多 */
  likeAgeBand: string;
}

const TIER_LABEL: Record<PeerRank["tier"], string> = {
  top: "很棒",
  good: "不錯",
  average: "同齡平均",
  low: "稍弱",
  weak: "要加強",
};

export function peerRank(key: TestKey, value: number | null, sex: Sex | null, age: number | null): PeerRank | null {
  const table = NORMS[key];
  const band = ageBandIndex(age);
  if (!table || value == null || !sex || band == null) return null;
  const rows = table[sex];
  const def = TEST_BY_KEY[key];
  let p = rawPercentile(rows[band], value);
  if (def.better === "lower") p = 100 - p;
  const beats = Math.round(Math.min(95, Math.max(5, p)));
  const tier: PeerRank["tier"] = beats >= 90 ? "top" : beats >= 70 ? "good" : beats >= 30 ? "average" : beats >= 10 ? "low" : "weak";

  // 最接近哪一組的中位數；同樣接近時取年輕的那組
  let best = 0;
  for (let i = 1; i < rows.length; i++) {
    if (Math.abs(rows[i][2] - value) < Math.abs(rows[best][2] - value)) best = i;
  }
  return {
    beats,
    tier,
    tierLabel: TIER_LABEL[tier],
    bandLabel: NORM_AGE_BANDS[band],
    likeAgeBand: NORM_AGE_BANDS[best],
  };
}

export type Change = "better" | "worse" | "same";

/** 兩次之間的變化（往「好」的方向為正） */
export function compare(key: TestKey, before: number | null, after: number | null): { delta: number; change: Change } | null {
  if (before == null || after == null) return null;
  const def = TEST_BY_KEY[key];
  const raw = after - before;
  const delta = def.better === "lower" ? -raw : raw;
  const eps = 1e-9;
  const change: Change = delta >= def.meaningful - eps ? "better" : delta <= -def.meaningful + eps ? "worse" : "same";
  return { delta, change };
}

export function formatValue(key: TestKey, v: number | null | undefined): string {
  if (v == null) return "—";
  const d = TEST_BY_KEY[key].decimals;
  const n = Number(v);
  return d === 0 ? String(Math.round(n)) : Number.isInteger(n) ? String(n) : n.toFixed(d).replace(/0+$/, "").replace(/\.$/, "");
}

/** 「多 3 次」「快 0.8 秒」「多 2.5 公分」 */
export function deltaLabel(key: TestKey, delta: number): string {
  const def = TEST_BY_KEY[key];
  const abs = Math.abs(delta);
  const n = def.decimals === 0 ? String(Math.round(abs)) : abs.toFixed(def.decimals).replace(/0+$/, "").replace(/\.$/, "");
  if (abs < 1e-9) return "一樣";
  if (def.key === "up_and_go") return `${delta > 0 ? "快" : "慢"} ${n} 秒`;
  if (def.key === "single_leg") return `${delta > 0 ? "多站" : "少站"} ${n} 秒`;
  return `${delta > 0 ? "多" : "少"} ${n} ${def.unit}`;
}

// ─────────────── 運動前安全檢查（參考 PAR-Q） ───────────────

export const SCREEN_QUESTIONS = [
  "醫生曾說你心臟有問題，而且只能做醫生建議的運動？",
  "運動時會胸痛嗎？",
  "最近一個月，沒在運動時也曾胸痛嗎？",
  "曾經因為頭暈而跌倒，或曾經昏倒過嗎？",
  "有骨頭或關節的問題，運動可能讓它變嚴重嗎？",
  "醫生目前有開藥控制你的血壓或心臟嗎？",
  "有其他原因讓你覺得不適合運動嗎？",
] as const;

export type VitalsLevel = "ok" | "high" | "stop";

/** 測前血壓心跳：偏高 → 先休息再量；過高 → 今天不要測 */
export function vitalsLevel(sys: number | null, dia: number | null, hr: number | null): VitalsLevel {
  if ((sys != null && sys >= 180) || (dia != null && dia >= 110)) return "stop";
  if ((sys != null && sys >= 140) || (dia != null && dia >= 90) || (hr != null && hr > 100)) return "high";
  return "ok";
}

// ─────────────── 生活目標與每週感受 ───────────────

export const GOAL_SUGGESTIONS = [
  "不扶扶手爬到 3 樓",
  "從地上自己站起來",
  "提 5 公斤的菜走回家",
  "陪孫子逛公園 30 分鐘",
  "站著穿褲子和襪子",
  "蹲下撿東西再站起來",
  "走 20 分鐘不用休息",
  "上下公車不用拉扶手",
];

/** 生活目標分數變化 ≥ 2 分算「有感進步」（實務參考值） */
export const GOAL_MEANINGFUL = 2;
/** 多久沒重打分數就提醒（天） */
export const GOAL_RERATE_DAYS = 28;

export function goalScoreLabel(score: number): string {
  if (score <= 1) return "做不到";
  if (score <= 3) return "很吃力";
  if (score <= 6) return "勉強可以";
  if (score <= 8) return "還算順";
  return "很輕鬆";
}

export function painLabel(p: number): string {
  if (p === 0) return "不痛";
  if (p <= 3) return "有點痛";
  if (p <= 6) return "會影響生活";
  return "很痛";
}

export const SLEEP_SCALE = [
  { value: 1, emoji: "😣", label: "很差" },
  { value: 2, emoji: "😕", label: "不太好" },
  { value: 3, emoji: "😐", label: "普通" },
  { value: 4, emoji: "🙂", label: "不錯" },
  { value: 5, emoji: "😊", label: "很好" },
] as const;

export const ENERGY_SCALE = [
  { value: 1, emoji: "😩", label: "沒力" },
  { value: 2, emoji: "😮‍💨", label: "有點累" },
  { value: 3, emoji: "😐", label: "普通" },
  { value: 4, emoji: "🙂", label: "還不錯" },
  { value: 5, emoji: "💪", label: "精神很好" },
] as const;

export const PAIN_AREAS = ["膝蓋", "腰", "肩膀", "脖子", "髖部", "腳踝", "手腕"];
