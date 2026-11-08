// Grupta okuyucu adlarının görünümü (grup ayarı): girdiği ad soyad, hesap adı ya da ikisinin ilk kelimeleri
export type NameMode = "ENTERED" | "ACCOUNT" | "BOTH";
type U = { name: string; accountName?: string | null };

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
const fold = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (ch) => TR[ch] ?? ch)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");

/** Kelimeler: boşluk, nokta, alt çizgi, rakam vb. ayırıcılarla (e-posta kaynaklı adlar için) */
const words = (s: string) => s.split(/[^\p{L}]+/u).filter(Boolean);

/** İki kelime "aynı" sayılır mı: harfleri aynı, biri diğeriyle başlıyor ya da tek harf farkı */
export function similarWord(a: string, b: string) {
  const x = fold(a);
  const y = fold(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 3 && (x.startsWith(y) || y.startsWith(x))) return true;
  if (Math.abs(x.length - y.length) > 1) return false;
  // tek harf farkı (Levenshtein ≤ 1)
  let i = 0;
  let j = 0;
  let diff = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      i++;
      j++;
      continue;
    }
    if (++diff > 1) return false;
    if (x.length > y.length) i++;
    else if (y.length > x.length) j++;
    else {
      i++;
      j++;
    }
  }
  return diff + (x.length - i) + (y.length - j) <= 1;
}

const cap = (w: string) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1);

export function shownName(u: U, mode: NameMode | null | undefined) {
  const account = u.accountName?.trim() || u.name;
  if (mode === "ACCOUNT") return account;
  if (mode === "BOTH") {
    const entered = words(u.name);
    const acc = words(account);
    const a = entered[0] ?? u.name;
    // Hesap adının ilk kelimesi girilen adla aynıysa tekrar yazma: hesap adının sonraki farklı kelimesi,
    // o da yoksa girilen soyad kullanılır
    const b = acc.find((w) => !similarWord(w, a) && !fold(a).includes(fold(w)));
    const last = entered.length > 1 ? entered[entered.length - 1] : null;
    // Hesap adındaki kelime girilen soyadla aynıysa onun yerine soyadı yaz ("Ahmet yilmaz" → "Ahmet Yılmaz")
    if (b && !(last && similarWord(b, last))) return `${a} ${cap(b)}`;
    return last ? `${a} ${last}` : a;
  }
  return u.name;
}

/** Avatar harfi: hesap (mail) adının baş harfi; yoksa girilen adın */
export function avatarInitial(u: U) {
  const src = (u.accountName?.trim() || u.name).trim();
  return (src.match(/\p{L}|\d/u)?.[0] ?? "?").toLocaleUpperCase("tr-TR");
}

/** Nesnedeki kullanıcının adını grup ayarına göre değiştirir (accountName dışarı verilmez, yalnızca baş harfi) */
export function withShownName<T extends { name: string; accountName?: string | null }>(u: T, mode: NameMode | null | undefined): Omit<T, "accountName"> & { initial: string } {
  const { accountName, ...rest } = u;
  return { ...rest, name: shownName({ name: u.name, accountName }, mode), initial: avatarInitial({ name: u.name, accountName }) };
}

/**
 * Pencerede yazılan ad, hesap adıyla aynı ya da çok benzer ve başka kelime yoksa hesap adı kullanılır
 * ("Sinan" + hesap "sinanaykitt" → "sinanaykitt").
 */
export function chooseName(entered: string, accountName: string | null | undefined) {
  const acc = accountName?.trim();
  if (!acc) return entered;
  const ew = words(entered);
  const aw = words(acc);
  const covered = ew.every((w) => aw.some((a) => similarWord(w, a)));
  return covered ? acc : entered;
}
