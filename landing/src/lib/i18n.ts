import { mapStrings, stripMarkers, toCyrillic } from "./transliterate";

/** Uzbek only. Latin is the default; Cyrillic is generated from it. */
export type Script = "latn" | "cyrl";
export const DEFAULT_SCRIPT: Script = "latn";

// Single source of truth: all copy is written once, in Uzbek Latin with ʻ (U+02BB) and ʼ (U+02BC).
// **word** stays untouched in Cyrillic (brands, domains); {name} is a placeholder.
// Every claim here must match docs/PRD.md. Numbers that admins can change come from /api/v1/config.
const latn = {
  meta: {
    skip: "Asosiy qismga oʻtish",
  },
  nav: {
    how: "Qanday ishlaydi",
    auctions: "Auksionlar",
    pricing: "Narx",
    faq: "Savollar",
    contact: "Aloqa",
    openSite: "Saytga kirish",
    switchTo: "Кириллча",
    switchLabel: "Kirill yozuviga oʻtish",
  },
  hero: {
    eyebrow: "Chorva mollari auksioni",
    title: "Chorvangizni auksionda soting",
    subtitle:
      "Siz narx va vaqtni belgilaysiz, xaridorlar taklif beradi, oʻzingizga maʼqul taklifni esa oʻzingiz tanlaysiz. Hammasi telefoningizda, bozorga bormasdan.",
    primary: "Auksionlarni koʻrish",
    secondary: "Chorva sotish",
    factCommission: "{rate} komissiya, faqat mol sotilganda",
    factCommissionNoRate: "Komissiya faqat mol sotilganda olinadi",
    factBuyer: "Xaridor uchun bepul",
    factContacts: "Telefon raqamlar faqat bitimdan keyin ochiladi",
    photoAlt: "Yaylovdagi qoʻylar",
    photoAlt2: "Fermadagi sigirlar",
    photoAlt3: "Buqa",
  },
  auctions: {
    title: "Hozir ochiq auksionlar",
    subtitle: "Bu roʻyxat saytdagi haqiqiy auksionlardan olinadi.",
    live: "Jonli",
    scheduled: "Tez orada",
    askingPrice: "Sotuvchi narxi",
    topBid: "Eng yuqori taklif",
    noBids: "Hali taklif yoʻq",
    endsAt: "Tugaydi: {time}",
    startsAt: "Boshlanadi: {time}",
    bidders: "{count} ta xaridor",
    weight: "{kg} kg",
    weightApprox: "~{kg} kg",
    noPhoto: "Rasm yoʻq",
    video: "Video",
    viewAll: "Barcha auksionlar",
    empty: "Hozir ochiq auksion yoʻq. Chorvangizni birinchi boʻlib auksionga qoʻying.",
    emptyCta: "Auksion ochish",
    error: "Auksionlarni hozir yuklab boʻlmadi. Ularni saytda koʻrishingiz mumkin.",
    errorCta: "Saytni ochish",
  },
  problem: {
    title: "Bugun chorva qanday sotiladi?",
    items: [
      {
        title: "Narx bitta xaridor bilan kelishiladi",
        text: "Mol bozorida narxni oldingizda turgan odam bilan kelishasiz. Boshqa xaridor qancha bergan boʻlardi, buni bilmaysiz.",
      },
      {
        title: "Vaqt va yoʻl xarajati",
        text: "Molni bozorga olib borish, kun boʻyi turish, sotilmasa qaytarib olib kelish kerak.",
      },
      {
        title: "Onlayn eʼlonlarga ishonch past",
        text: "Guruhlardagi rasm eski yoki boshqa moldan boʻlishi mumkin. Sotuvchini tekshirishning imkoni yoʻq.",
      },
    ],
  },
  how: {
    title: "Qanday ishlaydi",
    sellerTab: "Sotuvchiga",
    buyerTab: "Xaridorga",
    seller: [
      {
        title: "Telegram orqali kiring",
        text: "Telefon raqamingizni kiriting va **Telegram** botda tasdiqlang. Parol kerak emas.",
      },
      {
        title: "Molni suratga oling",
        text: "Ilova ichidagi kamera bilan kamida 4 ta rasm va 1 ta video oling. Galereyadan yuklab boʻlmaydi, shuning uchun suratlar haqiqiy boʻladi.",
      },
      {
        title: "Narx va vaqtni belgilang",
        text: "Soʻraladigan narxni, boshlanish vaqtini va davomiylikni tanlang: {min}dan {max}gacha.",
        plain: "Soʻraladigan narxni, boshlanish vaqtini va auksion davomiyligini tanlang.",
      },
      {
        title: "Xaridorni tanlang",
        text: "Auksion tugagach, 48 soat ichida istalgan taklifni qabul qilasiz. Shundan keyin ikki tomonga bir-birining telefoni ochiladi.",
      },
    ],
    buyer: [
      {
        title: "Auksionni toping",
        text: "Hudud, hayvon turi, zot va narx boʻyicha qidiring yoki yaqin atrofdagi auksionlarni koʻring.",
      },
      {
        title: "Taklif bering",
        text: "Taklif sotuvchi narxidan past boʻlishi mumkin, lekin uning {minPct} foizidan kam boʻlmaydi. Ismingiz boshqalarga koʻrinmaydi: siz “Xaridor #N” boʻlasiz.",
        plain: "Taklif sotuvchi narxidan past ham boʻlishi mumkin. Ismingiz boshqalarga koʻrinmaydi: siz “Xaridor #N” boʻlasiz.",
      },
      {
        title: "Oʻrningizni kuzating",
        text: "Har bir xaridorda bitta faol taklif boʻladi va uni yangilash mumkin. Taklifingiz nechanchi oʻrinda ekanini koʻrib turasiz.",
      },
      {
        title: "Sotuvchi bilan bogʻlaning",
        text: "Sotuvchi taklifingizni qabul qilsa, uning ismi va telefoni sizga ochiladi. Molni koʻrib, savdoni yakunlaysiz.",
      },
    ],
    cta: "Hoziroq boshlash",
  },
  trust: {
    title: "Xavfsizlik va ishonch",
    items: [
      {
        title: "Faqat jonli suratlar",
        text: "Rasm va video faqat ilova kamerasi bilan olinadi. Boshqa joydan olingan surat bilan eʼlon berib boʻlmaydi.",
      },
      {
        title: "Har bir eʼlon tekshiriladi",
        text: "Tavsifda telefon raqami, havola yoki haqorat yoʻqligi avtomatik tekshiriladi. Shubhali eʼlonni moderator koʻrib chiqadi.",
      },
      {
        title: "Raqamingiz himoyalangan",
        text: "Ism va telefon faqat bitim tuzilgandan keyin ochiladi. Auksion davomida raqamingiz hech kimga koʻrinmaydi.",
      },
      {
        title: "Reyting",
        text: "Bitimdan keyin tomonlar bir-birini 1–5 ball bilan baholaydi. Profilda oʻrtacha baho va bitimlar soni koʻrinadi.",
      },
      {
        title: "Shikoyat va moderatsiya",
        text: "Shubhali auksion yoki foydalanuvchi ustidan shikoyat qilish mumkin. Moderator auksionni ham, foydalanuvchini ham bloklay oladi.",
      },
      {
        title: "Bitim boʻlmasa, komissiya qaytadi",
        text: "Bitimdan keyin 7 kun ichida “Bitim boʻlmadi” arizasini bering. Ariza asosli boʻlsa, komissiya balansingizga qaytariladi.",
      },
    ],
  },
  pricing: {
    title: "Narx",
    subtitle: "Roʻyxatdan oʻtish, eʼlon joylash va taklif berish bepul.",
    sellerTitle: "Sotuvchi",
    sellerValueNoRate: "Faqat sotilganda",
    sellerDesc: "qabul qilingan taklif summasidan, faqat mol sotilganda",
    sellerPoints: [
      "Eʼlon qilishda narxning shu ulushi balansingizda band qilinadi",
      "Bitim boʻlmasa yoki auksion bekor qilinsa, band qilingan summa toʻliq qaytadi",
      "Yangi akkauntga komissiya uchun bonus beriladi",
      "Har bir bitimdan keyin komissiyaning bir qismi bonus hamyonga qaytadi",
      "Balans **Click** orqali toʻldiriladi",
    ],
    example: "Misol: mol {price}ga sotilsa, komissiya {fee} boʻladi.",
    exampleCashback: "Misol: mol {price}ga sotilsa, komissiya {fee}, bonus hamyonga {cashback} qaytadi.",
    buyerTitle: "Xaridor",
    buyerValue: "Bepul",
    buyerDesc: "xaridor platformaga hech narsa toʻlamaydi",
    buyerPoints: [
      "Taklif berish bepul",
      "Balansni toʻldirish shart emas",
      "Mol puli sotuvchi bilan bevosita kelishiladi",
    ],
  },
  faq: {
    title: "Koʻp beriladigan savollar",
    items: [
      {
        q: "**Zotdor.uz** nima?",
        a: "Chorva mollarini auksion orqali sotish va sotib olish platformasi. Har bir auksionda bitta hayvon sotiladi. Sayt **web.zotdor.uz** manzilida ishlaydi.",
      },
      {
        q: "Qanday roʻyxatdan oʻtaman?",
        a: "**web.zotdor.uz** saytida telefon raqamingizni kiriting va **Telegram** botda kontaktingizni ulashing. Faqat +998 raqamlar qabul qilinadi.",
      },
      {
        q: "Auksion qancha davom etadi?",
        a: "Sotuvchi {min}dan {max}gacha boʻlgan muddatni tanlaydi. Auksion darhol yoki {days} kun ichidagi istalgan vaqtda boshlanishi mumkin.",
      },
      {
        q: "Eng yuqori taklif avtomatik yutadimi?",
        a: "Yoʻq. Sotuvchi istalgan faol taklifni tanlay oladi: narxiga, masofaga va xaridorning reytingiga qarab. Tanlash uchun auksion tugagach 48 soat beriladi.",
      },
      {
        q: "Sotuvchining telefonini qachon koʻraman?",
        a: "Sotuvchi taklifingizni qabul qilgandan keyin. Shu paytgacha ikki tomonning ismi va telefoni yashirin turadi.",
      },
      {
        q: "Komissiya qancha va uni kim toʻlaydi?",
        a: "Komissiyani faqat sotuvchi toʻlaydi: qabul qilingan taklif summasining {rate}. Xaridor uchun platforma bepul.",
      },
      {
        q: "Nega rasmni galereyadan yuklab boʻlmaydi?",
        a: "Rasm va video faqat ilova ichidagi kamera bilan olinadi. Shunday qilib eski yoki boshqa joydan olingan suratlar eʼlonga tushmaydi.",
      },
      {
        q: "Bitim amalga oshmasa nima boʻladi?",
        a: "Sotuvchi bitimdan keyin 7 kun ichida “Bitim boʻlmadi” arizasini beradi. Moderator arizani asosli deb topsa, komissiya balansga qaytariladi.",
      },
      {
        q: "Qaysi hayvonlarni sotish mumkin?",
        a: "Qoramol, qoʻy, echki, ot va boshqa chorva mollari. Toʻliq roʻyxatni saytdagi qidiruvda koʻrasiz.",
      },
    ],
  },
  contact: {
    title: "Ariza qoldiring",
    subtitle:
      "Savolingiz bormi yoki chorvangizni auksionga qoʻyishda yordam kerakmi? Raqamingizni qoldiring, siz bilan oʻzimiz bogʻlanamiz.",
    name: "Ismingiz",
    namePlaceholder: "Masalan: Anvar",
    phone: "Telefon raqamingiz",
    region: "Hudud",
    regionPlaceholder: "Hududni tanlang (ixtiyoriy)",
    regionsError: "Hududlar roʻyxatini yuklab boʻlmadi. Bu maydonni oʻtkazib yuborishingiz mumkin.",
    role: "Siz kimsiz?",
    roles: { seller: "Sotuvchiman", buyer: "Xaridorman", both: "Ikkalasi ham" },
    message: "Xabar (ixtiyoriy)",
    messagePlaceholder: "Masalan: 3 ta buqam bor, auksionni qanday ochaman?",
    submit: "Arizani yuborish",
    submitting: "Yuborilmoqda…",
    nameError: "Ismingizni kiriting (kamida 2 ta harf).",
    phoneError: "Telefon raqamini +998 XX XXX XX XX koʻrinishida kiriting.",
    roleError: "Kim ekaningizni tanlang.",
    networkError: "Arizani yuborib boʻlmadi. Internetni tekshirib, qayta urinib koʻring.",
    privacy: "Raqamingiz faqat siz bilan bogʻlanish uchun ishlatiladi va uchinchi shaxslarga berilmaydi.",
    privacyLink: "Maxfiylik siyosati",
    successTitle: "Rahmat, {name}!",
    successText:
      "Arizangiz qabul qilindi, tez orada siz bilan bogʻlanamiz. Hozirning oʻzida saytga kirib, auksionlarni koʻrishingiz mumkin.",
    again: "Yana ariza qoldirish",
  },
  finalCta: {
    title: "Birinchi auksioningizni bugun oching",
    text: "Roʻyxatdan oʻtish uchun telefon raqami va **Telegram** kifoya.",
  },
  footer: {
    tagline: "Chorva mollari auksioni",
    site: "Sayt",
    channel: "**Telegram** kanal",
    bot: "**Telegram** bot",
    phone: "Telefon",
    rights: "© {year} **Zotdor.uz**",
    legal: "Huquqiy hujjatlar",
    terms: "Foydalanish shartlari",
    privacy: "Maxfiylik siyosati",
    offer: "Ommaviy oferta",
  },
  units: {
    minutes: "{n} daqiqa",
    hours: "{n} soat",
    som: "soʻm",
    months: [
      "yanvar",
      "fevral",
      "mart",
      "aprel",
      "may",
      "iyun",
      "iyul",
      "avgust",
      "sentabr",
      "oktabr",
      "noyabr",
      "dekabr",
    ],
  },
};

export type Dict = typeof latn;

const cyrl = mapStrings(latn, toCyrillic);

export const dictionaries: Record<Script, Dict> = {
  latn: mapStrings(latn, stripMarkers),
  cyrl: { ...cyrl, nav: { ...cyrl.nav, switchTo: "Lotincha", switchLabel: "Lotin yozuviga oʻtish" } },
};

/** "Rahmat, {name}!" + {name: "Anvar"} → "Rahmat, Anvar!" */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
