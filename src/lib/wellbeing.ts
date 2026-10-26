export const CHECKIN_TABLE = "wellbeing_checkins";
export const CHECKIN_UPDATED_EVENT = "wellbeing:updated";

export type CheckinValues = {
  energy: number;
  mood: number;
  sleep: number;
  nutrition: number;
  activity: number;
};

export type CheckinRow = CheckinValues & {
  week_start: string;
};

export const DEFAULT_CHECKIN: CheckinValues = {
  energy: 3,
  mood: 3,
  sleep: 3,
  nutrition: 3,
  activity: 3,
};

export const QUESTIONS: Array<{
  key: keyof CheckinValues;
  label: string;
}> = [
  { key: "energy", label: "Mon énergie cette semaine" },
  { key: "mood", label: "Mon moral cette semaine" },
  { key: "sleep", label: "La qualité de mon sommeil" },
  { key: "nutrition", label: "La qualité de mon alimentation" },
  { key: "activity", label: "Ma régularité sportive" },
];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekStart(date: Date = new Date()): string {
  const copy = new Date(date);
  const day = copy.getDay();
  const difference = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + difference);
  return formatDate(copy);
}

export function getTodayKey(): string {
  return formatDate(new Date());
}

export const LEVELS = [
  { name: "Démarrage", min: 0 },
  { name: "Régulier", min: 30 },
  { name: "Engagé", min: 80 },
  { name: "Expert", min: 150 },
];

export const POINTS_PER_CHECKIN = 10;

export type BadgeInfo = {
  id: "first" | "streak3" | "energy_up" | "sleep" | "sport";
  label: string;
  description: string;
  earned: boolean;
};

export type Progress = {
  count: number;
  points: number;
  levelName: string;
  levelIndex: number;
  nextLevelName: string | null;
  pointsToNext: number;
  progressPercent: number;
  currentStreak: number;
  badges: BadgeInfo[];
};

function weekIndex(weekStart: string): number {
  const [year, month, day] = weekStart.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / (7 * 86400000));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeProgress(rows: CheckinRow[]): Progress {
  const sorted = [...rows].sort((a, b) =>
    a.week_start < b.week_start ? 1 : -1,
  );

  const count = sorted.length;
  const points = count * POINTS_PER_CHECKIN;

  let levelIndex = 0;
  LEVELS.forEach((level, index) => {
    if (points >= level.min) levelIndex = index;
  });

  const current = LEVELS[levelIndex];
  const next = LEVELS[levelIndex + 1] ?? null;

  const progressPercent = next
    ? Math.min(
        100,
        Math.round(((points - current.min) / (next.min - current.min)) * 100),
      )
    : 100;

  const weeks = Array.from(
    new Set(sorted.map((row) => weekIndex(row.week_start))),
  ).sort((a, b) => b - a);

  const thisWeek = weekIndex(getWeekStart());

  let currentStreak = 0;
  if (weeks.length > 0 && (weeks[0] === thisWeek || weeks[0] === thisWeek - 1)) {
    currentStreak = 1;
    for (let i = 1; i < weeks.length; i += 1) {
      if (weeks[i] === weeks[i - 1] - 1) currentStreak += 1;
      else break;
    }
  }

  let bestStreak = 0;
  let run = 0;
  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    if (i === weeks.length - 1 || weeks[i] === weeks[i + 1] + 1) run += 1;
    else run = 1;
    if (run > bestStreak) bestStreak = run;
  }

  const energyUp =
    sorted.length >= 4 &&
    average(sorted.slice(0, 2).map((row) => row.energy)) >
      average(sorted.slice(2, 4).map((row) => row.energy));

  const goodSleep =
    sorted.length >= 3 && sorted.slice(0, 3).every((row) => row.sleep >= 4);

  const goodActivity =
    sorted.length >= 3 && sorted.slice(0, 3).every((row) => row.activity >= 4);

  const badges: BadgeInfo[] = [
    {
      id: "first",
      label: "Premier pas",
      description: "Remplir votre premier bilan.",
      earned: count >= 1,
    },
    {
      id: "streak3",
      label: "3 semaines d’affilée",
      description: "Remplir votre bilan 3 semaines de suite.",
      earned: bestStreak >= 3,
    },
    {
      id: "energy_up",
      label: "Énergie en hausse",
      description: "Une énergie en progression sur vos dernières semaines.",
      earned: energyUp,
    },
    {
      id: "sleep",
      label: "Bon sommeil",
      description: "Un sommeil satisfaisant pendant 3 semaines.",
      earned: goodSleep,
    },
    {
      id: "sport",
      label: "Sportif régulier",
      description: "Une activité régulière pendant 3 semaines.",
      earned: goodActivity,
    },
  ];

  return {
    count,
    points,
    levelName: current.name,
    levelIndex,
    nextLevelName: next ? next.name : null,
    pointsToNext: next ? next.min - points : 0,
    progressPercent,
    currentStreak,
    badges,
  };
}