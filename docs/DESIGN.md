# Dizayn va kontent qoidalari — Zotdor.uz

Asosiy foydalanuvchi — telefonini ko‘pincha ochiq havoda, quyosh ostida ishlatadigan chorvador. Shundan kelib chiqib: yirik va kontrastli matn, kam bezak, aniq raqamlar, har bir ekranda bitta asosiy amal.

## 1. Tamoyillar

1. **Raqam — qahramon.** Narx, taklif va qolgan vaqt ekrandagi eng ko‘zga tashlanadigan elementlar bo‘ladi.
2. **Har bir element vazifa bajaradi.** Vazifasi bo‘lmagan dekorativ yulduzcha, gradient yoki "pulse" nuqta qo‘shilmaydi.
3. **Bir ekran — bitta asosiy tugma.** To‘q yashil to‘ldirilgan tugma ekranda faqat bitta bo‘ladi.
4. **Holatlarni yashirmaslik.** Har bir ekranda loading, empty, error va success holatlari loyihalanadi.

## 2. Tokenlar

Ranglar mavjud brend palitrasidan olinadi va `tailwind.config.js` da semantik nomlar bilan beriladi. Komponentlarda `[#1e3a0f]` kabi hex qiymatlar **ishlatilmaydi**.

| Token | Qiymat | Ishlatilishi |
|---|---|---|
| `ink` | `#1e3a0f` | asosiy matn, asosiy tugma |
| `ink-muted` | `#4a5e3a` | ikkinchi darajali matn (oq fonda kontrasti ≥ 4.5:1) |
| `brand` | `#3d6b2e` | havolalar, faol holat |
| `brand-soft` | `#dce8c8` | tanlangan chip foni |
| `accent` | `#a8d45e` | faqat to‘q fondagi kichik urg‘ular uchun. Oq fonda matn rangi sifatida ishlatilmaydi |
| `page` | `#eef2dc` | sahifa foni |
| `surface` | `#ffffff` | kartochkalar |
| `line` | `#c5d4a8` | chegaralar |
| `bid-1` | yashil, masalan `#15803d` | 1-o‘rin |
| `bid-2` | sariq yoki to‘q sariq, masalan `#b45309` | 2–3-o‘rin. Oq fonda o‘qilishi uchun to‘q ton tanlanadi |
| `bid-3` | qizil, masalan `#b91c1c` | 4-o‘rin va undan pastlari |
| `danger`, `warning`, `success` | | tizim xabarlari |

Taklif ranglari kontrast tekshiruvidan (WCAG AA) keyin yakunlanadi. Rang hech qachon yagona signal bo‘lmaydi: har bir qatorda o‘rin raqami (`1`, `2`, `3`…) ham turadi.

## 3. Tipografika

- Sarlavhalar: DM Serif Display, faqat sahifa sarlavhasi va narx uchun. Tugma, yorliq va jadvallarda Inter ishlatiladi.
- O‘lchamlar: `13` (eng kichik yorliq), `15` (asosiy matn), `17`, `20`, `24`, `32` (asosiy narx yoki taklif).
- **9–12 px matn ishlatilmaydi.** Demo'dagi `text-[9px]` va `text-[10px]` olib tashlanadi.
- Raqamlarda `tabular-nums` ishlatiladi, sanoq va narx o‘zgarganda matn "sakramasligi" uchun.
- Pul formati: `23 500 000 so‘m`, ajratgich sifatida ingichka bo‘shliq. "UZS" yozilmaydi.
- Vaqt formati: "Bugun 18:30", "Ertaga 09:00", "12-dekabr 14:00". Sanoq: `02:14:05`, oxirgi 10 daqiqada qizil rangda.

## 4. Komponentlar va harakat

- Kartochka: oq fon, `line` rangli chegara, 16 px radius. Soyalar minimal: faqat bosilishi mumkin bo‘lgan kartochkada, hover'da.
- Teginish maydoni ≥ 44×44 px.
- Modal va bottom sheet Escape tugmasi bilan yopiladi, fokusni ichida ushlab turadi va ochgan tugmaga qaytaradi.
- Animatsiya faqat holat o‘zgarishini tushuntirish uchun ishlatiladi:
  - yangi taklif ro‘yxatga yuqoridan qo‘shiladi (150–200 ms);
  - o‘rni o‘zgargan qator joyiga silliq suriladi;
  - foydalanuvchining o‘z taklifi qabul qilinganda qisqa urg‘u beriladi.
- `prefers-reduced-motion` yoqilgan bo‘lsa, animatsiyalar o‘chiriladi.
- Ishlatilmaydi: glassmorphism, `backdrop-blur`, dekorativ gradientlar, aylanuvchi ikonlar, emoji ikon sifatida (kategoriyalarda faqat Lucide ikonlari).

## 5. Matn yozish qoidalari

- Til: o‘zbek tili, lotin yozuvi. Interfeys matnlarida rasmiy belgilar ishlatiladi: **oʻ, gʻ** uchun `ʻ` (U+02BB), tutuq belgisi uchun `ʼ` (U+02BC). Qidiruv `'`, `’`, `ʻ`, `` ` `` belgilarini bir xil deb hisoblaydi.
- Foydalanuvchiga "siz" deb murojaat qilinadi. Gaplar qisqa va to‘g‘ridan-to‘g‘ri bo‘ladi.
- Tugma matni fe'l bilan boshlanadi va natijani aytadi: "Taklif berish", "Xaridorni tanlash", "Balansni to‘ldirish". "Yuborish" yoki "OK" kabi umumiy so‘zlar ishlatilmaydi.
- Xato matni nima bo‘lganini va nima qilish kerakligini aytadi: "Taklif kamida 12 500 000 so‘m bo‘lishi kerak."
- **Taqiqlanadi:**
  - tekshirilmagan da'volar: "Davlat tomonidan sertifikatlangan", "24/7 operator", "100% xavfsiz";
  - soxta raqamlar: "10 000+ foydalanuvchi";
  - bo‘sh marketing iboralari: "Eng sara", "Inqilobiy", "Kelajak bozori";
  - aralash tillar ("Pedigree Zotdor", "Wireframe Specs", "Rating");
  - kodda qolib ketgan dizayn izohlari.
- Kontakt ma'lumotlari, sertifikatlar va huquqiy matnlar faqat mahsulot egasi bergan haqiqiy ma'lumot bo‘lsa qo‘yiladi. Bunday ma'lumot bo‘lmasa, element ko‘rsatilmaydi.

## 6. Ekran o‘lchamlari

- Maket 360 px kenglikdan boshlab chiziladi. Tekshiriladigan kengliklar: 360, 390, 768, 1280.
- Mobil: pastki navigatsiya (Bosh sahifa, Qidiruv, Sotish, Takliflarim, Profil). Auksion sahifasida taklif paneli pastki navigatsiya ustida qotib turadi.
- Desktop: kontent eni ko‘pi bilan 1200 px. Auksion sahifasi ikki ustunli: chapda media va ma'lumotlar, o‘ngda qotib turgan taklif paneli.
