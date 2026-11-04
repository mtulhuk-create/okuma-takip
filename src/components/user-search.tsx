"use client";

import { useEffect, useState } from "react";
import { inviteUser } from "@/app/actions";
import { ActionForm, SubmitButton } from "./action-form";
import { Avatar } from "./avatar";

type Result = { id: string; name: string; username: string | null; imageUrl: string | null; isMember: boolean; invited: boolean };

export function UserSearch({ groupId }: { groupId: string }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (q.trim().length < 2) {
      setUsers([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&groupId=${groupId}`, { signal: ctrl.signal });
        const data = await res.json();
        setUsers(data.users ?? []);
      } catch {}
      setLoading(false);
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, groupId, tick]);

  return (
    <div className="space-y-3">
      <input className="input" placeholder="🔍 İsim veya kullanıcı adı ara..." value={q} onChange={(e) => setQ(e.target.value)} />
      {loading && <p className="text-xs text-muted-foreground">Aranıyor...</p>}
      {!loading && q.trim().length >= 2 && users.length === 0 && <p className="text-xs text-muted-foreground">Kullanıcı bulunamadı. Kişinin uygulamaya en az bir kez giriş yapmış olması gerekir.</p>}
      <ul className="divide-y divide-border">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-2">
            <Avatar name={u.name} src={u.imageUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{u.name}</p>
              {u.username && <p className="truncate text-xs text-muted-foreground">@{u.username}</p>}
            </div>
            {u.isMember ? (
              <span className="badge bg-emerald-100 text-emerald-700">Üye</span>
            ) : u.invited ? (
              <span className="badge bg-amber-100 text-amber-700">Davet edildi</span>
            ) : (
              <ActionForm action={inviteUser} onSuccess={() => setTick((t) => t + 1)}>
                <input type="hidden" name="groupId" value={groupId} />
                <input type="hidden" name="userId" value={u.id} />
                <SubmitButton className="btn-primary btn-sm">Davet et</SubmitButton>
              </ActionForm>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
