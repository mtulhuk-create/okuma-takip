export type PublicUser = { id: string; name: string; username: string | null; imageUrl: string | null };
export type Period = { dayKey: string; start: string; deadline: string; nextStart: string };
export type PenaltyMode = "FIXED" | "PER_PAGE";

export type Group = {
  id: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  ownerId: string;
  minPages: number;
  penaltyMode: PenaltyMode;
  penaltyAmount: number;
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
  dailyPages: number;
  joinedAt: string;
  user: PublicUser;
};

export type ReadingLog = { userId: string; dayKey: string; pages: number; requiredPages: number };
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
    dailyPages: number;
    role: Member["role"];
    period: Period;
    open: Period | null;
    myPages: number | null;
    reportedCount: number;
    memberCount: number;
  }[];
};

type GroupWithCount = Group & { _count: { members: number } };
export type GroupsResponse = {
  mine: { role: Member["role"]; dailyPages: number; group: GroupWithCount }[];
  publicGroups: (GroupWithCount & { owner: { name: string } })[];
  requestedIds: string[];
};

export type GroupDetailResponse =
  | { private: true; group: { id: string; name: string } }
  | {
      private?: undefined;
      group: Group & { owner: { name: string }; members: Member[] };
      me: Member | null;
      invite: { id: string; inviter: PublicUser } | null;
      request: { id: string } | null;
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
  requests: { id: string; message: string | null; user: PublicUser }[];
  invites: { id: string; invitee: PublicUser }[];
  dues: Due[];
  unpaidPenalties: Penalty[];
  money: Record<string, { unpaid: number; inDue: number }>;
};

export type NotificationsResponse = {
  invites: { id: string; inviter: PublicUser; group: GroupWithCount }[];
  notes: { id: string; title: string; body: string; url: string | null; read: boolean; createdAt: string }[];
};

export type ProfileResponse = {
  user: PublicUser & { email: string | null };
  stats: { totalPages: number; readDays: number; totalPenalty: number; activeGroups: number };
};

export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string };
