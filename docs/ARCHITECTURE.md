# Arxitektura — Zotdor.uz

Holat: qoralama v0.1. Bog‘liq hujjatlar: [PRD](PRD.md), [DATABASE](DATABASE.md), [API](API.md).

## 1. Umumiy ko‘rinish

```
                 ┌──────────────┐        ┌───────────────┐
  Brauzer ──────▶│  frontend/   │        │    panel/     │◀────── Xodimlar
  (mobil)        │ React (Vite) │        │ React (Vite)  │
                 └──────┬───────┘        └──────┬────────┘
                        │  HTTPS, cookie sessiya │
                        ▼                        ▼
                 ┌─────────────────────────────────────┐
  Telegram ─────▶│   backend/ — Django + DRF (api)     │──────▶ Telegram Bot API
  (webhook)      │   /api/v1/*   /api/panel/*          │
  Click ────────▶│   /api/payments/click/*             │
                 └──────┬───────────────────┬──────────┘
                        │                   │
                 ┌──────▼──────┐     ┌──────▼──────────────┐
                 │ PostgreSQL  │◀────│ worker (Procrastinate)│ ffmpeg, Pillow
                 │ + task queue│     │ rejalashtiruvchi,     │
                 └─────────────┘     │ media, xabarlar       │
                                     └──────────────────────┘
                 Media fayllar: lokal disk (MEDIA_ROOT), nginx orqali beriladi
```

Repo tuzilmasi (maqsad):

```
/backend     Django loyihasi (Python 3.13)
/frontend    foydalanuvchi ilovasi (hozirgi demo kod shu yerga ko‘chadi)
/panel       moderator va admin paneli
/deploy      docker compose, nginx, backup skriptlari
/docs        hujjatlar
```

Uchala ilova **alohida deploy qilinadi**: frontend va panel statik build, backend esa konteyner. Ularni bitta VPS'ga ham, alohida hostlarga ham joylash mumkin (§8).

## 2. Asosiy texnik qarorlar

| # | Qaror | Sabab | Rad etilgan variant |
|---|---|---|---|
| D-1 | **Django 5 + DRF** | Auth, ORM, migratsiya, permission va throttling tayyor. Python talabiga mos | FastAPI: auth va migratsiya kabi qismlarni o‘zimiz yig‘ishimiz kerak bo‘lardi |
| D-2 | **PostgreSQL 17+** | Tranzaksiya, `SELECT … FOR UPDATE`, partial index, JSONB | SQLite: bir vaqtdagi takliflarga chidamaydi |
| D-3 | **Procrastinate** (Postgres asosidagi navbat) | Fon vazifalari va davriy vazifalar Redis va Celery'siz ishlaydi. Bitta servis kam | Celery + Redis: bu hajm uchun ortiqcha infratuzilma |
| D-4 | **Django sessiya cookie** (httpOnly, Secure, SameSite=Lax) + CSRF | XSS orqali tokenni o‘g‘irlab bo‘lmaydi. Chiqish va bloklash darhol ishlaydi | JWT + localStorage (demo'dagi variant) |
| D-5 | **Polling (5 s)** takliflar uchun | Bir necha soatlik auksionga yetarli. Qo‘shimcha servis kerak emas | WebSocket: keyingi bosqichga qoldirildi |
| D-6 | **Lokal disk** media uchun, `storages` abstraksiyasi orqali | Tashqi xarajat yo‘q. Kerak bo‘lsa S3'ga sozlama bilan o‘tiladi | Darhol S3 |
| D-7 | **Telegram webhook to‘g‘ridan-to‘g‘ri Django ichida**, httpx bilan | Bot juda kichik: `/start` va kontakt. Alohida framework va jarayon kerak emas | aiogram alohida servis |
| D-8 | **OpenAPI (drf-spectacular) → TS tiplari (openapi-typescript)** | Frontend, panel va backend kontrakti bitta manbadan olinadi | Tiplarni qo‘lda yozish (demo'dagi ikki xil model muammosi) |
| D-9 | **Panel alohida React ilova** | Asosiy bundle yengil qoladi. Panelga alohida domen va IP cheklov qo‘yish mumkin | Django admin (foydalanuvchi alohida panel so‘radi). Django admin faqat superuser uchun favqulodda vosita sifatida qoladi |
| D-10 | **Masofa: tuman markazlari koordinatalari + haversine** | PostGIS kerak emas. Aniq manzil oshkor bo‘lmaydi | PostGIS |
| D-11 | **Pul butun so‘mda, `BIGINT`** | Float xatolari bo‘lmaydi. Click summasi butun so‘mda qabul qilinadi | Decimal tiyin |

## 3. Backend modullari (Django app'lar)

| App | Vazifa |
|---|---|
| `core` | sozlamalar (`PlatformSettings`), umumiy xato formati, audit jurnali, vaqt yordamchilari |
| `accounts` | `User`, rollar, Telegram orqali kirish (`LoginRequest`), profil |
| `reference` | viloyat, tuman, yo‘nalish, tur, toifa, zot |
| `auctions` | auksion, holat mashinasi, takliflar, feed va qidiruv |
| `media` | capture session, yuklash, qayta ishlash, tekshiruvlar |
| `moderation` | avtomatik tekshiruv quvuri, moderatsiya navbati, shikoyatlar |
| `deals` | bitim, reyting, "bitim bo‘lmadi" arizalari |
| `wallet` | hamyon, ledger, rezervlar, bonus, pul qaytarish arizalari |
| `payments` | Click Prepare/Complete, to‘lovlar |
| `notifications` | ilova ichidagi xabarlar, Telegram outbox |
| `telegram_bot` | webhook, `/start`, kontaktni tekshirish, lokal polling buyrug‘i |
| `panel_api` | `/api/panel/*` — xodimlar endpointlari |

**Qatlam qoidasi:** biznes logika `services.py` dagi funksiyalarda bo‘ladi, masalan `place_bid()`, `accept_bid()`, `charge_commission()`. View'lar faqat kirishni tekshiradi va service'ni chaqiradi. Model `save()` ichida biznes logika yozilmaydi. Shu tufayli logika HTTP'siz test qilinadi va panel bilan ilova bir xil qoidadan foydalanadi.

## 4. Auksion holat mashinasi

```
draft ──submit──▶ checking ──pass──▶ scheduled ──starts_at──▶ live ──ends_at──▶ ended
                     │  └─warn──▶ pending_review ──approve──▶ scheduled            │
                     └─fail──▶ rejected ◀──reject── pending_review                 │
                                                          ┌────────── accept ──────┤
                                                          ▼                        │
 scheduled/live(0 taklif) ──cancel──▶ cancelled         sold        unsold ◀── reject_all / 48 soat
 istalgan holat ──moderator──▶ blocked
```

- Diagrammada ko‘rsatilmagan yana bitta o‘tish bor: `live ──accept──▶ sold` (BR-35). U faqat `now() ≥ starts_at + early_accept_min_minutes` bo‘lganda ruxsat etiladi. Bu o‘tish `ends_at` ni hozirgi vaqtga tenglashtiradi, shu sababli boshqa takliflar ham darhol yopiladi.
- O‘tishlar faqat `auctions.services` orqali amalga oshadi va har biri `AuctionEvent` jadvaliga yoziladi.
- `scheduled → live` va `live → ended` o‘tishlarini worker har 30 soniyada bajaradi. **Lekin to‘g‘rilik worker'ga bog‘liq emas:** taklif qabul qilinayotganda `now() < ends_at` sharti bazada, tranzaksiya ichida tekshiriladi. Worker kechiksa ham tugagan auksionga taklif o‘tmaydi.
- `checking` qisqa holat. Media qayta ishlanib, tekshiruvlar tugashi bilan auksion keyingi holatga o‘tadi.
- `scheduled` holatiga o‘tishdan oldin rezerv qo‘yiladi (`wallet.services.hold`). Balans yetmasa, o‘tish rad etiladi va auksion `draft`'da qoladi, foydalanuvchiga "Balansni to‘ldiring" deb xabar beriladi.

## 5. Kritik operatsiyalar va bir vaqtdalik

**Taklif berish (`place_bid`)** — bitta tranzaksiya:
1. `SELECT … FROM auctions WHERE id=… FOR UPDATE`.
2. Tekshiruvlar: holat `live` va `now() < ends_at`; bidder ≠ seller; foydalanuvchi bloklanmagan; summa `[min_bid, max_bid]` oralig‘ida; rate limit.
3. Foydalanuvchining oldingi faol taklifi `superseded` qilinadi.
4. Yangi taklif yoziladi. Agar foydalanuvchining shu auksionda taxallusi (`Xaridor #N`) bo‘lmasa, u ham yaratiladi.
5. Auksiondagi denormal hisoblagichlar yangilanadi (`top_bid_amount`, `active_bids_count`, `bidders_count`).
6. Commit'dan keyin (`transaction.on_commit`) xabarlar navbatga qo‘yiladi.

Auksion qatorini qulflash har bir auksiondagi takliflarni ketma-ket qiladi. Bir necha soatlik auksionda daqiqasiga o‘nlab taklif bo‘ladi, bu hajm uchun shu yetarli.

**Taklifni qabul qilish (`accept_bid`)** — bitta tranzaksiya: auksion va hamyon qulflanadi → holat tekshiriladi (`ended` va qaror muddati o‘tmagan, yoki `live` va BR-35 sharti bajarilgan; taklif faol) → `Deal` yaratiladi → `charge_commission` (rezerv olinadi, farq qaytariladi yoki qo‘shimcha yechiladi) → auksion `sold` holatiga o‘tadi.

**Ledger** — `wallet.services` dan tashqarida balans o‘zgartirilmaydi. Har bir operatsiya `WalletEntry` qatori va `Wallet` dagi qoldiqning yangilanishidan iborat bo‘ladi, ikkalasi bitta tranzaksiyada, `Wallet` qatori qulflangan holda. `Wallet` qoldiqlarini ledger'dan qayta hisoblaydigan tekshiruv buyrug‘i (`manage.py wallet_reconcile`) har kecha ishlaydi va nomuvofiqlik topsa, xabar beradi.

## 6. Telegram orqali kirish

```
Brauzer                      Backend                         Telegram bot
  │ POST /auth/telegram/start {phone}                              │
  │──────────────────────────▶ LoginRequest(token, poll_secret)    │
  │◀── {request_id, deep_link}  + cookie zd_login=<poll_secret>    │
  │ t.me/<bot>?start=<token> ────────────────────────────────────▶ │ /start <token>
  │                              ◀── webhook: /start               │
  │                              "Raqamni ulashish" tugmasi ──────▶│
  │                              ◀── webhook: contact              │
  │                              contact.user_id == from.id ?      │
  │                              phone == LoginRequest.phone ?     │
  │                              → verified                        │
  │ GET /auth/telegram/status/<id> (har 2 s, cookie bilan)         │
  │◀── verified → sessiya ochiladi (Set-Cookie: sessionid)         │
```

- `token` 32 bayt tasodifiy qiymat bo‘lib, bazada faqat hash'i saqlanadi. Amal qilish muddati 10 daqiqa, bir martalik.
- `poll_secret` brauzerni so‘rovga bog‘laydi. Kimdir deep-link'ni o‘g‘irlab, o‘z Telegramida tasdiqlasa ham, sessiya faqat so‘rovni boshlagan brauzerga ochiladi.
- `contact.user_id != from.id` bo‘lsa, so‘rov rad etiladi: begona kontaktni yuborib bo‘lmaydi.
- Bot webhook manzilida maxfiy qism bor, hamda Telegram `X-Telegram-Bot-Api-Secret-Token` sarlavhasi tekshiriladi.
- Lokal ishlab chiqishda `manage.py telegram_poll` buyrug‘i `getUpdates` orqali ishlaydi, shuning uchun ommaviy URL kerak emas.

## 7. Media va tekshiruvlar

**Suratga olish (frontend).** `getUserMedia` orqali sahifa ichida kamera oynasi ochiladi. Rasm `canvas` orqali JPEG qilib olinadi, video `MediaRecorder` bilan yoziladi. `<input type="file">` ishlatilmaydi.

**Capture session.** Kamera ochilishidan oldin `POST /media/capture-sessions` chaqiriladi va 20 daqiqalik sessiya olinadi. Server faqat amal qilayotgan sessiyaga bog‘langan yuklashni qabul qiladi va har bir faylning qabul qilingan vaqtini o‘zi yozadi. Bu "rasm yaqinda olingan" talabini server tomonida ta'minlaydi. **Cheklov:** bu to‘siq, mutlaq kafolat emas. Brauzerni chetlab o‘tgan yoki virtual kamera ishlatgan foydalanuvchini to‘liq to‘xtatib bo‘lmaydi. Shuning uchun dublikat va ekrandan qayta olingan rasm tekshiruvlari ham bor.

**Qayta ishlash (worker):**
- Rasm: Pillow bilan tekshiriladi (`verify`), EXIF olib tashlanadi, 1600 px va 480 px WebP nusxalari yaratiladi, perceptual hash (`imagehash`) hisoblanadi.
- Video: `ffprobe` bilan tekshiriladi, `ffmpeg` bilan H.264 MP4 720p ga o‘tkaziladi (iOS'da ham ijro bo‘lishi uchun), poster kadr olinadi. Chegaralar: 5–30 soniya, ≤ 60 MB.

**Tekshiruv quvuri.** `moderation/checks/` papkasida har bir tekshiruv alohida klass bo‘ladi va umumiy interfeysga ega:

```python
class Check(Protocol):
    name: str
    def run(self, auction: Auction) -> CheckResult: ...  # pass | warn | fail + sabab
```

| Tekshiruv | MVP | Natija |
|---|---|---|
| `TextProfanity` | lokal so‘zlar ro‘yxati (lotin, kirill, rus) | fail |
| `TextContacts` | telefon, @username, t.me, havolalar uchun regex (bo‘shliq va boshqa belgilar qo‘yib yozilgan raqamlar ham) | fail |
| `MediaCount` | 4–10 rasm, ≥ 1 video | fail |
| `MediaFreshness` | barcha fayllar auksion bog‘langan capture session ichida yuklangan | fail |
| `MediaQuality` | minimal o‘lcham (qisqa tomoni ≥ 720 px), xira rasmni aniqlash | warn |
| `MediaDuplicate` | phash boshqa auksionlardagi rasmlarga juda yaqin | warn |
| `PoseCheck` | **keyingi bosqich** — MediaPipe kabi model | — |

Barcha tekshiruv o‘tsa, auksion `scheduled` holatiga o‘tadi. Kamida bitta `warn` bo‘lsa, `pending_review` holatiga tushadi. Kamida bitta `fail` bo‘lsa, `rejected` bo‘ladi va foydalanuvchiga tuzatish yo‘li ko‘rsatiladi. Yangi model qo‘shish uchun ro‘yxatga yangi `Check` qo‘shiladi va boshqa kod o‘zgarmaydi.

## 8. Deploy

**Production (tanlangan, 2026-11-23): Vercel + Render + Nhost.** Sayt `web.zotdor.uz` va panel `panel.zotdor.uz` — Vercel'da, API va worker `api.zotdor.uz` — Render'da (Docker), PostgreSQL va fayllar — Nhost'da. Fayllar `auctions/storage.py` orqali `STORAGE_BACKEND=nhost` rejimida Nhost Storage'ga yoziladi: originallar `media-private` bucket'iga, qayta ishlangan nusxalar `media-public` ga. Brauzer rasmni Nhost'dan to‘g‘ridan-to‘g‘ri oladi. Sessiya cookie'si `api.zotdor.uz` da, CSRF cookie'si `.zotdor.uz` da turadi (SPA uni o‘qishi kerak). Bu ishlaydi, chunki barcha manzillar bitta saytda. Sozlash tartibi: [DEPLOYMENT.md](DEPLOYMENT.md).

**Variant A — bitta VPS (muqobil, saqlangan):** `deploy/docker-compose.yml` ichida `db`, `migrate` (bir martalik: migratsiya va collectstatic), `api` (gunicorn), `worker` (procrastinate) va `nginx` bor. Nginx TLS'ni (Let's Encrypt), `zotdor.uz` uchun frontend build'ni, `panel.zotdor.uz` uchun panel build'ni va `/media/` ni beradi. Ikkala domen ham `/api/` ni `api` konteyneriga uzatadi: alohida `api.zotdor.uz` kerak emas va cookie doim birinchi tomon cookie'si bo‘ladi. Ishga tushirish tartibi: [deploy/README.md](../deploy/README.md).

**Variant B — alohida hostlar (production shu variantning ko‘rinishi):** frontend va panel istalgan statik hostingga qo‘yiladi, faqat `VITE_API_URL=https://api.zotdor.uz` beriladi. **Sharti:** barcha ilovalar bitta asosiy domen ostida bo‘lishi kerak (`*.zotdor.uz`). Aks holda sessiya cookie'si uchinchi tomon cookie'si bo‘lib qoladi va brauzerlar uni bloklaydi.

*Hozirgi holat:* frontend Vercel'ga ulangan. Vercel loyihasida **Root Directory = `frontend`** bo‘lishi kerak. SPA marshrutlari `frontend/vercel.json` orqali sozlanadi. Backend ulangandan keyin login ishlashi uchun Vercel'ga `zotdor.uz` (yoki `app.zotdor.uz`) custom domeni ulanishi shart: `*.vercel.app` domenida sessiya cookie'si ishlamaydi.

**Konfiguratsiya** faqat env orqali beriladi (`backend/.env.example`): `DJANGO_SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID`, `PAYMENTS_PROVIDER=click|fake`, `MEDIA_ROOT`.

**Zaxira nusxa:** har kecha `pg_dump` va `rsync` (media) boshqa serverga, 14 kunlik nusxalar saqlanadi. Tiklash protsedurasi `deploy/RESTORE.md` da yoziladi va har chorakda sinab ko‘riladi.

**Monitoring:** strukturali JSON loglar, `/api/health` endpointi (DB va worker heartbeat), worker navbatining kechikishi uchun ogohlantirish. Xatolarni kuzatish uchun GlitchTip (self-host) yoki Sentry ixtiyoriy, alohida qaror bilan.

## 9. Xavfsizlik

- Sessiya cookie: `HttpOnly`, `Secure`, `SameSite=Lax`. CSRF token har bir mutatsiyada `X-CSRFToken` sarlavhasida yuboriladi. CORS faqat ruxsat etilgan origin'larga ochiq, `credentials` bilan.
- Ruxsatlar: har bir endpointda DRF permission bor. Obyekt darajasida ham tekshiriladi: auksionni faqat egasi tahrirlaydi, bitim kontaktlarini faqat ikki tomon ko‘radi. Panel endpointlari `role in (moderator, admin)` talab qiladi. Sozlamalar, balansni tuzatish va xodimlarni boshqarish faqat `admin` uchun.
- Rate limit (DRF throttling, Postgres kesh jadvali bilan): kirish uchun bir raqamga soatiga 5 ta va bir IP'ga soatiga 20 ta; taklif uchun auksion bo‘yicha 1/10 s va umumiy 30/min; media yuklash uchun 60/soat.
- Yuklash: Content-Type'ga ishonilmaydi, fayl Pillow yoki ffprobe bilan ochib tekshiriladi. Hajm chegarasi nginx'da ham, Django'da ham qo‘yiladi. Fayl nomlari UUID bo‘ladi va media kataloglarida kod bajarilmaydi.
- Click callback'larida imzo (`sign_string`) va summa tekshiriladi. Takroriy callback idempotent qayta ishlanadi.
- Xodimlarning har bir harakati `StaffAuditLog` ga yoziladi: kim, nima, oldingi va keyingi qiymat, IP.
- Sotuvchi va xaridorning telefoni faqat bitim tomonlariga ko‘rinadi. Profil koordinatalari ~1 km gacha yaxlitlanib saqlanadi.
- Sarlavhalar: CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS.

## 10. Frontend arxitekturasi

- Mavjud stack saqlanadi: React 18, TS, Vite, Tailwind, React Query, React Router.
- `src/api/` — OpenAPI'dan generatsiya qilingan tiplar (`schema.d.ts`) va yupqa `fetch` yoki axios mijozi (`withCredentials`, CSRF). **Mock fallback olib tashlanadi**: API xatosi foydalanuvchiga xato sifatida ko‘rsatiladi, soxta ma'lumot o‘rniga.
- Mock'lar faqat testlar uchun qoladi (MSW).
- `src/features/<feature>/` — auksion, takliflar, hamyon, kirish va h.k. bo‘yicha komponentlar, hook'lar va sahifalar.
- Har bir so‘rovli ekranda to‘rt holat bo‘ladi: loading (skeleton), empty, error (qayta urinish tugmasi bilan), success. `alert()` ishlatilmaydi, uning o‘rniga toast va inline xabarlar.
- Kamera moduli (`features/capture`) alohida va lazy yuklanadi.
- Panel (`/panel`) ham xuddi shu stack'da bo‘ladi, UI komponentlari esa unga nusxa qilinadi. Umumiy paket faqat haqiqatan takrorlanish paydo bo‘lgandagina ajratiladi.
