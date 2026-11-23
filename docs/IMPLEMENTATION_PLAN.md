# Implementatsiya rejasi — Zotdor.uz

Har bir bosqich ishlaydigan, test qilingan natija bilan tugaydi. Keyingi bosqichga o‘tishdan oldin natija mahsulot egasiga ko‘rsatiladi. Bosqich ichidagi vazifalar ketma-ketligi bog‘liqlikka qarab tuzilgan.

Belgilar: ⛔ — tashqi omilga bog‘liq (mahsulot egasidan ma'lumot yoki shartnoma kerak).

## 0-bosqich. Poydevor
- [x] Hozirgi frontend kodini `frontend/` ga ko‘chirish (`git mv`, tarix saqlanadi)
- [x] `backend/` skeleti: Django 5.2, DRF, drf-spectacular, Procrastinate, env sozlamalari, `/api/health`, yagona xato formati, minimal `User` modeli (birinchi migratsiyadan oldin bo‘lishi shart)
- [x] ~~`deploy/docker-compose.dev.yml`~~ — **o‘zgartirildi (2026-11-21):** lokal muhit Docker'siz ishlaydi, PostgreSQL to‘g‘ridan-to‘g‘ri o‘rnatilgan (mahsulot egasining qarori). Docker faqat production deploy uchun, 10-bosqichda
- [x] Linterlar: backend uchun Ruff va mypy (strict, django-stubs), frontend uchun ESLint. Demo kodidagi `alert()` va `any` tuzatildi. Prettier qo‘shilmadi, chunki u butun demo kodni qayta formatlab, katta diff hosil qiladi — 9-bosqichdagi dizayn o‘tishida qo‘shiladi
- [x] Backend testlari lokal PostgreSQL'da yashil (14 ta); worker heartbeat'i qo‘lda tekshirildi
- [ ] CI: lint, test va build (`.github/workflows/ci.yml` yozildi, GitHub'da hali ishga tushmagan)
- [x] OpenAPI → TS tiplari generatsiyasi (`npm run api:types`)

**Natija:** lokal PostgreSQL bilan bo‘sh API va hozirgi frontend ishga tushadi, CI yashil.

## 1-bosqich. Foydalanuvchi va kirish
- [x] `accounts`, `reference`: modellar. 14 ta hudud va 203 ta tuman OSM'dan import qilindi (`load_reference`). Mahsulot egasi yondashuvni tasdiqladi. Xorazmdagi Urganch shahri va Xiva shahri yetishmaydi, ular panelda qo‘shiladi
- [x] Toifalar seed'i ([TAXONOMY_DRAFT.md](TAXONOMY_DRAFT.md) asosida, mahsulot egasi tahrir qilgan). Qolgan sozlashlar panelda qilinadi
- [x] `telegram_bot`: webhook (URL secret va header bilan), `/start <token>`, kontaktni tekshirish, `telegram_poll` buyrug‘i. Bot: @ZotdorPlatformBot
- [x] Auth endpointlari, sessiya, CSRF, rate limit (DB asosida)
- [x] Frontend: `/login`, `/me/setup`, `useMe`, `RequireAuth` (`/add`, `/profile`), haqiqiy ma'lumotli profil sahifasi va chiqish
- [x] Yashirin mock fallback olib tashlandi (`src/api/http.ts`). **Vaqtinchalik:** e'lon va auksion ekranlari 3–4-bosqichlargacha ochiq demo rejimida ishlaydi va har bir sahifada `DemoNotice` ogohlantirishi ko‘rinadi
- [x] Haqiqiy telefon va bot bilan qo‘lda sinov — mahsulot egasi tasdiqladi (2026-11-21)
- [x] Ro‘yxatdan o‘tishda bonus berish — 2-bosqichda bajarildi

**Natija:** haqiqiy Telegram bot orqali kirish va chiqish ishlaydi. Raqam mos kelmasa, kirish rad etiladi.

## 2-bosqich. Hamyon
- [x] `wallet`: modellar, `hold`, `release_hold`, `capture_commission`, `grant_signup_bonus`, `expire_bonuses`, `adjust`, `reconcile`. Kunlik vazifalar: bonuslarni yoqish (03:00) va reconcile (03:30). Buyruq: `manage.py wallet_reconcile`
- [x] `core.PlatformSettings`: bonus summasi, komissiya stavkasi va boshqa biznes sozlamalari (bitta qator, keyin panelda tahrirlanadi)
- [x] Ro‘yxatdan o‘tganda bonus berish
- [x] `/wallet` API va ekran (to‘ldirishsiz, balansni hozircha faqat administrator to‘ldira oladi)

**Natija:** balans va operatsiyalar tarixi ko‘rinadi. Ledger testlari, jumladan bir vaqtdagi operatsiyalar testlari, o‘tadi.

## 3-bosqich. Auksion yaratish
- [x] `auctions` modellari va holat mashinasi, `auction_events`
- [x] media (`auctions` app ichida): capture session, yuklash, worker'da qayta ishlash (Pillow, ffmpeg)
- [x] `moderation`: tekshiruv quvuri (matn va media tekshiruvlari)
- [x] Submit → scheduled/pending_review/rejected (tekshiruvlar sinxron), e'lon qilishda rezerv qo‘yish
- [x] Frontend: `/sell` ustasi, kamera moduli, qoralamani saqlash, tekshiruv natijasi ekrani (`features/sell`). Telefonda haqiqiy kamera bilan qo‘lda sinov hali qilinmagan

**Natija:** telefondan haqiqiy auksion yaratiladi, tekshiruvdan o‘tadi va rejalashtiriladi.

## 4-bosqich. Feed va takliflar
- [x] Worker: `scheduled → live → ended` o‘tishlari
- [x] `GET /auctions`: filtrlar, saralash, masofa
- [x] `place_bid`, ommaviy taklif ro‘yxati (rank va tier bilan)
- [x] Frontend: feed bo‘limlari, qidiruv (URL holati bilan), auksion sahifasi, taklif paneli, 5 s polling, sanoq
- [x] Saqlanganlar (backend va `/me/saved`)

**Natija:** bir nechta foydalanuvchi bir vaqtda taklif beradi. Ranglar va tartib to‘g‘ri. Tugagan auksionga taklif o‘tmaydi.

## 5-bosqich. Yakun, bitim va reyting
- [x] `decision` (tavsiya bloki), `accept_bid`, `reject_all`, 48 soatlik muddat, eslatmalar
- [x] `deals`, kontaktlarni ochish, reytinglar, "bitim bo‘lmadi" arizalari
- [x] Frontend: tanlash ekrani, bitim sahifasi, baholash, `/me/*` ro‘yxatlari, ommaviy profil

**Natija:** to‘liq savdo sikli: yaratish → takliflar → tanlash → komissiya → kontaktlar → baholar.

## 6-bosqich. Bildirishnomalar
- [x] `telegram_outbox` va yuboruvchi (rate limit, qayta urinish)
- [x] USER_FLOWS F8 matrisasidagi barcha hodisalar (vaqtga bog‘liqlari `notifications.services.send_reminders`, har daqiqada)
- [x] Ilova ichidagi bildirishnomalar va o‘qilmaganlar hisoblagichi

## 7-bosqich. Panel
- [x] `panel/` ilovasi: kirish (xuddi shu Telegram auth, rol tekshiruvi bilan)
- [x] Navbatlar: moderatsiya, shikoyatlar, "bitim bo‘lmadi" arizalari, pul qaytarish arizalari
- [x] Foydalanuvchilar, bloklash, balansni tuzatish (admin)
- [x] Sozlamalar, toifalar, audit jurnali, statistika

## 8-bosqich. To‘lovlar
- [x] `payments`: `fake` provayder (dev va staging uchun)
- [ ] Click Prepare/Complete, imzo, idempotentlik — kod va testlar tayyor; haqiqiy kalitlar bilan sinov ⛔ Click merchant shartnomasi kerak
- [x] Frontend: to‘ldirish oqimi, to‘lov holati, pul qaytarish arizasi (`fake` provayderda test sahifasi bilan)

**Eslatma:** shartnoma bo‘lmasa ham platforma ishga tushadi. Balans bonus va admin tomonidan qo‘lda to‘ldirish orqali boshqariladi (BR-44).

## 9-bosqich. Sifat va kontent
- [x] Landing (`landing/`, FR-18): eski "tez orada" sahifasi platformaga moslandi — haqiqiy auksionlar va sozlamalar API'dan, FAQ, narx, xavfsizlik boʻlimlari; standart yozuv lotin, kirill avtomatik; Supabase olib tashlandi, aloqa formasi `POST /api/v1/leads` ga, arizalar panelning "Sayt arizalari" boʻlimida (2026-11-23)
- [x] SEO (2026-11-24): har sahifa uchun title, description, canonical, `noindex` (shaxsiy sahifalar), Open Graph (auksion havolalari uchun API orqali), avtomatik sitemap (`backend/seo`), `robots.txt`, JSON-LD (FAQ, Organization, Product). Qo‘llanma: docs/SEO.md
- [ ] Search Console, Yandex Webmaster, Bing'da saytlarni tasdiqlash va sitemap yuborish ⛔ DNS va akkauntlar (docs/SEO.md §3)
- [ ] Landing: Vercel'da uchinchi loyiha, `zotdor.uz` domeni, Render'da `LEADS_TELEGRAM_CHAT_ID` ⛔ deploy
- [ ] DESIGN.md bo‘yicha dizayn o‘tishi: tokenlar, tipografika, holatlar, demo'dagi ortiqcha bezakni olib tashlash
- [ ] Barcha matnlarni tekshirish: ʻ va ʼ belgilari, soxta da'volarni olib tashlash
- [ ] Huquqiy sahifalar ⛔ matnni yurist beradi
- [x] 404 sahifa, Error Boundary, offline holati
- [ ] Accessibility tekshiruvi (axe) va 360, 390, 768, 1280 kengliklarda qo‘lda sinov

## 10-bosqich. Ishga tushirish
- [x] Production `docker-compose.yml`, nginx, TLS, xavfsizlik sarlavhalari (`deploy/`). Docker'da hali ishga tushirib ko‘rilmagan — birinchi VPS o‘rnatishida tekshiriladi
- [ ] Zaxira nusxa va tiklash sinovi — `deploy/backup.sh` va `deploy/RESTORE.md` yozildi, tiklash sinovi VPS'da qilinadi
- [ ] Monitoring va `/api/health` ogohlantirishlari — endpoint va compose healthcheck bor, tashqi ogohlantirish xizmatini tanlash kerak
- [ ] Xavfsizlik ko‘rigi (OWASP ASVS L1 ro‘yxati bo‘yicha)
- [ ] Yuklama sinovi: bitta auksionga 50 ta bir vaqtdagi xaridor
- [x] Production sxemasi tanlandi (2026-11-23): Vercel + Render + Nhost. Kod moslandi (`auctions/storage.py`, `render.yaml`, `vercel.json`), qo‘llanma: [DEPLOYMENT.md](DEPLOYMENT.md). VPS varianti `deploy/` da saqlangan
- [ ] Staging'da yopiq beta, keyin production ⛔ Nhost Pro, Render Starter, DNS yozuvlari va yangi bot tokeni kerak

## Mahsulot egasidan kerakli narsalar (⛔ ro‘yxati)

| Narsa | Qaysi bosqichgacha |
|---|---|
| PRD §8 taxminlarini tasdiqlash | 1 |
| Telegram bot (nom, username, token) | 1 |
| Toifalar va zotlar ro‘yxatini tasdiqlash | 3 |
| Moderatsiya javob vaqti va moderatorlar soni | 7 |
| Click merchant shartnomasi | 8 (ishga tushirishni to‘xtatmaydi) |
| Oferta va maxfiylik siyosati matni, haqiqiy kontaktlar | 9 |
| VPS va domen | 10 |
