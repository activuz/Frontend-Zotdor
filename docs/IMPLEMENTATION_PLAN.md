# Implementatsiya rejasi — Zotdor.uz

Har bir bosqich ishlaydigan, test qilingan natija bilan tugaydi. Keyingi bosqichga o‘tishdan oldin natija mahsulot egasiga ko‘rsatiladi. Bosqich ichidagi vazifalar ketma-ketligi bog‘liqlikka qarab tuzilgan.

Belgilar: ⛔ — tashqi omilga bog‘liq (mahsulot egasidan ma'lumot yoki shartnoma kerak).

## 0-bosqich. Poydevor
- [ ] Hozirgi frontend kodini `frontend/` ga ko‘chirish (`git mv`, tarix saqlanadi)
- [ ] `backend/` skeleti: Django 5, DRF, drf-spectacular, Procrastinate, env sozlamalari, `/api/health`
- [ ] `deploy/docker-compose.dev.yml`: postgres, api, worker
- [ ] Linterlar: backend uchun Ruff va mypy (django-stubs), frontend uchun ESLint va Prettier. `npm run lint` ishlaydigan holatga keltiriladi
- [ ] CI: lint, test va build
- [ ] OpenAPI → TS tiplari generatsiyasi (`npm run api:types`)

**Natija:** `docker compose up` buyrug‘i bilan bo‘sh API va hozirgi frontend ishga tushadi, CI yashil.

## 1-bosqich. Foydalanuvchi va kirish
- [ ] `accounts`, `reference`: modellar, viloyat va tumanlar fixture'i (OSM'dan import) ⛔ tuman ro‘yxatini tasdiqlash
- [ ] Toifalar fixture'i — manba: [TAXONOMY_DRAFT.md](TAXONOMY_DRAFT.md) ⛔ mahsulot egasi tasdiqlashi kerak
- [ ] `telegram_bot`: webhook, `/start <token>`, kontaktni tekshirish, `telegram_poll` buyrug‘i ⛔ bot @BotFather orqali yaratiladi va token beriladi
- [ ] Auth endpointlari, sessiya, CSRF, rate limit
- [ ] Frontend: `/login`, profilni to‘ldirish, `useMe`, himoyalangan marshrutlar
- [ ] Frontend'dan mock fallback'ni olib tashlash, xato holatlari uchun komponentlar

**Natija:** haqiqiy Telegram bot orqali kirish va chiqish ishlaydi. Raqam mos kelmasa, kirish rad etiladi.

## 2-bosqich. Hamyon
- [ ] `wallet`: modellar, `hold`, `release`, `capture`, `grant_bonus`, `expire_bonuses`, `adjust`, reconcile buyrug‘i
- [ ] Ro‘yxatdan o‘tganda bonus berish
- [ ] `/wallet` API va ekran (to‘ldirishsiz)

**Natija:** balans va operatsiyalar tarixi ko‘rinadi. Ledger testlari, jumladan bir vaqtdagi operatsiyalar testlari, o‘tadi.

## 3-bosqich. Auksion yaratish
- [ ] `auctions` modellari va holat mashinasi, `auction_events`
- [ ] `media`: capture session, yuklash, worker'da qayta ishlash (Pillow, ffmpeg)
- [ ] `moderation`: tekshiruv quvuri (matn va media tekshiruvlari)
- [ ] Submit → checking → scheduled/pending_review/rejected, e'lon qilishda rezerv qo‘yish
- [ ] Frontend: `/sell` ustasi, kamera moduli, qoralamani saqlash, tekshiruv natijasi ekrani

**Natija:** telefondan haqiqiy auksion yaratiladi, tekshiruvdan o‘tadi va rejalashtiriladi.

## 4-bosqich. Feed va takliflar
- [ ] Worker: `scheduled → live → ended` o‘tishlari
- [ ] `GET /auctions`: filtrlar, saralash, masofa
- [ ] `place_bid`, ommaviy taklif ro‘yxati (rank va tier bilan)
- [ ] Frontend: feed bo‘limlari, qidiruv (URL holati bilan), auksion sahifasi, taklif paneli, 5 s polling, sanoq
- [ ] Saqlanganlar

**Natija:** bir nechta foydalanuvchi bir vaqtda taklif beradi. Ranglar va tartib to‘g‘ri. Tugagan auksionga taklif o‘tmaydi.

## 5-bosqich. Yakun, bitim va reyting
- [ ] `decision` (tavsiya bloki), `accept_bid`, `reject_all`, 48 soatlik muddat, eslatmalar
- [ ] `deals`, kontaktlarni ochish, reytinglar, "bitim bo‘lmadi" arizalari
- [ ] Frontend: tanlash ekrani, bitim sahifasi, baholash, `/me/*` ro‘yxatlari, ommaviy profil

**Natija:** to‘liq savdo sikli: yaratish → takliflar → tanlash → komissiya → kontaktlar → baholar.

## 6-bosqich. Bildirishnomalar
- [ ] `telegram_outbox` va yuboruvchi (rate limit, qayta urinish)
- [ ] USER_FLOWS F8 matrisasidagi barcha hodisalar
- [ ] Ilova ichidagi bildirishnomalar va o‘qilmaganlar hisoblagichi

## 7-bosqich. Panel
- [ ] `panel/` ilovasi: kirish (xuddi shu Telegram auth, rol tekshiruvi bilan)
- [ ] Navbatlar: moderatsiya, shikoyatlar, "bitim bo‘lmadi" arizalari, pul qaytarish arizalari
- [ ] Foydalanuvchilar, bloklash, balansni tuzatish (admin)
- [ ] Sozlamalar, toifalar, audit jurnali, statistika

## 8-bosqich. To‘lovlar
- [ ] `payments`: `fake` provayder (dev va staging uchun)
- [ ] Click Prepare/Complete, imzo, idempotentlik ⛔ Click merchant shartnomasi va kalitlar kerak
- [ ] Frontend: to‘ldirish oqimi, to‘lov holati, pul qaytarish arizasi

**Eslatma:** shartnoma bo‘lmasa ham platforma ishga tushadi. Balans bonus va admin tomonidan qo‘lda to‘ldirish orqali boshqariladi (BR-44).

## 9-bosqich. Sifat va kontent
- [ ] DESIGN.md bo‘yicha dizayn o‘tishi: tokenlar, tipografika, holatlar, demo'dagi ortiqcha bezakni olib tashlash
- [ ] Barcha matnlarni tekshirish: ʻ va ʼ belgilari, soxta da'volarni olib tashlash
- [ ] Huquqiy sahifalar ⛔ matnni yurist beradi
- [ ] 404 sahifa, Error Boundary, offline holati
- [ ] Accessibility tekshiruvi (axe) va 360, 390, 768, 1280 kengliklarda qo‘lda sinov

## 10-bosqich. Ishga tushirish
- [ ] Production `docker-compose.yml`, nginx, TLS, xavfsizlik sarlavhalari
- [ ] Zaxira nusxa va tiklash sinovi
- [ ] Monitoring va `/api/health` ogohlantirishlari
- [ ] Xavfsizlik ko‘rigi (OWASP ASVS L1 ro‘yxati bo‘yicha)
- [ ] Yuklama sinovi: bitta auksionga 50 ta bir vaqtdagi xaridor
- [ ] Staging'da yopiq beta, keyin production ⛔ VPS (O‘zbekistonda) va domen DNS'i kerak

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
