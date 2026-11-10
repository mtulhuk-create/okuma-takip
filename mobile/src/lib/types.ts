/** initial: avatar harfi (hesap adının baş harfi; eski sunucuda yok) */
/** Ekip hiyerarşisi çerçevesi (gruba özel): altın en üst ekip */
export type Tier = "gold" | "silver" | "bronze";
export type PublicUser = { id: string; name: string; username: string | null; imageUrl: string | null; initial?: string };
export type Me = PublicUser & { nameConfirmed: boolean };
export type Period = { dayKey: string; start: string; deadline: string; nextStart: string };
export type PenaltyMode = "FIXED" | "PER_PAGE";

export type Book = { id: string; title: string; targetPages: number; minPages: number };
export type Rules = { penaltyMode: PenaltyMode; targetPages: number; minPages: number; penaltyAmount: number; minDiscount: number; books: Book[] };
export type BookLog = { id: string; title: string; pages: number | null; target: number; min: number; /** başka gruplarla "aynı eser" bağı */ linked?: string[] };

/** Eser listesi yoksa (eski gruplar) toplam hedef tek eser sayılır */
export function booksOf(r: { targetPages: number; minPages: number; books?: unknown }): Book[] {
  const b = Array.isArray(r.books) ? (r.books as Book[]) : [];
  return b.length ? b : [{ id: "genel", title: "Günlük okuma", targetPages: r.targetPages, minPages: r.minPages }];
}
export type Team = Rules & { id: string; name: string; position: number };

export type Group = Rules & {
  id: string;
  name: string;
  createdAt?: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  chatPolicy: "ALL" | "ADMINS";
  teamsEnabled: boolean;
  shareProgress: boolean;
  teams: Team[];
  ownerId: string;
  iban: string;
  ibanName: string;
  startMinute: number;
  deadlineMinute: number;
  reminderHours: number;
  dueOffsetDays?: number;
  kickOnExpire?: boolean;
  nameDisplay?: "ENTERED" | "ACCOUNT" | "BOTH";
  badgesEnabled?: boolean;
  /** Görünüm ayarları (eski sunucuda yok) */
  streaksEnabled?: boolean;
  framesEnabled?: boolean;
  dayDetails?: boolean;
  tzOffset: number;
};

export type Member = {
  id: string;
  groupId: string;
  userId: string;
  role: "ADMIN" | "MEMBER";
  teamId: string | null;
  joinedAt: string;
  user: PublicUser;
  /** Gruba özel etkin rozet (yalnızca üyelere gelir) */
  badge?: BadgeTag | null;
  streak?: StreakTag | null;
  tier?: Tier | null;
};

export type ReadingLog = { userId: string; dayKey: string; pages: number; requiredPages: number; minPages: number };

export type DayPerson = { id: string; name: string; imageUrl: string | null; initial?: string; pages: number | null; required: number; kefaret?: number; tier?: Tier };
/** Süren kefaret okuması: hedefin üstüne ek sayfa, her gün indirimin bir payını kazandırır */
export type DayKefaret = {
  planId: string;
  dailyExtra: number;
  days: number;
  doneDays: number;
  discountTotal: number;
  earned: number;
  startDay: string;
  /** Eski sunucuda yok */
  discountPercent?: number;
  usedDays?: string[];
};
export type DayCard = {
  dayKey: string;
  start: string;
  deadline: string;
  open: boolean;
  read: DayPerson[];
  min: DayPerson[];
  none: DayPerson[];
  pending: DayPerson[];
  me: {
    eligible: boolean;
    pages: number | null;
    target: number;
    min: number;
    teamName: string | null;
    books: BookLog[];
    /** Bu gün kefaret okuması bildirildiyse ek sayfa (eski sunucuda yok) */
    kefaret?: number;
    plan?: DayKefaret | null;
    /** Butonlarda gösterilen ceza: alt sınır / okumadı (eski sunucuda yok) */
    fine?: { min: number; none: number };
  } | null;
  /** O günün toplam cezası (eski sunucuda yok) */
  penaltyTotal?: number;
  penaltyFinal?: boolean;
  /** Ayrıntı kapalı: read = bildirenler, pending = bildirmeyenler */
  simple?: boolean;
};

export type Stats = { read: number; min: number; none: number; pages: number };
export type HistoryRow = { start: string; cells: string; stats: Stats };
export type HistoryRange = "7d" | "1m" | "3m" | "1y" | "all";
/** streak: bugünden geriye kesintisiz okunan gün sayısı */
/** fullStreak: üst üste tam (hedef) okunan gün; eski sunucuda yok */
export type MyHistory = { all: (HistoryRow & { streak?: number; fullStreak?: number }) | null; groups: (HistoryRow & { streak?: number; fullStreak?: number; tier?: Tier | null; group: { id: string; name: string } })[] };
/** Okuma serisi (3 gün ve üstü); full: tam okuma serisi */
export type StreakTag = { n: number; full: boolean };
export type GroupHistory = { limited: boolean; rows: (HistoryRow & { user: PublicUser; me: boolean; streak?: StreakTag | null; tier?: Tier | null })[] };
export type PenaltyStatus = "UNPAID" | "IN_DUE" | "PAID" | "WAIVED";
export type Penalty = { id: string; userId: string; dayKey: string; amount: number; originalAmount?: number | null; pagesRead: number; requiredPages: number; status: PenaltyStatus; user?: PublicUser };
export type DueStatus = "PENDING" | "SUBMITTED" | "OVERDUE" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
/** Vade bilgisi; ek süre / karar süresi alanları eski sunucuda yok */
export type DueInfo = { dueAt: string; status: DueStatus; originalDueAt?: string | null; extensions?: number; decisionUntil?: string | null };
export type Due = DueInfo & { id: string; userId: string; amount: number; paymentNote: string | null; user?: PublicUser };

export type MeResponse = {
  user: Me;
  badge: number;
  money: {
    unpaidTotal: number;
    dues: (Due & { groupId: string; group: { name: string; tzOffset: number } })[];
    debts?: Debt[];
  };
  groups: {
    group: Pick<Group, "id" | "name" | "startMinute" | "deadlineMinute" | "visibility">;
    role: Member["role"];
    rules: Rules & { teamName: string | null };
    period: Period;
    open: Period | null;
    card: DayCard;
  }[];
};

type GroupWithCount = Group & { _count: { members: number } };
type TeamRules = Pick<Rules, "targetPages" | "minPages" | "penaltyMode" | "penaltyAmount" | "minDiscount"> & { id: string; name: string; books?: unknown };
export type GroupToday = {
  groupId: string;
  dayKey: string;
  deadline: string;
  open: boolean;
  reported: number;
  myPages: number | null;
  myTarget: number;
  myMin: number;
  teamName: string | null;
  /** Kişinin bu gruptaki eserleri (eski sunucuda yok) */
  books?: string[];
  penalty: string;
  debt: number;
  due?: (DueInfo & { id: string; amount: number }) | null;
};
export type GroupsResponse = {
  mine: { role: Member["role"]; teamId: string | null; group: GroupWithCount & { teams?: TeamRules[] } }[];
  /** Eski sunucuda yok */
  today?: GroupToday[];
  publicGroups: (GroupWithCount & { owner: { name: string }; teams: TeamRules[] })[];
  requestedIds: string[];
};

export type GroupDetailResponse =
  | { private: true; group: { id: string; name: string } }
  | {
      private?: undefined;
      group: Group & { owner: { name: string }; members: Member[] };
      me: Member | null;
      myRules: (Rules & { teamName: string | null }) | null;
      invite: { id: string; inviter: PublicUser } | null;
      request: { id: string } | null;
      teamChange: { team: { name: string } } | null;
      board: {
        period: Period;
        open: Period | null;
        days: string[];
        dayStarts: Record<string, string>;
        logs: ReadingLog[];
        penalties: Penalty[];
        dues: Due[];
      } | null;
    };

export type AdminResponse = {
  group: Group;
  /** Grubun varsayılan vadesi (ay sonu ± gün); eski sunucuda yok */
  defaultDueAt?: string;
  members: Member[];
  requests: { id: string; message: string | null; teamId: string | null; user: PublicUser }[];
  teamChanges: { id: string; userId: string; user: PublicUser; team: { name: string } }[];
  invites: { id: string; invitee: PublicUser }[];
  dues: Due[];
  unpaidPenalties: Penalty[];
  money: Record<string, { unpaid: number; inDue: number }>;
};

export type NotificationsResponse = {
  invites: { id: string; inviter: PublicUser; group: GroupWithCount & { teams: { id: string; name: string }[] } }[];
  notes: { id: string; title: string; body: string; url: string | null; read: boolean; createdAt: string }[];
};

export type ProfileResponse = {
  user: Me & { email: string | null };
  stats: { totalPages: number; readDays: number; totalPenalty: number; activeGroups: number };
};

export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string };

export type PollView = { id: string; question: string; multiple: boolean; voters: number; options: { id: string; text: string; votes: number; mine: boolean; names: string[] }[] };
export type BadgeTag = { kind: "GOOD" | "BAD"; label: string };
export type BadgeView = {
  id: string;
  event: "VOTE" | "AWARD" | "END";
  kind: "GOOD" | "BAD";
  status: "VOTING" | "ACTIVE" | "ENDED" | "CANCELLED";
  label: string | null;
  user: { id: string; name: string; imageUrl: string | null };
  isMe: boolean;
  voteUntil: string | null;
  voting: boolean;
  voters: number;
  options: { id: string; label: string; votes: number; mine: boolean; canDelete: boolean }[];
  canVote: boolean;
  proposed: boolean;
  canRemove: boolean;
};
export type ChatMessage = {
  id: string;
  kind: "TEXT" | "DAY" | "POLL" | "BADGE";
  text: string | null;
  createdAt: string;
  user: { id: string; name: string; imageUrl: string | null; initial?: string; badge?: BadgeTag | null; streak?: StreakTag | null; tier?: Tier | null } | null;
  day: DayCard | null;
  poll: PollView | null;
  badge?: BadgeView | null;
  pending?: boolean;
  failed?: boolean;
};
export type Debt = { group: { id: string; name: string; iban: string; ibanName: string }; amount: number; due: (DueInfo & { id: string; amount: number }) | null };
export type GroupCash = {
  expected: number;
  /** Kurulduğundan beri kasaya giren; vadeli bekleyen toplam (eski sunucuda yok) */
  paidTotal?: number;
  inDue?: number;
  inDueCount?: number;
  nextDueAt?: string | null;
  myDebt: number;
  myDue: (DueInfo & { id: string; amount: number }) | null;
  defaultDueAt: string;
  iban: string;
  ibanName: string;
};
export type ChatResponse = {
  cursor: number;
  group: { id: string; name: string; chatPolicy: "ALL" | "ADMINS"; memberCount: number; deadlineMinute: number; today?: string };
  kasa?: GroupCash | null;
  todayCard?: DayCard | null;
  me: { userId: string; role: Member["role"]; canPost: boolean };
  messages: ChatMessage[];
  hasMore: boolean;
};

export const teamsActive = (g: { teamsEnabled: boolean; teams?: unknown[] }) => g.teamsEnabled && (g.teams?.length ?? 0) >= 2;

export function penaltyFor(r: Rules, pages: number) {
  if (pages >= r.targetPages) return 0;
  if (r.penaltyMode === "PER_PAGE") return r.penaltyAmount * (r.targetPages - pages);
  return pages >= r.minPages ? Math.round((r.penaltyAmount * (100 - r.minDiscount)) / 100) : r.penaltyAmount;
}

export function describePenalty(r: Pick<Rules, "penaltyMode" | "penaltyAmount" | "minDiscount">) {
  if (r.penaltyMode === "PER_PAGE") return `Eksik sayfa başına ${r.penaltyAmount} TL`;
  return r.minDiscount > 0 ? `${r.penaltyAmount} TL · alt sınırda %${r.minDiscount} indirim` : `${r.penaltyAmount} TL / gün`;
}
