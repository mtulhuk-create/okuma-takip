// Uygulamada okunabilecek eserler: gruplara yalnızca bu listeden eser eklenebilir.
export const DEFAULT_BOOK = "Risale-i Nur Külliyatı";

export const BOOK_CATALOG: { group: string; books: string[] }[] = [
  { group: "Külliyat", books: [DEFAULT_BOOK] },
  { group: "Kur'an", books: ["Kuran-ı Kerim"] },
  {
    group: "Risale-i Nur",
    books: [
      "Sözler",
      "Mektubat",
      "Lem'alar",
      "Şualar",
      "Tarihçe-i Hayat",
      "Barla Lâhikası",
      "Kastamonu Lâhikası",
      "Emirdağ Lâhikası",
      "Mesnevî-i Nuriye",
      "İşârâtü'l-İ'caz",
      "Asa-yı Musa",
      "Sikke-i Tasdik-i Gaybî",
      "Muhakemat",
      "İman ve Küfür Muvazeneleri",
    ],
  },
  {
    group: "Dualar ve virdler",
    books: [
      "Cevşen-i Kebîr",
      "Evrâd-ı Kudsiye",
      "Delâilü'n-Nûr",
      "Sekîne Duası",
      "Celcelûtiye Kasidesi",
      "Hulâsatü'l-Hulâsa",
      "Tahmîdiye",
      "Münâcât-ı Üveys el-Karanî",
      "Münâcâtü'l-Kur'ân",
      "İsm-i Âzam Duası",
      "Duâ-yı Tercümân-ı İsm-i Âzam",
    ],
  },
];

export const ALL_BOOKS = BOOK_CATALOG.flatMap((g) => g.books);
export const isCatalogBook = (t: string) => ALL_BOOKS.includes(t.trim());
