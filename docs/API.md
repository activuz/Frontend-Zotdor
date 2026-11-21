# API — Zotdor.uz

Asosiy manzil: `https://api.zotdor.uz/api/v1`. Panel endpointlari `/api/panel` ostida joylashgan. To‘liq va har doim aniq sxema `GET /api/schema/` (OpenAPI 3.1, drf-spectacular) orqali olinadi. Bu hujjat kontraktning qisqa ko‘rinishi va qoidalari. Endpoint o‘zgarsa, shu fayl o‘sha PR ichida yangilanadi.

## Umumiy qoidalar

**Autentifikatsiya.** Django sessiya cookie'si (`sessionid`) ishlatiladi. Har bir so‘rov `credentials: 'include'` bilan yuboriladi. `GET` bo‘lmagan har bir so‘rovda `X-CSRFToken` sarlavhasi bo‘lishi kerak. Token `csrftoken` cookie'sida keladi va uni `GET /auth/csrf` o‘rnatadi.

**Format.** JSON, `snake_case`. Vaqt ISO 8601, UTC (`2026-11-20T09:30:00Z`). Pul butun so‘mda (`25000000`).

**Xato formati** (har doim bir xil):
```json
{ "error": { "code": "bid_too_low", "message": "Taklif kamida 12 500 000 so‘m bo‘lishi kerak", "fields": { "amount": ["..."] } } }
```
`message` foydalanuvchiga ko‘rsatishga tayyor o‘zbekcha matn. `code` esa frontend logikasi uchun.

**Statuslar:** `400` validatsiya, `401` kirilmagan, `403` ruxsat yo‘q yoki foydalanuvchi bloklangan, `404`, `409` holat ziddiyati (masalan, auksion allaqachon tugagan), `429` rate limit (`Retry-After` sarlavhasi bilan).

**Sahifalash:** cursor asosida. So‘rov `?cursor=…&limit=20` (ko‘pi bilan 50). Javob shakli `{ "results": [...], "next": "<cursor>|null" }`.

## Auth

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/auth/csrf` | CSRF cookie'ni o‘rnatadi |
| POST | `/auth/telegram/start` | `{phone}` → `201 {request_id, deep_link, expires_at}` va `zd_login` cookie'si |
| GET | `/auth/telegram/status/{request_id}` | `zd_login` cookie talab qilinadi. Javob: `{status: pending\|verified\|failed\|expired, fail_reason?, message?, user?}`. `verified` bo‘lsa sessiya ochiladi va `user` qaytadi. So‘rov bir martalik |
| POST | `/auth/logout` | `204` |
| GET | `/me` | joriy foydalanuvchi va `needs_profile: bool` (ism, viloyat yoki tuman bo‘lmasa `true`) |
| PATCH | `/me` | `{first_name?, last_name?, region_id?, district_id?}`. Tuman tanlangan viloyatga tegishli bo‘lishi kerak |

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

## Auksionlar

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/auctions` | Feed va qidiruv (quyida) |
| GET | `/auctions/{id}` | Tafsilot |
| POST | `/auctions` | Qoralama yaratish |
| PATCH | `/auctions/{id}` | Faqat `draft` yoki `rejected` holatida |
| POST | `/auctions/{id}/submit` | Tekshiruvga yuborish → `202 {status: "checking"}` |
| POST | `/auctions/{id}/cancel` | `{reason?}` — BR-18 |
| GET | `/auctions/{id}/checks` | Oxirgi tekshiruv natijalari, foydalanuvchiga tushunarli matn bilan |
| POST/DELETE | `/auctions/{id}/watch` | Saqlanganlarga qo‘shish yoki olib tashlash |
| GET | `/me/auctions?status=` | Mening auksionlarim |
| GET | `/me/watchlist` | |

**`GET /auctions` parametrlari:** `status=live|scheduled` (standart: ikkalasi), `direction`, `animal_type`, `animal_class`, `breed`, `region`, `district`, `price_min`, `price_max`, `q` (sarlavha va tavsif bo‘yicha), `sort=nearest|ending_soon|most_active|newest|price_asc|price_desc`.
- `sort=nearest` uchun `lat`/`lng` parametrlari yoki foydalanuvchi profilidagi tuman kerak. Ikkalasi ham bo‘lmasa, `400 location_required` qaytadi.
- `most_active` — oxirgi 60 daqiqadagi takliflar soni bo‘yicha, keyin `bidders_count` bo‘yicha.

**Auksion obyekti (ro‘yxat):**
```json
{
  "id": "…", "title": "Qoramol · Buqa · Semental · 3 yosh", "status": "live",
  "cover": {"thumb": "https://…/thumb.webp", "w": 480, "h": 360},
  "asking_price": 25000000, "top_bid_amount": 23500000, "bidders_count": 7,
  "starts_at": "…", "ends_at": "…",
  "region": {"id": 10, "name": "Toshkent viloyati"}, "district": {"id": 1003, "name": "Yangiyoʻl tumani"},
  "distance_km": 14.2,
  "animal_type": {"id": 1, "name": "Qoramol"}, "animal_class": {"id": 6, "name": "Buqa"},
  "is_watched": false
}
```
Tafsilotda bunga qo‘shimcha ravishda `media[]`, `description`, `breed`, `age_months`, `weight_kg`, `weight_is_estimated`, `min_bid`, `max_bid`, `seller: {id, display_name, rating_avg, rating_count, deals_count, member_since}` keladi. Sotuvchi telefoni **kelmaydi**. Agar so‘rovchi auksion egasi bo‘lsa, `owner: {hold_amount, decision_deadline, can_cancel}` ham qo‘shiladi.

`display_name` qisqartirilgan shaklda beriladi ("Sherzod A."). Familiya to‘liq ko‘rsatilmaydi.

## Media

| Metod | Yo‘l | Tavsif |
|---|---|---|
| POST | `/media/capture-sessions` | `{auction_id}` → `{id, expires_at, constraints: {photos_min, photos_max, videos_min, videos_max, video_max_s, min_short_side}}` |
| POST | `/auctions/{id}/media` | `multipart`: `file`, `kind`, `capture_session_id`, `client_meta` (JSON) → `201 {id, status: "processing"}` |
| GET | `/auctions/{id}/media` | Ro‘yxat va har birining holati |
| PATCH | `/auctions/{id}/media/order` | `{ids: [...]}` |
| DELETE | `/auctions/{id}/media/{media_id}` | Faqat `draft`/`rejected` holatida |

Xato kodlari: `capture_session_expired`, `unsupported_media`, `file_too_large`, `too_many_photos`, `video_too_long`.

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
| GET | `/deals/{id}` | Faqat tomonlar uchun: `{price, commission_amount (faqat sotuvchiga), counterparty: {name, phone, telegram_username}, can_rate, can_claim}` |
| POST | `/deals/{id}/rating` | `{score: 1..5, comment?}` |
| POST | `/deals/{id}/claims` | `{reason}` — faqat sotuvchi |

## Hamyon va to‘lovlar

| Metod | Yo‘l | Tavsif |
|---|---|---|
| GET | `/wallet` | `{main_balance, bonus_balance, bonus_expires_at, held_amount, available}` |
| GET | `/wallet/entries` | Operatsiyalar tarixi, foydalanuvchiga tushunarli `title` bilan |
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
| GET | `/users/{id}` | Ommaviy profil: `display_name`, viloyat, reyting, bitimlar soni, so‘nggi baholar |

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
| `/users`, `/users/{id}`, `/users/{id}/block`, `/unblock` | | mod |
| `/users/{id}/wallet/adjust` | `{bucket, amount, note}` | admin |
| `/users/{id}/role` | `{role}` | admin |
| `/settings` | GET, PATCH | admin |
| `/taxonomy/*`, `/regions/*` | CRUD | admin |
| `/audit-log` | | admin |
| `/stats` | `{auctions_by_status, deals_7d, commission_7d, new_users_7d}` | mod |

Panelda bajarilgan har bir mutatsiya `staff_audit_log` jadvaliga yoziladi.
