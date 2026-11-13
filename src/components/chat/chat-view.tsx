"use client";

import { ArrowDown, ArrowLeft, BarChart3, CalendarRange, ChevronDown, ImagePlus, Info, Landmark, Lock, SendHorizontal, Settings, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { mediaTicket, sendImage, sendMessage } from "@/app/actions";
import { compressImage, uploadImage } from "@/lib/image-upload";
import type { ChatPage } from "@/lib/chat";
import { formatDayLong } from "@/lib/schedule";
import { DayCardFull, DayShortcut } from "../day-card";
import { Countdown } from "../countdown";
import { DueBadge } from "../due-badge";
import { PaySheet } from "../pay-sheet";
import { BadgeCard } from "./badge-card";
import { Bubble, ChatImage, PollBody, replySnippet, type UiMessage } from "./message-items";
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

export function ChatView({ initial }: { initial: Page }) {
  const groupId = initial.group.id;
  const [group, setGroup] = useState(initial.group);
  const [kasa, setKasa] = useState(initial.kasa);
  const [todayCard, setTodayCard] = useState(initial.todayCard);
  const [payOpen, setPayOpen] = useState(false);
  const [kasaOpen, setKasaOpen] = useState(false);
  const [cardVisible, setCardVisible] = useState(true);
  const [messages, setMessages] = useState<UiMessage[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [me, setMe] = useState(initial.me!);
  // Okundu bilgisi (tikler için): her üyenin sohbeti en son okuduğu an
  const [reads, setReads] = useState(initial.reads);
  const [text, setText] = useState("");
  const [pollOpen, setPollOpen] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [caption, setCaption] = useState("");
  // Yanıtlanan mesaj (yazma alanının üstünde gösterilir)
  const [replyTo, setReplyTo] = useState<UiMessage | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const replyOf = (m: UiMessage | null) => (m ? { id: m.id, userId: m.user?.id ?? null, name: m.mine ? "Sen" : (m.user?.name ?? ""), text: replySnippet(m).slice(0, 140) } : null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [live, setLive] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const meId = useRef(initial.me!.userId);
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
    if (page.reads) setReads(page.reads);
    // Ayarlar (ad, kurallar, eserler), kasa ve bugünün kartı da güncellenir
    setGroup(page.group);
    setKasa(page.kasa);
    setTodayCard(page.todayCard);
    setMessages((prev) => {
      const first = page.messages[0]?.createdAt;
      const ids = new Set(page.messages.map((m) => m.id));
      // Sunucu sayfasında olanlar (ör. en alta taşınan gün kartı) eski mesajlardan düşer
      const older = first ? prev.filter((m) => !m.pending && m.createdAt < first && !ids.has(m.id)) : [];
      const pending = prev.filter((m) => m.pending || m.failed);
      // Cihaz saati sunucudan farklı olabilir: içerik eşleşmesinde 2 dk pay (geçici balon asılı kalmasın)
      const claimed = new Set<string>();
      const still = pending.filter((p) => {
        const since = new Date(Date.parse(p.createdAt) - 120_000).toISOString();
        const hit = page.messages.find((m) => !claimed.has(m.id) && m.kind === p.kind && m.text === p.text && m.user?.id === p.user?.id && m.createdAt >= since);
        if (hit) claimed.add(hit.id);
        return !hit;
      });
      return [...older, ...page.messages, ...still];
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

  // Bugünün gün kartı ekranda mı? Değilse başlığın altında kısayol gösterilir
  const todayKey = group.today;
  useEffect(() => {
    const root = scroller.current;
    const el = root?.querySelector(`#gun-${todayKey}`);
    if (!root || !el) {
      setCardVisible(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setCardVisible(e.isIntersecting), { root, threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [todayKey, messages]);

  /** Kısayola basınca sohbetteki gün kartına git (gerekirse eski mesajları yükle) */
  async function jumpToToday() {
    for (let i = 0; i < 6; i++) {
      const el = document.getElementById(`gun-${todayKey}`);
      if (el) {
        stickBottom.current = false;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.add("ring-2", "ring-primary");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1600);
        return;
      }
      if (!(await loadOlder())) return;
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  // Sohbet durulunca açık günün kartı en alta taşınır (sunucu yapar): sessizlik süresi dolunca sayfa yenilenir
  const lastChatAt = [...messages].reverse().find((m) => m.kind !== "DAY" && !m.pending && !m.failed)?.createdAt;
  const cardAtBottom = messages[messages.length - 1]?.kind === "DAY";
  const cardOpen = !!todayCard?.open;
  const sinkMs = initial.cardSinkMs ?? 180_000;
  useEffect(() => {
    if (!lastChatAt || cardAtBottom || !cardOpen) return;
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    // Cihaz saati sunucudan farklıysa ilk denemede taşınmayabilir: birkaç kez yeniden denenir
    const tick = () => {
      refresh();
      if (++n < 4) t = setTimeout(tick, 30_000);
    };
    t = setTimeout(tick, Math.max(5000, Date.parse(lastChatAt) + sinkMs + 2000 - Date.now()));
    return () => clearTimeout(t);
  }, [lastChatAt, cardAtBottom, cardOpen, sinkMs, refresh]);

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
          const tmp = prev.find((m) => m.pending && m.kind === ev.message.kind && m.text === ev.message.text && m.user?.id === ev.message.user.id);
          return tmp ? prev.map((m) => (m === tmp ? ev.message : m)) : [...prev, ev.message];
        });
        // Başkasının mesajı ekrandayken geldi: okundu sayılması için sayfa tazelenir
        if (ev.message.user?.id !== meId.current && document.visibilityState === "visible") scheduleRefresh();
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
    const answering = replyTo;
    setReplyTo(null);
    stickBottom.current = true;
    const tmp: UiMessage = {
      id: `tmp-${Date.now()}`,
      kind: "TEXT",
      text: body,
      createdAt: new Date().toISOString(),
      user: { id: me.userId, name: "", imageUrl: null, initial: "", badge: null, streak: null, tier: null },
      mine: true,
      day: null,
      poll: null,
      badge: null,
      image: null,
      reply: replyOf(answering),
      reactions: [],
      pending: true,
    };
    setMessages((prev) => [...prev, tmp]);
    const fd = new FormData();
    fd.set("groupId", groupId);
    fd.set("text", body);
    if (answering) fd.set("replyTo", answering.id);
    const res = await sendMessage(null, fd);
    setMessages((prev) =>
      prev.map((m) => (m.id === tmp.id ? (res?.ok ? { ...m, id: res.id ?? m.id, pending: false } : { ...m, pending: false, failed: true }) : m)),
    );
  }

  /** Fotoğraf: tarayıcıda küçültülür, doğrudan Cloudinary'ye yüklenir; sunucuya yalnızca adresi gider */
  async function sendPhoto() {
    if (!photo) return;
    const { file, preview } = photo;
    const note = caption.trim() || null;
    setPhoto(null);
    setCaption("");
    const answering = replyTo;
    setReplyTo(null);
    stickBottom.current = true;
    const id = `tmp-${Date.now()}`;
    const patch = (p: Partial<UiMessage>) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)));
    setMessages((prev) => [
      ...prev,
      {
        id,
        kind: "IMAGE",
        text: note,
        createdAt: new Date().toISOString(),
        user: { id: me.userId, name: "", imageUrl: null, initial: "", badge: null, streak: null, tier: null },
        mine: true,
        day: null,
        poll: null,
        badge: null,
        image: { thumb: preview, full: preview, w: 4, h: 3 },
        reply: replyOf(answering),
        reactions: [],
        pending: true,
        progress: 0,
      },
    ]);
    try {
      const { blob, w, h } = await compressImage(file);
      patch({ image: { thumb: preview, full: preview, w, h } });
      const ticket = await mediaTicket(groupId);
      const url = await uploadImage(ticket, blob, (progress) => patch({ progress }));
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("url", url);
      fd.set("w", String(w));
      fd.set("h", String(h));
      if (note) fd.set("text", note);
      if (answering) fd.set("replyTo", answering.id);
      const res = await sendImage(null, fd);
      if (!res?.ok) throw new Error(res?.error ?? "Fotoğraf gönderilemedi");
      patch({ id: res.id ?? id, pending: false });
    } catch (e) {
      patch({ pending: false, failed: true });
      alert(e instanceof Error ? e.message : "Fotoğraf gönderilemedi");
    }
  }

  const isAdmin = me.role === "ADMIN";
  let lastDay = "";
  let lastAuthor: string | null = null;

  const payItems = kasa
    ? [{ group: { id: groupId, name: group.name, iban: kasa.iban, ibanName: kasa.ibanName }, amount: kasa.myDebt, due: kasa.myDue }].filter((d) => d.amount > 0)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="pt-safe z-20 bg-card shadow-sm">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-1 px-1.5">
          <Link href="/gruplar" className="btn-icon" aria-label="Geri">
            <ArrowLeft />
          </Link>
          <Link href={`/gruplar/${groupId}/bilgi`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-muted/60">
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-sm font-bold text-primary-foreground">
              {group.name[0]?.toUpperCase()}
              <span className={`absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-card ${live ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight">{group.name}</span>
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {group.memberCount} üye{live ? " · çevrimiçi" : ""}
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
        {kasa && (
          <div className="mx-auto flex max-w-3xl items-center gap-2 border-t border-border px-3 py-1">
            <button onClick={() => setKasaOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={kasaOpen} title="Grup kasası">
              <Landmark className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                Kasa <b className="text-foreground">{kasa.paidTotal ?? 0} TL</b> toplandı · <b className="text-foreground">{kasa.expected} TL</b> bekleniyor
              </span>
              <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${kasaOpen ? "rotate-180" : ""}`} />
            </button>
            {kasa.myDebt > 0 ? (
              <>
                {kasa.myDue && (
                  <span className="hidden shrink-0 min-[420px]:inline-flex">
                    <DueBadge due={kasa.myDue} compact />
                  </span>
                )}
                <button onClick={() => setPayOpen(true)} className="btn-danger btn-sm h-6 shrink-0 rounded-full px-2.5 text-[11px]">
                  Borcunu öde · {kasa.myDebt} TL
                </button>
              </>
            ) : (
              <span className="shrink-0 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Borcun yok</span>
            )}
          </div>
        )}
        {kasa && kasaOpen && (
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-1.5 border-t border-border px-3 py-2 text-center">
            <div className="rounded-lg bg-emerald-500/10 px-1 py-1.5">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{kasa.paidTotal ?? 0} TL</p>
              <p className="text-[10px] leading-tight text-muted-foreground">Grup kurulduğundan beri kasaya giren</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 px-1 py-1.5">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{kasa.inDue ?? 0} TL</p>
              <p className="text-[10px] leading-tight text-muted-foreground">
                Vade süresince girmesi gereken{kasa.inDueCount ? ` (${kasa.inDueCount} kişi)` : ""}
              </p>
              {kasa.nextDueAt && (
                <p className="mt-0.5 text-[10px] font-semibold">
                  <Countdown to={kasa.nextDueAt} />
                </p>
              )}
            </div>
            <div className="rounded-lg bg-rose-500/10 px-1 py-1.5">
              <p className="text-sm font-bold text-rose-700 dark:text-rose-400">{kasa.expected} TL</p>
              <p className="text-[10px] leading-tight text-muted-foreground">Ödenmemiş toplam ceza (vadeli + vadesiz)</p>
            </div>
          </div>
        )}
        {todayCard && !cardVisible && <DayShortcut card={todayCard} groupId={groupId} onJump={jumpToToday} onReported={refresh} />}
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
        className="chat-wallpaper relative flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto max-w-3xl px-3 py-4">
          {hasMore ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Eski mesajlar yükleniyor…</p>
          ) : (
            <p className="mx-auto mb-4 w-fit max-w-xs rounded-lg bg-amber-100/90 px-3 py-1.5 text-center text-[11px] text-amber-900 shadow-xs dark:bg-amber-500/15 dark:text-amber-200">
              🔒 Sohbetin başlangıcı. Her okuma günü burada bir gün kartıyla başlar.
            </p>
          )}
          {messages.map((m) => {
            const day = m.kind === "DAY" ? "" : trDay(m.createdAt);
            const sep = day && day !== lastDay;
            if (day) lastDay = day;
            if (m.kind === "DAY" && m.day) {
              // Kart sohbetin ortasına/altına taşınabildiği için tarih ayracını sıfırlamaz
              lastAuthor = null;
              return (
                <div key={m.id} className="my-5">
                  <DayCardFull card={m.day} groupId={groupId} onReported={refresh} />
                </div>
              );
            }
            if (m.kind === "BADGE" && !m.badge) return null;
            if (m.kind === "BADGE" && m.badge) {
              lastAuthor = null;
              return (
                <div key={m.id}>
                  {sep && (
                    <p className="sticky top-2 z-10 mx-auto my-3 w-fit rounded-lg bg-card/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-xs backdrop-blur">
                      {dayLabel(day)}
                    </p>
                  )}
                  <BadgeCard b={m.badge} onChanged={refresh} />
                </div>
              );
            }
            const mine = m.user?.id === me.userId;
            const showAuthor = sep || lastAuthor !== m.user?.id;
            lastAuthor = m.user?.id ?? null;
            const canDelete = mine || isAdmin;
            return (
              <div key={m.id} id={`msg-${m.id}`} className="rounded-lg transition-colors duration-500">
                {sep && (
                  <p className="sticky top-2 z-10 mx-auto my-3 w-fit rounded-lg bg-card/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-xs backdrop-blur">
                    {dayLabel(day)}
                  </p>
                )}
                <Bubble
                  m={m}
                  mine={mine}
                  showAuthor={!!showAuthor}
                  canDelete={canDelete}
                  onChanged={refresh}
                  reads={mine ? reads : null}
                  onReply={
                    me.canPost
                      ? () => {
                          setReplyTo(m);
                          input.current?.focus();
                        }
                      : undefined
                  }
                >
                  {m.kind === "POLL" && m.poll ? (
                    <PollBody m={m} mine={mine} onChanged={refresh} />
                  ) : m.kind === "IMAGE" ? (
                    <ChatImage m={m} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                      {m.text}
                      {/* saat için yer aç */}
                      <span className="inline-block w-12" />
                    </p>
                  )}
                </Bubble>
              </div>
            );
          })}
        </div>
      </div>

      {!atBottom && (
        <button onClick={() => scrollToBottom(true)} className="btn-icon fixed bottom-24 right-4 z-10 rounded-full bg-card shadow-md" aria-label="En alta in">
          <ArrowDown />
        </button>
      )}

      <footer className="pb-safe bg-[var(--chat-bg)]">
        <div className="mx-auto max-w-3xl px-2 py-1.5">
          {me.canPost && replyTo && (
            // Yanıtlanan mesajın önizlemesi
            <div className="mb-1 flex items-center gap-2 rounded-2xl bg-card px-3 py-1.5 shadow-xs">
              <div className="min-w-0 flex-1 border-l-[3px] border-primary pl-2">
                <p className="truncate text-[11px] font-bold leading-tight text-primary">{replyOf(replyTo)!.name || "Mesaj"}</p>
                <p className="truncate text-xs text-muted-foreground">{replyOf(replyTo)!.text}</p>
              </div>
              <button type="button" className="btn-icon size-7 shrink-0 [&_svg]:size-4" aria-label="Yanıtı iptal et" onClick={() => setReplyTo(null)}>
                <X />
              </button>
            </div>
          )}
          {me.canPost ? (
            <form
              className="flex items-end gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <div className="flex min-h-11 flex-1 items-end rounded-3xl bg-card pl-4 pr-1 shadow-xs">
                <textarea
                  ref={input}
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
                  placeholder="Mesaj"
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-3 pr-1 text-[15px] outline-none placeholder:text-muted-foreground [field-sizing:content]"
                />
                {/* Yazının sağında: anket ve fotoğraf */}
                <button type="button" className="btn-icon size-10 shrink-0 rounded-full" onClick={() => setPollOpen(true)} aria-label="Anket oluştur" title="Anket">
                  <BarChart3 />
                </button>
                <button
                  type="button"
                  className="btn-icon -ml-1.5 size-10 shrink-0 rounded-full"
                  onClick={() => (me.canPhoto ? fileInput.current?.click() : alert("Fotoğraf paylaşımı henüz açılmadı. Fotoğrafların saklanacağı depolama hesabı bağlanınca kullanılabilecek."))}
                  aria-label="Fotoğraf gönder"
                  title="Fotoğraf"
                >
                  <ImagePlus />
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (!file.type.startsWith("image/")) return alert("Yalnızca fotoğraf gönderilebilir");
                    if (file.size > 25 * 1024 * 1024) return alert("Fotoğraf çok büyük (en fazla 25 MB)");
                    setCaption(text.trim());
                    setPhoto({ file, preview: URL.createObjectURL(file) });
                  }}
                />
              </div>
              <button type="submit" disabled={!text.trim()} className="btn-primary size-11 shrink-0 rounded-full p-0 shadow-md [&_svg]:size-5" aria-label="Gönder">
                <SendHorizontal />
              </button>
            </form>
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-full bg-card py-2.5 text-sm text-muted-foreground shadow-xs">
              <Lock className="size-4" /> {me.observer ? "Bu grubu gözlemci olarak görüntülüyorsun" : "Bu grupta yalnızca yöneticiler mesaj gönderebilir"}
            </p>
          )}
        </div>
      </footer>

      {photo && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" role="dialog" aria-label="Fotoğraf gönder">
          <div className="flex items-center justify-end p-2">
            <button
              className="btn-icon text-white hover:bg-white/10"
              aria-label="Vazgeç"
              onClick={() => {
                URL.revokeObjectURL(photo.preview);
                setPhoto(null);
              }}
            >
              <X />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="" className="max-h-full max-w-full rounded object-contain" />
          </div>
          <form
            className="pb-safe mx-auto flex w-full max-w-3xl items-end gap-1.5 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (caption.trim() === text.trim()) setText("");
              sendPhoto();
            }}
          >
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={1000}
              placeholder="Açıklama ekle (isteğe bağlı)"
              className="h-11 min-w-0 flex-1 rounded-full bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <button type="submit" className="btn-primary size-11 shrink-0 rounded-full p-0 shadow-md [&_svg]:size-5" aria-label="Gönder">
              <SendHorizontal />
            </button>
          </form>
        </div>
      )}
      {pollOpen && <PollDialog groupId={groupId} onClose={() => setPollOpen(false)} onCreated={refresh} />}
      {historyOpen && <GroupHistory groupId={groupId} onClose={() => setHistoryOpen(false)} />}
      {payOpen && <PaySheet title="Borcunu öde" items={payItems} onClose={() => setPayOpen(false)} />}
    </div>
  );
}
