// Sistem avatarındaki harfler (sunucu ve tarayıcı ortak)
/**
 * Sistem avatarındaki harfler (2 harf): iki ve daha fazla kelimede ilk ve son kelimenin baş harfi
 * (Ahmet Said Mutlu → AM), tek kelimede ilk iki harf (Ahmet → AH).
 */
export function initialsOf(text: string) {
  const words = text.trim().split(/\s+/).map((w) => w.replace(/[^\p{L}\d]/gu, "")).filter(Boolean);
  if (!words.length) return "?";
  const pick = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2);
  return pick.toLocaleUpperCase("tr-TR");
}
