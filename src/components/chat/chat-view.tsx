"use client";

import { ArrowDown, ArrowLeft, BarChart3, CalendarRange, Info, Lock, Receipt, SendHorizontal, Settings } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { sendMessage } from "@/app/actions";
import type { ChatPage } from "@/lib/chat";
import { formatDayLong } from "@/lib/schedule";
import { DayCardFull } from "../day-card";
import { Bubble, PollBody, type UiMessage } from "./message-items";
import { GroupHistory } from "./group-history";
import { PollDialog } from "./poll-dialog";

type Page = Extract<ChatPage, { messages: unknown }>;

/** Türkiye saatine göre takvim günü */
const trDay = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

function dayLabel(day: string) {
  const today = trDay(new Date().toISOString());
  const yesterday = trDay(new Date(Date.now() - 86_400_000).toISOString());
  if (day === today) return "Bugün";
  if (day === yesterday) return "Dün";
  return formatDayLong(day);
}

export function ChatView({ initial, dueBanner }: { initial: Page; dueBanner: { amount: number } | null }) {
  const groupId = initial.group.id;
  const [messages, setMessages] = useState<UiMessage[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [me, setMe] = useState(initial.me!);
  const [text, setText] = useState("");
  const [pollOpen, setPollOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [live, setLive] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const cursor = useRef(initial.cursor);
  const loadingOlder = useRef(false);
  const stickBottom = useRef(true);

  const scrollToBottom = (smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  /** Son sayfayı sunucudan alıp eldeki eski mesajlarla birleştirir */
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/m/groups/${groupId}/chat`, { cache: "no-store" });
    if (!res.ok) return;
    const page = (await res.json()) as Page;
    setMe(page.me!);
    setMessages((prev) => {
      const first = page.messages[0]?.createdAt;
      const older = first ? prev.filter((m) => !m.pending && m.createdAt < first) : [];
      const pending = prev.filter((m) => m.pending || m.failed);
      return [...older, ...page.messages, ...pending.filter((p) => !page.messages.some((m) => m.text === p.text && m.user?.id === p.user?.id && m.createdAt >= p.createdAt))];
    });
  }, [groupId]);

  async function loadOlder() {
    if (loadingOlder.current || !hasMore || !messages.length) return false;
    loadingOlder.current = true;
    const el = scroller.current!;
    const prevHeight = el.scrollHeight;
    const res = await fetch(`/api/m/groups/${groupId}/chat?before=${encodeURIComponent(messages[0].createdAt)}`, { cache: "no-store" });
    if (res.ok) {
      const page = (await res.json()) as Page;
      setHasMore(page.hasMore);
      setMessages((prev) => [...page.messages.filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
      requestAnimationFrame(() => (el.scrollTop += el.scrollHeight - prevHeight));
    }
    loadingOlder.current = false;
    return res.ok;
  }

  // İlk açılış: bağlantıdaki güne (#gun-YYYY-MM-DD) ya da en alta kaydır
  useLayoutEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    const target = hash ? document.getElementById(hash) : null;
    if (target) {
      stickBottom.current = false;
      target.scrollIntoView({ block: "center" });
      target.classList.add("ring-2", "ring-primary");
      setTimeout(() => target.classList.remove("ring-2", "ring-primary"), 2000);
    } else scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Yeni mesaj gelince alttaysak aşağı kaydır
  useEffect(() => {
    if (stickBottom.current) scrollToBottom(true);
  }, [messages.length]);

  // Gerçek zamanlı akış (SSE): tarayıcı kopan bağlantıyı son olaydan otomatik sürdürür
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 200);
    };
    const es = new EventSource(`/api/m/groups/${groupId}/events?after=${cursor.current}`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (e) => {
      setLive(true);
      cursor.current = Number(e.lastEventId) || cursor.current;
      const ev = JSON.parse(e.data);
      if (ev.type === "message") {
        setMessages((prev) => {
          if (prev.some((m) => m.id === ev.message.id)) return prev;
          const tmp = prev.find((m) => m.pending && m.text === ev.message.text && m.user?.id === ev.message.user.id);
          return tmp ? prev.map((m) => (m === tmp ? ev.message : m)) : [...prev, ev.message];
        });
      } else scheduleRefresh();
    };
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      es.close();
      clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [groupId, refresh]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    stickBottom.current = true;
    const tmp: UiMessage = {
      id: `tmp-${Date.now()}`,
      kind: "TEXT",
      text: body,
      createdAt: new Date().toISOString(),
      user: { id: me.userId, name: "", imageUrl: null },
      mine: true,
      day: null,
      poll: null,
      pending: true,
    };
    setMessages((prev) => [...prev, tmp]);
    const fd = new FormData();
    fd.set("groupId", groupId);
    fd.set("text", body);
    const res = await sendMessage(null, fd);
    setMessages((prev) =>
      prev.map((m) => (m.id === tmp.id ? (res?.ok ? { ...m, id: res.id ?? m.id, pending: false } : { ...m, pending: false, failed: true }) : m)),
    );
  }

  const isAdmin = me.role === "ADMIN";
  let lastDay = "";
  let lastAuthor: string | null = null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="pt-safe border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-2">
          <Link href="/gruplar" className="btn-icon" aria-label="Geri">
            <ArrowLeft />
          </Link>
          <Link href={`/gruplar/${groupId}/bilgi`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 hover:bg-muted/60">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-base font-bold text-primary-foreground">
              {initial.group.name[0]?.toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold leading-tight">{initial.group.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={`size-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                {initial.group.memberCount} üye
              </span>
            </span>
          </Link>
          <button className="btn-icon" onClick={() => setHistoryOpen(true)} aria-label="Okuma geçmişi" title="Okuma geçmişi">
            <CalendarRange />
          </button>
          <Link href={`/gruplar/${groupId}/bilgi`} className="btn-icon" aria-label="Grup bilgisi">
            <Info />
          </Link>
          {isAdmin && (
            <Link href={`/gruplar/${groupId}/yonetim`} className="btn-icon" aria-label="Yönetim">
              <Settings />
            </Link>
          )}
        </div>
        {dueBanner && (
          <Link href={`/gruplar/${groupId}/bilgi`} className="flex items-center justify-center gap-2 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
            <Receipt className="size-3.5" /> {dueBanner.amount} TL ceza ödemen var · ödeme bilgileri
          </Link>
        )}
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          stickBottom.current = bottom;
          setAtBottom(bottom);
          if (el.scrollTop < 200) loadOlder();
        }}
        className="relative flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px]"
      >
        <div className="mx-auto max-w-3xl px-3 py-4">
          {hasMore ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Eski mesajlar yükleniyor…</p>
          ) : (
            <p className="mx-auto mb-4 w-fit rounded-lg bg-card px-3 py-1.5 text-center text-xs text-muted-foreground shadow-xs">
              Sohbetin başlangıcı
            </p>
          )}
          {messages.map((m) => {
            const day = m.kind === "DAY" ? "" : trDay(m.createdAt);
            const sep = day && day !== lastDay;
            if (day) lastDay = day;
            if (m.kind === "DAY" && m.day) {
              lastAuthor = null;
              lastDay = trDay(m.day.start);
              return (
                <div key={m.id} className="my-5">
                  <DayCardFull card={m.day} groupId={groupId} onReported={refresh} />
                </div>
              );
            }
            const mine = m.user?.id === me.userId;
            const showAuthor = sep || lastAuthor !== m.user?.id;
            lastAuthor = m.user?.id ?? null;
            const canDelete = mine || isAdmin;
            return (
              <div key={m.id}>
                {sep && (
                  <p className="mx-auto my-3 w-fit rounded-lg bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">{dayLabel(day)}</p>
                )}
                <Bubble m={m} mine={mine} showAuthor={!!showAuthor} canDelete={canDelete} onChanged={refresh}>
                  {m.kind === "POLL" && m.poll ? (
                    <PollBody m={m} mine={mine} onChanged={refresh} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.text}</p>
                  )}
                </Bubble>
              </div>
            );
          })}
        </div>
      </div>

      {!atBottom && (
        <button onClick={() => scrollToBottom(true)} className="btn-icon absolute bottom-24 right-4 z-10 border border-border bg-card shadow-md" aria-label="En alta in">
          <ArrowDown />
        </button>
      )}

      <footer className="pb-safe border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-2 py-2">
          {me.canPost ? (
            <form
              className="flex items-end gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <button type="button" className="btn-icon shrink-0" onClick={() => setPollOpen(true)} aria-label="Anket oluştur">
                <BarChart3 />
              </button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Mesaj yaz"
                className="input max-h-32 min-h-10 flex-1 resize-none rounded-2xl py-2.5 [field-sizing:content]"
              />
              <button type="submit" disabled={!text.trim()} className="btn-primary size-10 shrink-0 rounded-full p-0" aria-label="Gönder">
                <SendHorizontal />
              </button>
            </form>
          ) : (
            <p className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Lock className="size-4" /> Bu grupta yalnızca yöneticiler mesaj gönderebilir
            </p>
          )}
        </div>
      </footer>

      {pollOpen && <PollDialog groupId={groupId} onClose={() => setPollOpen(false)} onCreated={refresh} />}
      {historyOpen && <GroupHistory groupId={groupId} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
