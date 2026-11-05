// Mobil uygulamanın değişiklik istekleri: web'deki server action'ların aynısını çalıştırır.
import * as actions from "@/app/actions";
import type { ActionState } from "@/lib/action-state";
import { withUser } from "@/lib/api";

type Fn = (fd: FormData) => Promise<ActionState>;
const wrap = (a: (prev: ActionState, fd: FormData) => Promise<ActionState>): Fn => (fd) => a(null, fd);

const ACTIONS: Record<string, Fn> = {
  saveFullName: wrap(actions.saveFullName),
  createGroup: actions.createGroupState,
  updateGroup: wrap(actions.updateGroup),
  deleteGroup: actions.deleteGroupState,
  leaveGroup: actions.leaveGroupState,
  reportReading: wrap(actions.reportReading),
  requestJoin: wrap(actions.requestJoin),
  cancelJoinRequest: wrap(actions.cancelJoinRequest),
  respondJoinRequest: wrap(actions.respondJoinRequest),
  inviteUser: wrap(actions.inviteUser),
  cancelInvite: wrap(actions.cancelInvite),
  respondInvite: wrap(actions.respondInvite),
  removeMember: wrap(actions.removeMember),
  toggleAdmin: wrap(actions.toggleAdmin),
  createDue: wrap(actions.createDue),
  submitPayment: wrap(actions.submitPayment),
  resolvePayment: wrap(actions.resolvePayment),
  waivePenalty: wrap(actions.waivePenalty),
  markAllRead: wrap(actions.markAllRead),
  sendMessage: wrap(actions.sendMessage),
  createPoll: wrap(actions.createPoll),
  votePoll: wrap(actions.votePoll),
  deleteMessage: wrap(actions.deleteMessage),
  requestTeamChange: wrap(actions.requestTeamChange),
  respondTeamChange: wrap(actions.respondTeamChange),
  setMemberTeam: wrap(actions.setMemberTeam),
};

export const POST = withUser(async (_user, req, ctx: { params: Promise<{ name: string }> }) => {
  const { name } = await ctx.params;
  const fn = ACTIONS[name];
  if (!fn) return Response.json({ error: "Bilinmeyen işlem" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) if (v !== undefined && v !== null) fd.set(k, String(v));
  const res = await fn(fd);
  return Response.json(res ?? { ok: true }, { status: res?.error ? 400 : 200 });
});
