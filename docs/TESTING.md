# Test strategiyasi — Zotdor.uz

Maqsad shunday: pul, takliflar va holat o‘tishlari xato ishlasa, buni test ushlashi kerak, foydalanuvchi emas.

## Qatlamlar

| Qatlam | Vosita | Nimani tekshiradi |
|---|---|---|
| Domen (service) | pytest, pytest-django, factory_boy | `place_bid`, `accept_bid`, `wallet.*`, holat mashinasi, tekshiruvlar |
| API | DRF `APIClient` | ruxsatlar, validatsiya, xato kodlari, javob shakli OpenAPI'ga mosligi |
| Integratsiya | lokal sinov ma'lumotlari | Telegram update'lari, Click callback'lari (imzo, idempotentlik) |
| Frontend unit | Vitest, Testing Library, MSW | formatlash, taklif ro‘yxati (rank va tier), formalar, holatlar |
| E2E | Playwright (Chromium, `--use-fake-device-for-media-stream`) | asosiy oqimlar: F1–F5 |
| Qo‘lda | haqiqiy telefonlar (Android Chrome, iOS Safari) | kamera, video, Telegram deep-link, sekin tarmoq |

## Majburiy holatlar

**Takliflar**
- 50% dan past va 300% dan yuqori takliflar rad etiladi, chegaradagi qiymatlar qabul qilinadi
- yangi taklif oldingisini `superseded` qiladi; faol taklif har doim bitta bo‘ladi (partial unique index)
- `ends_at` dan keyin taklif rad etiladi, hatto auksion hali `live` holatida bo‘lsa ham
- sotuvchi o‘z auksioniga taklif bera olmaydi; bloklangan foydalanuvchi ham taklif bera olmaydi
- 20 ta parallel taklifdan keyin hisoblagichlar to‘g‘ri bo‘ladi (`top_bid_amount`, `bidders_count`)
- tier: 1 → green, 2–3 → yellow, 4+ → red; teng summada avval berilgan taklif yuqorida turadi

**Muddatidan oldin qabul qilish (BR-35)**
- boshlanishdan 10 daqiqa o‘tmasdan `accept` → `early_accept_too_soon`
- 10 daqiqadan keyin `accept` → auksion `sold` holatiga o‘tadi va shundan keyingi taklif `auction_not_live` bilan rad etiladi
- `accept` va boshqa xaridorning taklifi bir vaqtda kelsa, ikkalasidan faqat bittasi o‘tadi, natija izchil bo‘ladi

**Pul**
- rezerv, keyin bitim: komissiya to‘g‘ri hisoblanadi (yaxlitlash), farq qaytadi
- komissiya rezervdan katta bo‘lsa, balans manfiyga tushadi va yangi auksion bloklanadi
- avval bonus, keyin asosiy balans ishlatiladi; muddati o‘tgan bonus yonadi
- har bir operatsiyadan keyin `wallet_reconcile` farq topmaydi
- Click: noto‘g‘ri imzo rad etiladi; noto‘g‘ri summa rad etiladi; takroriy `complete` balansni ikki marta to‘ldirmaydi

**Auth**
- begona kontakt (`contact.user_id != from.id`) rad etiladi
- raqam mos kelmasa, kirish rad etiladi
- muddati o‘tgan yoki ishlatilgan token qayta ishlatilmaydi
- `poll_secret` bo‘lmagan brauzer sessiya ola olmaydi

**Ruxsatlar:** har bir endpoint uchun anonim, oddiy foydalanuvchi, egasi, moderator va admin holatlari jadval-test sifatida yoziladi.

**Moderatsiya:** kontakt aniqlash testlarida haqiqiy aldash usullari ishlatiladi: `9 0 1 2 3`, `to‘qson bir`, `@user`, `t . me`.

## Qamrov va qoidalar

- `auctions/services`, `wallet/services`, `deals/services` va `payments` uchun satr qamrovi ≥ 90%, qolgan backend kodi uchun ≥ 75%.
- Har bir bug tuzatish avval uni takrorlaydigan testdan boshlanadi.
- Testlar haqiqiy PostgreSQL'da ishlaydi (SQLite'da emas), chunki qulflar va partial index'lar tekshiriladi.
- Vaqtga bog‘liq testlar `time-machine` bilan yoziladi. `sleep` ishlatilmaydi.
- Tashqi xizmatlarga (Telegram, Click) testlarda haqiqiy so‘rov yuborilmaydi.

## "Tayyor" degani

Funksiya quyidagi shartlar bajarilgandagina tayyor hisoblanadi:
1. backend va frontend testlari yashil, linterlar toza;
2. API hujjati va OpenAPI tiplari yangilangan;
3. to‘rt holat (loading, empty, error, success) ko‘rib chiqilgan;
4. 360 px va desktop kengliklarida qo‘lda tekshirilgan;
5. oqim E2E test bilan qoplangan, agar u F1–F5 ga kirsa.

Biror qadam bajarilmagan bo‘lsa, bu PR tavsifida ochiq yoziladi.
