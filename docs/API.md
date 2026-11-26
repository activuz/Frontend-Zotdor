# API — Zotdor.uz

Asosiy manzil: `https://api.zotdor.uz/api/v1`. Panel endpointlari `/api/panel` ostida joylashgan. To‘liq va har doim aniq sxema `GET /api/schema/` (OpenAPI 3.1, drf-spectacular) orqali olinadi. Bu hujjat kontraktning qisqa ko‘rinishi va qoidalari. Endpoint o‘zgarsa, shu fayl o‘sha PR ichida yangilanadi.

## Umumiy qoidalar

**Autentifikatsiya.** Django sessiya cookie'si (`sessionid`) ishlatiladi. Har bir so‘rov `credentials: 'include'` bilan yuboriladi. `GET` bo‘lmagan har bir so‘rovda `X-CSRFToken` sarlavhasi bo‘lishi kerak. Token `GET /auth/csrf` javobida (`csrf_token`) keladi; o‘sha so‘rov `csrftoken` cookie'sini ham o‘rnatadi.

**Format.** JSON, `snake_case`. Vaqt ISO 8601, UTC (`2026-11-20T09:30:00Z`). Pul butun so‘mda (`25000000`).

**Xato formati** (har doim bir xil):
```json
{ "error": { "code": "bid_too_low", "message": "Taklif kamida 12 500 000 so‘m bo‘lishi kerak", "fields": { "amount": ["..."] } } }
```
`message` foydalanuvchiga ko‘rsatishga tayyor o‘zbekcha matn. `code` esa frontend logikasi uchun.

**Statuslar:** `400` validatsiya, `401` kirilmagan, `403` ruxsat yo‘q yoki foydalanuvchi bloklangan, `404`, `409` holat ziddiyati (masalan, auksion allaqachon tugagan), `429` rate limit (`Retry-After` sarlavhasi bilan).

**Sahifalash:** ro‘yxatlar (`/wallet/entries`, `/notifications`) cursor asosida: `?cursor=…`, javob `{ "results": [...], "next": "<url>|null" }`. Feed (`GET /auctions`) esa `?limit=&offset=` bilan ishlaydi (standart 20, ko‘pi bilan 50), javob `{count, next, previous, results}`. Sabab: saralash masofa va faollik bo‘yicha ham bo‘ladi, cursor uchun barqaror kalit yo‘q.

## Auth

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/auth/csrf` | CSRF cookie'ni o‘rnatadi va `{csrf_token}` qaytaradi. Mijoz tokenni javobdan oladi va `X-CSRFToken` da yuboradi (boshqa subdomendan cookie o‘qib bo‘lmaydi). Token noto‘g‘ri yoki eskirgan bo‘lsa `403 csrf_failed` — mijoz yangi token olib, bir marta qayta urinadi |
| POST | `/auth/telegram/start` | `{phone, client?: "web" | "app"}` → `201 {request_id, deep_link, expires_at}` va `zd_login` cookie'si. `client` (standart `web`) — kirish qayerda boshlangani: tasdiqdan keyin bot "Zotdorʼga qaytish" tugmasini shunga qarab beradi (`web` → `/login?continue=1`, `app` → `/app/login`), chunki kirish faqat cookie turgan joyda yakunlanadi |
| GET | `/auth/telegram/status/{request_id}` | `zd_login` cookie talab qilinadi. Javob: `{status: pending\|verified\|failed\|expired, fail_reason?, message?, user?}`. `verified` bo‘lsa sessiya ochiladi va `user` qaytadi. So‘rov bir martalik |
| POST | `/auth/logout` | `204` |
| GET | `/me` | joriy foydalanuvchi, `needs_profile: bool` (ism, viloyat yoki tuman bo‘lmasa `true`), `has_location` va `location: {lat, lng} \| null` (saqlangan nuqta, faqat egasiga) |
| PATCH | `/me` | `{first_name?, last_name?, region_id?, district_id?}`. Tuman tanlangan viloyatga tegishli bo‘lishi kerak |
| PUT | `/me/location` | `{lat, lng}` — brauzer geolokatsiyasi yoki xaritadan tanlangan nuqta. O‘zbekiston chegarasidan tashqarida bo‘lsa `location_outside`. ~100 m gacha yaxlitlanadi. Profilda viloyat bo‘lmasa, eng yaqin tuman bo‘yicha to‘ldiriladi. Javob: `Me` (`has_location: true`) |
| DELETE | `/me/location` | Joylashuvni o‘chirish; masofa yana tuman markazidan hisoblanadi |

Xato kodlari:
- `invalid_phone` (400);
- `rate_limited` (429);
- `login_unavailable` (503, bot sozlanmagan);
- `login_not_found` (404, noto‘g‘ri id yoki `zd_login` cookie'si yo‘q);
- `user_blocked` (403).

`fail_reason` qiymatlari: `foreign_contact`, `phone_mismatch`, `account_conflict`. `message` maydonida foydalanuvchi uchun matn keladi.

## Ma'lumotnomalar (ochiq, keshlanadi)

`GET /reference/regions` — viloyatlar va ularning tumanlari.
`GET /reference/taxonomy` — `{directions, animal_types[{id, name, direction_ids, classes, breeds}]}`.
`GET /config` — mijozga kerakli platforma chegaralari: `{commission_rate_bp, cashback_pct, min_duration_min, max_duration_min, max_schedule_ahead_days, photos_min, photos_max, videos_min, videos_max, video_max_s, min_bid_pct, max_bid_pct, topup_min, topup_max}`. Qiymatlar `PlatformSettings` dan olinadi, panelda o‘zgartiriladi.

## Auksionlar

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/auctions` | Feed va qidiruv (quyida) |
| GET | `/auctions/{id}` | Tafsilot |
| POST | `/auctions` | Qoralama yaratish |
| PATCH | `/auctions/{id}` | Faqat `draft` yoki `rejected` holatida. Ixtiyoriy `lat`, `lng` — xaritadagi nuqta (BR-11a), ikkalasi birga yuboriladi; ikkalasi `null` bo‘lsa nuqta o‘chadi. `district_id` yuborilmasa, tuman nuqtaga eng yaqin tuman markazi bo‘yicha tanlanadi. Xatolar: `location_outside`, `invalid_location` (400) |
| POST | `/auctions/{id}/submit` | Tekshiruvlar sinxron bajariladi → `200 {outcome: published\|pending_review\|rejected, checks: [{check_name, result, message}], auction}` |
| POST | `/auctions/{id}/cancel` | `{reason?}` — BR-18 |
| GET | `/auctions/{id}/checks` | Oxirgi tekshiruv natijalari, foydalanuvchiga tushunarli matn bilan |
| POST/DELETE | `/auctions/{id}/watch` | Saqlanganlarga qo‘shish yoki olib tashlash |
| GET | `/me/auctions?status=` | Mening auksionlarim |
| GET | `/me/watchlist` | |

**`GET /auctions` parametrlari:** `status=live|scheduled` (standart: ikkalasi), `direction`, `animal_type`, `animal_class`, `breed`, `region`, `district`, `price_min`, `price_max`, `q` (sarlavha va tavsif bo‘yicha), `sort=nearest|ending_soon|most_active|newest|price_asc|price_desc`.
- `sort=nearest` uchun `lat`/`lng` parametrlari yoki foydalanuvchi profilidagi tuman kerak. Ikkalasi ham bo‘lmasa, `400 location_required` qaytadi.
- `most_active` — oxirgi 60 daqiqadagi takliflar soni bo‘yicha, keyin `bidders_count` bo‘yicha.

**Auksion obyekti (ro‘yxat):** `preview_video` — birinchi tayyor video yoki `null`; kartochka unga sichqoncha olib borilganda yoki fokusda ovozsiz o‘ynatadi.
```json
{
  "id": "…", "title": "Qoramol · Buqa · Semental · 3 yosh", "status": "live",
  "cover": {"url": "https://…/photo.webp", "thumb_url": "https://…/thumb.webp"},
  "preview_video": {"url": "https://…/video.mp4", "poster_url": "https://…/poster.webp"},
  "asking_price": 25000000, "top_bid_amount": 23500000, "bidders_count": 7,
  "starts_at": "…", "ends_at": "…",
  "region": {"id": 10, "name": "Toshkent viloyati"}, "district": {"id": 1003, "name": "Yangiyoʻl tumani"},
  "distance_km": 14.2,
  "animal_type": {"id": 1, "name": "Qoramol"}, "animal_class": {"id": 6, "name": "Buqa"},
  "is_watched": false
}
```
Tafsilotda bunga qo‘shimcha ravishda `media[]`, `description`, `breed`, `age_months`, `weight_kg`, `weight_is_estimated`, `min_bid`, `max_bid`, `seller: {id, display_name, rating_avg, rating_count, deals_count, member_since}` keladi. Sotuvchi telefoni **kelmaydi**. `area: {lat, lng, radius_m} | null` — belgilangan nuqtaning taxminiy hududi (BR-33a); nuqta belgilanmagan bo‘lsa `null`. Aniq koordinata hech qachon kelmaydi. Agar so‘rovchi auksion egasi bo‘lsa, `owner: {hold_amount, decision_deadline, can_cancel, pin: {lat, lng} | null}` ham qo‘shiladi.

`display_name` qisqartirilgan shaklda beriladi ("Sherzod A."). Familiya to‘liq ko‘rsatilmaydi.

## Media

| Metod | Yo‘l | Tavsif |
|---|---|---|
| POST | `/media/capture-sessions` | `{auction_id}` → `{id, expires_at, constraints: {photos_min, photos_max, videos_min, videos_max, video_max_s, min_short_side}}` |
| POST | `/auctions/{id}/media` | `multipart`: `file`, `kind`, `capture_session_id`, `client_meta` (JSON) → `201 {id, status: "processing"}` |
| GET | `/auctions/{id}/media` | Ro‘yxat va har birining holati |
| PUT | `/auctions/{id}/media/order` | `{ids: [...]}` — auksionning barcha media id'lari yangi tartibda (BR-12a). Faqat egasi, `draft`/`rejected` holatida. Ro‘yxat to‘liq bo‘lmasa, ortiqcha yoki takroriy id bo‘lsa — `invalid_order` (400). Javob: auksion tafsiloti |
| DELETE | `/auctions/{id}/media/{media_id}` | Faqat `draft`/`rejected` holatida |

Xato kodlari: `capture_session_expired` (400), `unsupported_media` (400), `too_many_media` (400), `not_editable` (409), `file_too_large` (413), `storage_unavailable` (503 — fayl ombori (Nhost) faylni qabul qilmadi; foydalanuvchining fayli aybdor emas, Render loglarida `could not store upload`). Video uzunligi va formati fon jarayonida tekshiriladi: xato boʻlsa, media `failed` holatiga oʻtadi va `error` da sababi yoziladi.

## Takliflar

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/auctions/{id}/bids` | Faol takliflar ro‘yxati (ommaviy) |
| POST | `/auctions/{id}/bids` | `{amount}` → `201` |
| GET | `/me/bids?state=active\|won\|lost` | |

**Ommaviy taklif:**
```json
{ "rank": 1, "tier": "green", "pseudonym": "Xaridor #4", "amount": 23500000, "created_at": "…", "is_mine": false }
```
`tier` qiymati: `rank=1` → `green`, `2–3` → `yellow`, `≥4` → `red`. Uni server hisoblaydi.

Xato kodlari: `auction_not_live` (409), `bid_too_low`, `bid_too_high`, `own_auction`, `rate_limited` (429), `user_blocked`.

## Yakun va bitim (sotuvchi)

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/auctions/{id}/decision` | Faqat egasiga, `ended` yoki `live` holatida. `{deadline, can_accept_now, early_accept_from, recommended: [...], bids: [...]}` |
| POST | `/auctions/{id}/accept` | `{bid_id}` → `201 {deal}`. `live` holatida faqat `early_accept_from` vaqtidan keyin (BR-35) |
| POST | `/auctions/{id}/reject-all` | `{reason?}` |

`recommended` va `bids` elementlari quyidagicha:
```json
{ "bid_id": "…", "pseudonym": "Xaridor #4", "amount": 23500000, "distance_km": 14.2,
  "rating_avg": 4.6, "rating_count": 9, "deals_count": 11, "tags": ["highest", "nearest"] }
```
`bids` uchun `sort=amount|distance` parametri bor. Xato kodlari: `decision_window_closed`, `early_accept_too_soon`, `bid_not_active`, `insufficient_balance` — oxirgisi qaytmaydi, chunki BR-42 bo‘yicha balans manfiyga tushadi.

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/me/deals` | |
| GET | `/deals/{id}` | Faqat tomonlar uchun: `{price, commission_amount (faqat sotuvchiga), counterparty: {name, phone, telegram_username}, location: {lat, lng} | null, can_rate, can_claim}`. `location` — sotuvchi belgilagan aniq nuqta (BR-33a), belgilanmagan bo‘lsa `null` |
| POST | `/deals/{id}/rating` | `{score: 1..5, comment?}` |
| POST | `/deals/{id}/claims` | `{reason}` — faqat sotuvchi |

## Hamyon va to‘lovlar

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/wallet` | `{main_balance, bonus_balance, bonus_expires_at, held_amount, available, has_debt}` |
| GET | `/wallet/entries` | Operatsiyalar tarixi, eng yangisi birinchi. Cursor sahifalash: `?cursor=&limit=` (standart 20, ko‘pi bilan 50). Har bir element: `{id, bucket, type, title, amount, balance_after, note, created_at}` |
| POST | `/wallet/topups` | `{amount}` (10 000 – 10 000 000) → `{payment_id, redirect_url}` |
| POST | `/wallet/refund-requests` | `{amount, click_reference, reason}` |
| GET | `/wallet/refund-requests` | |

**Click callback'lari** (`/api/payments/click/prepare`, `/api/payments/click/complete`) `application/x-www-form-urlencoded` formatida. Ular Click SHOP API protokoliga mos ishlaydi: imzo `md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id [+ merchant_prepare_id] + amount + action + sign_time)` tekshiriladi, javob Click kutgan `error`/`error_note` formatida qaytadi. Protokolning aniq tafsilotlari shartnoma tuzilgach Click'ning rasmiy hujjati bilan qayta tekshiriladi. `PAYMENTS_PROVIDER=fake` rejimida `redirect_url` to‘lovni darhol tasdiqlaydigan lokal sahifaga olib boradi.

## Bildirishnomalar, shikoyatlar, profillar

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/notifications` | |
| POST | `/notifications/read` | `{ids?}` — `ids` bo‘lmasa, hammasi o‘qilgan deb belgilanadi |
| GET | `/notifications/unread-count` | |
| POST | `/reports` | `{target_type, target_id, reason, comment?}` |
| GET | `/push/public-key` | `{public_key: string | null, app_push: bool}`. `public_key` — Web Push (FR-20) uchun VAPID ochiq kaliti, `null` bo‘lsa brauzer push’i o‘chiq; `app_push` — serverda Firebase kaliti bor (Android ilova push’i, FR-21). Ochiq, sessiyasiz: production sozlamasini tekshirish uchun ham |
| POST | `/me/push-subscriptions` | Shu brauzerning obunasi, `PushSubscription.toJSON()` ko‘rinishida: `{endpoint, keys: {p256dh, auth}}` → `201`. `endpoint` bo‘yicha upsert: brauzer oxirgi kirgan foydalanuvchiga o‘tadi. Foydalanuvchida ko‘pi bilan 10 ta qurilma, eskilari o‘chadi. Xato: `invalid_subscription` (400, `https` bo‘lmagan yoki bo‘sh kalit) |
| DELETE | `/me/push-subscriptions` | `{endpoint}` → `204`. Faqat o‘z obunasi o‘chadi. Frontend uni tizimdan chiqishdan oldin chaqiradi |
| POST | `/me/devices` | Android ilova (FR-21) Firebase tokeni: `{token, platform: "android", app_version?}` → `201`. Token bo‘yicha upsert: ilova oxirgi kirgan foydalanuvchiga o‘tadi. Ilova ichidagi sayt yuboradi. Xato: `invalid_device` (400) |
| DELETE | `/me/devices` | `{token}` → `204`, faqat o‘z tokeni. Chiqishda chaqiriladi |
| POST | `/bug-reports` | "Xatolik haqida xabar berish" (FR-19). Ochiq; kirgan foydalanuvchi bogʻlanadi (sessiya bilan, CSRF kerak). `{message, contact?, page_url?, viewport?, error?}` → `201 {id}`. `contact` faqat mehmondan saqlanadi. Kontekst maydonlari rad etilmaydi, kesiladi. Brauzer nomi `User-Agent` sarlavhasidan olinadi. Xatolar: `message_too_short` (10 belgidan kam), `message_too_long` (2000 dan ortiq), `rate_limited` (429: bitta foydalanuvchi yoki IP'dan soatiga 5 ta) |
| POST | `/leads` | Landing aloqa formasi (FR-18). Ochiq, sessiyasiz va CSRF'siz. `{name, phone, role: seller|buyer|both, region?, message?, utm?}` → `201 {id}`. Xatolar: `invalid_name`, `invalid_phone`, `invalid_role`, `invalid_region`, `message_too_long`, `rate_limited` (429: bitta raqamdan sutkasiga 3 ta, bitta IP'dan soatiga 10 ta) |
| GET | `/users/{id}` | Ommaviy profil: `display_name`, viloyat, reyting, bitimlar soni, so‘nggi baholar |

## SEO (`/api/seo`, JSON emas)

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/api/seo/sitemap.xml` | `web.zotdor.uz/sitemap.xml` shu yerga proxy qilinadi. Bazadan har so‘rovda tuziladi: `/`, `/search`, ochiq auksionlar va oxirgi 30 kunda tugaganlar. 10 daqiqa kesh |
| GET | `/api/seo/a/{id}` | Faqat havola ko‘rinishi botlari uchun (Telegram, Facebook…) Open Graph teglari bilan HTML. Ochiq bo‘lmagan auksionga 404 |
| GET | `/robots.txt` | API hosti indekslanmaydi: `Disallow: /` |

Batafsil: [SEO.md](SEO.md).

## Telegram

`POST /api/telegram/webhook/{TELEGRAM_WEBHOOK_SECRET}` — faqat Telegram uchun. `X-Telegram-Bot-Api-Secret-Token` sarlavhasi tekshiriladi.

## Panel (`/api/panel`, rol: moderator yoki admin)

| Yo‘l | Amallar | Rol |
|---|---|---|
| `/auctions?status=pending_review` | ro‘yxat, tafsilot va tekshiruv natijalari | mod |
| `/auctions/{id}/approve`, `/reject`, `/block` | `{reason}` | mod |
| `/reports`, `/reports/{id}/resolve` | | mod |
| `/claims`, `/claims/{id}/approve`, `/reject` | `{note}` | mod |
| `/refund-requests`, `/{id}/done`, `/reject` | `{note}` | mod |
| `/bug-reports?status=new|resolved|closed|all`, `/bug-reports/{id}/status` | `{status: resolved|closed, note?}`, auditga yoziladi (`bug_report.resolved`). Xabar egasi tizimga kirgan bo‘lsa, unga `bug_report_resolved`/`bug_report_closed` bildirishnomasi va Telegram xabari boradi; `note` unda "Javob" sifatida ko‘rinadi. `/stats` dagi `queues.bug_reports` — yangi xabarlar soni | mod |
| `/leads?status=new|contacted|closed|all`, `/leads/{id}/status` | `{status: contacted|closed, note?}`, auditga yoziladi | mod |
| `/users`, `/users/{id}`, `/users/{id}/block`, `/unblock` | | mod |
| `/users/{id}/wallet/adjust` | `{bucket, amount, note}` | admin |
| `/users/{id}/role` | `{role}` | admin |
| `/settings` | GET, PATCH | admin |
| `/taxonomy/*`, `/regions/*` | CRUD | admin |
| `/audit-log` | | admin |
| `/stats` | `{auctions_by_status, queues: {pending_review, reports, claims, refunds, leads}, deals_7d, commission_7d, new_users_7d}` | mod |

Panelda bajarilgan har bir mutatsiya `staff_audit_log` jadvaliga yoziladi.
