export type PublicUser = { id: string; name: string; username: string | null; imageUrl: string | null };
export type Period = { dayKey: string; start: string; deadline: string; nextStart: string };
export type PenaltyMode = "FIXED" | "PER_PAGE";

export type Rules = { penaltyMode: PenaltyMode; targetPages: number; minPages: number; penaltyAmount: number; minDiscount: number };
export type Team = Rules & { id: string; name: string; position: number };

export type Group = Rules & {
  id: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  chatPolicy: "ALL" | "ADMINS";
  teamsEnabled: boolean;
  teams: Team[];
  ownerId: string;
  iban: string;
  ibanName: string;
  startMinute: number;
  deadlineMinute: number;
  reminderHours: number;
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
};

export type ReadingLog = { userId: string; dayKey: string; pages: number; requiredPages: number; minPages: number };

export type DayPerson = { id: string; name: string; imageUrl: string | null; pages: number | null; required: number };
export type DayCard = {
  dayKey: string;
  start: string;
  deadline: string;
  open: boolean;
  read: DayPerson[];
  min: DayPerson[];
  none: DayPerson[];
  pending: DayPerson[];
  me: { eligible: boolean; pages: number | null; target: number; min: number; teamName: string | null } | null;
};
export type WeekCell = "read" | "min" | "none" | "pending" | "na";
export type PenaltyStatus = "UNPAID" | "IN_DUE" | "PAID" | "WAIVED";
export type Penalty = { id: string; userId: string; dayKey: string; amount: number; pagesRead: number; requiredPages: number; status: PenaltyStatus; user?: PublicUser };
export type DueStatus = "PENDING" | "SUBMITTED" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
export type Due = { id: string; userId: string; amount: number; dueAt: string; status: DueStatus; paymentNote: string | null; user?: PublicUser };

export type MeResponse = {
  user: PublicUser;
  badge: number;
  money: { unpaidTotal: number; dues: (Due & { groupId: string; group: { name: string; tzOffset: number } })[] };
  groups: {
    group: Pick<Group, "id" | "name" | "startMinute" | "deadlineMinute" | "visibility">;
    role: Member["role"];
    rules: Rules & { teamName: string | null };
    period: Period;
    open: Period | null;
    card: DayCard;
    week: { days: string[]; rows: { user: PublicUser; cells: WeekCell[] }[] };
  }[];
};

type GroupWithCount = Group & { _count: { members: number } };
export type GroupsResponse = {
  mine: { role: Member["role"]; teamId: string | null; group: GroupWithCount }[];
  publicGroups: (GroupWithCount & { owner: { name: string }; teams: { id: string; name: string }[] })[];
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
  user: PublicUser & { email: string | null };
  stats: { totalPages: number; readDays: number; totalPenalty: number; activeGroups: number };
};

export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string };

export type PollView = { id: string; question: string; multiple: boolean; voters: number; options: { id: string; text: string; votes: number; mine: boolean; names: string[] }[] };
export type ChatMessage = {
  id: string;
  kind: "TEXT" | "DAY" | "POLL";
  text: string | null;
  createdAt: string;
  user: { id: string; name: string; imageUrl: string | null } | null;
  day: DayCard | null;
  poll: PollView | null;
  pending?: boolean;
  failed?: boolean;
};
export type ChatResponse = {
  cursor: number;
  group: { id: string; name: string; chatPolicy: "ALL" | "ADMINS"; memberCount: number; deadlineMinute: number };
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

export function describePenalty(r: Rules) {
  if (r.penaltyMode === "PER_PAGE") return `Eksik sayfa başına ${r.penaltyAmount} TL`;
  return r.minDiscount > 0 ? `${r.penaltyAmount} TL · alt sınırda %${r.minDiscount} indirim` : `${r.penaltyAmount} TL / gün`;
}
