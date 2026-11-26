# Ma'lumotlar bazasi — Zotdor.uz

PostgreSQL 17+. Migratsiyalar Django orqali boshqariladi. Bu hujjat maqsadli sxemani tasvirlaydi. Kod va hujjat o‘rtasida farq paydo bo‘lsa, manba — migratsiya. Lekin bu hujjat **o‘sha PR ichida** yangilanishi shart.

## Umumiy qoidalar

- Tashqariga ko‘rsatiladigan obyektlarning PK'si `uuid` (v4). Ma'lumotnoma jadvallarida (`reference_*`) `smallint`/`int` ishlatiladi.
- Pul: `bigint`, butun so‘m.
- Vaqt: `timestamptz`, UTC.
- Holatlar `varchar` + `CHECK` constraint orqali saqlanadi, Postgres enum ishlatilmaydi. Sabab: Django'da migratsiyasi oson.
- Moliya va audit jadvallarida qatorlar o‘chirilmaydi. Foydalanuvchiga ko‘rinadigan obyektlar ham fizik o‘chirilmaydi, ular holat orqali boshqariladi.
- Denormal hisoblagichlar, masalan `auctions.top_bid_amount`, faqat service funksiyalar ichida, asosiy yozuv bilan bitta tranzaksiyada yangilanadi.

## ER ko‘rinishi

```
users 1─1 wallets 1─* wallet_entries          users 1─* login_requests
users 1─* auctions 1─* auction_media          capture_sessions *─1 auctions
           auctions 1─* bids *─1 users         auctions 1─* auction_bidders
           auctions 1─* auction_checks         auctions 1─* auction_events
           auctions 1─0..1 deals 1─* ratings   deals 1─* deal_claims
           auctions 1─0..1 holds               users 1─* payments, refund_requests
reference: regions 1─* districts; directions *─* animal_types 1─* animal_classes, breeds
users 1─* notifications, telegram_outbox, watchlist, reports;  staff_audit_log
```

## Jadvallar

### accounts

**users**
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| phone | varchar(13) UNIQUE | E.164, `+998XXXXXXXXX` |
| telegram_user_id | bigint UNIQUE | |
| telegram_username | varchar(64) NULL | |
| first_name, last_name | varchar(64) | Telegram'dan olinadi, profilda tahrirlanadi |
| role | varchar(16) | `user` \| `moderator` \| `admin` |
| region_id, district_id | FK NULL | birinchi kirishdan keyin to‘ldirish so‘raladi |
| lat, lng | numeric(7,4) NULL | Brauzer geolokatsiyasi (`PUT /me/location`), 3 xonagacha (~100 m) yaxlitlanadi. Ixtiyoriy, faqat masofa va "yaqin" saralash uchun; hech kimga ko‘rsatilmaydi. Bo‘lmasa tuman markazi ishlatiladi |
| is_blocked | bool | |
| blocked_reason | text NULL | |
| rating_avg | numeric(3,2) NULL | denormal |
| rating_count, deals_count | int default 0 | denormal |
| created_at, last_seen_at | timestamptz | |

**login_requests**
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| phone | varchar(13) | |
| token_hash | char(64) UNIQUE | sha256 |
| poll_secret_hash | char(64) | |
| status | varchar(16) | `pending` \| `verified` \| `failed` \| `consumed`. Muddati o‘tgani `expires_at` orqali aniqlanadi va alohida holat sifatida saqlanmaydi |
| telegram_user_id | bigint NULL | `/start` bosilganda bog‘lanadi |
| telegram_username, telegram_first_name, telegram_last_name | varchar(64) | kontakt tasdiqlanganda yoziladi va yangi foydalanuvchiga ko‘chiriladi |
| fail_reason | varchar(32) | `foreign_contact`, `phone_mismatch`, `account_conflict` |
| expires_at, verified_at, created_at | timestamptz | |
| ip | inet NULL | rate limit uchun |

Rate limit alohida kesh bilan emas, shu jadvaldagi so‘nggi bir soatlik qatorlarni sanash orqali ishlaydi: bir raqamga soatiga 5 ta, bir IP'ga soatiga 20 ta urinish.

### reference
- **regions** (id, name UNIQUE, sort, osm_id UNIQUE NULL)
- **districts** (id, region_id, name, lat, lng, osm_id UNIQUE NULL). UNIQUE (region_id, name). Koordinatalar tuman markazi bo‘lib, OpenStreetMap'dan import qilingan. Manba va qo‘lda kiritilgan tuzatishlar `backend/reference/data/README.md` da qayd etilgan. Ma'lumot `manage.py load_reference` buyrug‘i bilan yuklanadi. U idempotent ishlaydi va xodimlar kiritgan o‘zgarishlarni o‘chirmaydi.
- **directions** (id, slug, name, sort, is_active)
- **animal_types** (id, slug, name, sort, is_active)
- **animal_type_directions** (animal_type_id, direction_id) PK juft
- **animal_classes** (id, animal_type_id, name, sex `male|female|any`, age_hint, sort, is_active). UNIQUE (animal_type_id, name). `age_hint` formada ko‘rsatiladigan maslahat, masalan "0–12 oy". Masalan, qoramol uchun: buzoq, tana, gʻunajin, sigir, ho‘kiz, buqa
- **breeds** (id, animal_type_id, name, is_active)

Boshlang‘ich qiymatlar fixture sifatida beriladi. **Mahsulot egasi tasdiqlamaguncha ular qoralama hisoblanadi.**

### auctions

**auctions**
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| seller_id | FK users | |
| status | varchar(16) | `draft`, `checking`, `pending_review`, `rejected`, `scheduled`, `live`, `ended`, `sold`, `unsold`, `cancelled`, `blocked` |
| title | varchar(160) | avtomatik tuziladi |
| direction_id, animal_type_id, animal_class_id | FK | |
| breed_id | FK NULL | |
| breed_other | varchar(64) NULL | ro‘yxatda bo‘lmagan zot |
| age_months | smallint | `CHECK 0..480` |
| weight_kg | int NULL | |
| weight_is_estimated | bool | |
| description | text | ≤ 2000 belgi |
| asking_price | bigint | `CHECK > 0` |
| min_bid, max_bid | bigint | e'lon qilish paytida sozlamadan hisoblanadi |
| commission_rate_bp | smallint | basis point; 20 = 0.2% |
| region_id, district_id | FK | |
| lat, lng | numeric(7,4) NULL | `location_pinned = false` bo‘lsa tuman markazi, aks holda sotuvchining nuqtasi (~100 m gacha yaxlitlangan) |
| location_pinned | boolean | default `false`. Sotuvchi xaritada belgilagan (BR-11a). Ommaga faqat taxminiy hudud ko‘rsatiladi (BR-33a) |
| starts_at, ends_at | timestamptz NULL | `CHECK ends_at - starts_at BETWEEN 10 min AND 12 h` |
| decision_deadline | timestamptz NULL | `ends_at + 48h` |
| published_at, ended_at, closed_at | timestamptz NULL | |
| accepted_bid_id | FK bids NULL | |
| top_bid_amount | bigint NULL | denormal |
| active_bids_count, bidders_count | int default 0 | denormal |
| rejection_reason, moderation_note, cancel_reason | text NULL | |
| created_at, updated_at | timestamptz | |

Indekslar: `(status, ends_at)`, `(status, starts_at)`, `(district_id) WHERE status IN ('scheduled','live')`, `(animal_type_id, status)`, `(seller_id, status)`.

**auction_events** (id, auction_id, from_status, to_status, actor_id NULL, reason, created_at) — holat o‘tishlari tarixi.

**auction_bidders** (auction_id, user_id, pseudonym_no, first_bid_at). PK `(auction_id, user_id)`, UNIQUE `(auction_id, pseudonym_no)`. "Xaridor #N" taxallusini barqaror saqlaydi.

**bids**
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| auction_id | FK | |
| bidder_id | FK users | |
| amount | bigint | |
| status | varchar(16) | `active` \| `superseded` \| `void` (auksion bloklanganda) |
| created_at | timestamptz | |

Indekslar: partial UNIQUE `(auction_id, bidder_id) WHERE status='active'` — har bir xaridorda bitta faol taklif bo‘ladi. Saralash uchun `(auction_id, status, amount DESC, created_at)`.

**watchlist** (user_id, auction_id, created_at). PK juft.

### media (`auctions` app ichida)
Alohida `media` app yaratilmadi: nom `MEDIA_ROOT`/`MEDIA_URL` bilan to‘qnashadi va media auksionsiz yashamaydi. Modellar `auctions/models.py` da, qayta ishlash `auctions/media.py` da, saqlash `auctions/storage.py` da.

`original_path`, `file_path`, `thumb_path` — saqlash havolasi: `local` rejimda `MEDIA_ROOT` ga nisbatan yo‘l (`auctions/<auction_id>/<nom>`), `nhost` rejimda `nhost:<file_id>`. Havola o‘z backend'ini bildiradi, shuning uchun backend almashtirilganda eski qatorlar ham to‘g‘ri URL beradi.

**capture_sessions** (id, user_id, auction_id, expires_at, user_agent, created_at)

**auction_media**
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| auction_id | FK | |
| capture_session_id | FK | |
| kind | varchar(8) | `photo` \| `video` |
| position | smallint | galereya tartibi, `PUT /auctions/{id}/media/order` bilan o‘zgaradi (BR-12a). Birinchi tayyor rasm muqova |
| status | varchar(12) | `processing` \| `ready` \| `failed` |
| error | varchar(200) | `failed` bo‘lsa foydalanuvchiga ko‘rinadigan sabab |
| original_path | varchar | qayta ishlanganidan keyin 30 kun saqlanadi |
| file_path, thumb_path | varchar | bo‘sh satr = hali yo‘q. Video uchun `thumb_path` — poster kadr |
| width, height | int NULL | |
| duration_ms | int NULL | |
| size_bytes | int | |
| phash | bigint NULL | indekslangan |
| received_at | timestamptz | server vaqti |
| client_meta | jsonb | qurilma, kamera sozlamalari (faqat diagnostika uchun) |

**auction_checks** (id, auction_id, run_id, check_name, result `pass|warn|fail`, message — foydalanuvchiga ko‘rinadigan matn, details jsonb, created_at). Tekshiruvlar: `text_contacts`, `text_profanity`, `media_count`, `media_freshness`, `media_quality`, `media_duplicate`.

### deals
**deals**
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| auction_id | FK UNIQUE | |
| bid_id | FK UNIQUE | |
| seller_id, buyer_id | FK users | |
| price | bigint | qabul qilingan taklif |
| commission_amount | bigint | |
| status | varchar(16) | `active` \| `completed` \| `failed` (ariza tasdiqlangan) |
| created_at, completed_at | timestamptz | `completed`: 7 kun ichida ariza bo‘lmasa |

**ratings** (id, deal_id, author_id, target_id, score smallint `CHECK 1..5`, comment text NULL, created_at). UNIQUE `(deal_id, author_id)`.

**deal_claims** (id, deal_id, author_id, reason text, status `open|approved|rejected`, resolved_by_id NULL, resolution_note, created_at, resolved_at)

### wallet
**wallets**
| Ustun | Tur | Izoh |
|---|---|---|
| user_id | uuid PK FK | |
| main_balance | bigint | manfiy bo‘lishi mumkin (BR-42) |
| bonus_balance | bigint | `CHECK >= 0` |
| bonus_expires_at | timestamptz NULL | |
| held_amount | bigint | `CHECK >= 0`, faol rezervlar yig‘indisi |
| updated_at | timestamptz | |

Mavjud balans = `main_balance + bonus_balance - held_amount`.

**wallet_entries** (o‘zgarmas)
| Ustun | Tur | Izoh |
|---|---|---|
| id | bigserial PK | |
| user_id | FK | |
| bucket | varchar(8) | `main` \| `bonus` \| `hold` |
| type | varchar(24) | `topup`, `bonus_grant`, `bonus_expire`, `bonus_cashback`, `bonus_cashback_reversal` (BR-47, `ref_type=deal`), `hold`, `hold_release`, `commission`, `commission_refund`, `refund_payout`, `adjustment` |
| amount | bigint | ishorali |
| balance_after | bigint | shu bucket'ning yangi qoldig‘i |
| ref_type, ref_id | varchar, uuid NULL | `auction`, `deal`, `payment`, `refund_request` |
| actor_id | FK NULL | xodim, agar qo‘lda bajarilgan bo‘lsa |
| note | text NULL | |
| created_at | timestamptz | |

**holds** (id, user_id, ref_type, ref_id, amount, status `active|released|captured`, created_at, closed_at). UNIQUE (ref_type, ref_id), ya'ni bitta obyektga bitta rezerv. Hamyon `auctions` app'iga bog‘liq bo‘lmasligi uchun FK o‘rniga umumiy `ref_type`/`ref_id` havolasi ishlatiladi. Auksion uchun `ref_type="auction"`.

**refund_requests** (id, user_id, amount, click_reference, reason, status `open|done|rejected`, handled_by_id, note, created_at, handled_at)

### payments
**payments**
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | `merchant_trans_id` sifatida Click'ga yuboriladi |
| user_id | FK | |
| provider | varchar(16) | `click` \| `fake` \| `manual` |
| amount | bigint | |
| status | varchar(16) | `created` \| `prepared` \| `completed` \| `cancelled` \| `failed` |
| provider_trans_id | bigint NULL UNIQUE | `click_trans_id` |
| provider_paydoc_id | bigint NULL | |
| raw_prepare, raw_complete | jsonb NULL | |
| created_at, completed_at | timestamptz | |

### notifications
- **notifications** (id, user_id, type, title, body, link, read_at NULL, created_at). Indeks `(user_id, read_at, created_at DESC)`.
- **telegram_outbox** (id, chat_id bigint, text, status `pending|sent|failed`, attempts, next_attempt_at, sent_at, error, created_at).
- **sent_reminders** (id, key UNIQUE, created_at) — vaqtga bog‘liq eslatmalar (tugashiga 10 daqiqa, tanlash muddati, baholash, bonus yonishi) bir martadan ortiq yuborilmasligi uchun. Kalit misoli: `ending:<auction_id>:<user_id>`.

### moderation va core
- **reports** (id, reporter_id, target_type `auction|user`, target_id, reason `fake|wrong_info|abuse|fraud|other`, comment, status `open|resolved|dismissed`, handled_by_id, created_at, handled_at)
- **device_tokens** (id, user_id `ON DELETE CASCADE`, token ≤500 UNIQUE, platform `android`, app_version, failures, created_at, last_used_at) — Android ilova Firebase tokenlari (FR-21). FCM `UNREGISTERED`/404 qaytarsa yoki ketma-ket 10 xatodan keyin o‘chiriladi.
- **push_subscriptions** (id, user_id `ON DELETE CASCADE`, endpoint ≤1000 UNIQUE, p256dh, auth, user_agent, failures, created_at, last_used_at) — Web Push obunalari (FR-20), har bir brauzer yoki o‘rnatilgan ilova bitta qator. Push xizmati 404/410 qaytarsa qator o‘chiriladi, ketma-ket 10 ta xatodan keyin ham.
- **bug_reports** (id, user_id NULL `ON DELETE SET NULL`, message ≤2000, contact (faqat mehmon), page_url ≤500, user_agent ≤300, viewport, error_text ≤2000, ip, status `new|resolved|closed`, handled_by_id, handled_note, created_at, handled_at) — "Xatolik haqida xabar berish" (FR-19). Indekslar: `(status, created_at)`, `(ip, created_at)`.
- **leads** (id, name, phone `+998XXXXXXXXX`, region_id NULL, role `seller|buyer|both`, message, source (utm), ip, status `new|contacted|closed`, handled_by_id, handled_note, created_at, handled_at) — landing aloqa formasi (FR-18). Indekslar: `(status, created_at)`, `(phone, created_at)`, `(ip, created_at)` — cheklov soʻrovlari uchun.
- **platform_settings** — bitta qatorli jadval: `commission_rate_bp=20`, `signup_bonus=50000`, `bonus_ttl_days=90`, `cashback_pct=5` (BR-47), `min_bid_pct=50`, `max_bid_pct=300`, `min_duration_min=10`, `max_duration_min=720`, `max_schedule_ahead_days=7`, `decision_window_h=48`, `early_accept_min_minutes=10`, `claim_window_days=7`, `rating_window_days=14`, `photos_min=4`, `photos_max=10`, `videos_min=1`, `videos_max=2`, `video_max_s=30`. O‘zgarishlar audit jurnaliga yoziladi.
- **staff_audit_log** (id, actor_id, action, target_type, target_id, before jsonb, after jsonb, ip, created_at)

## Demo tiplaridan farqlar

Olib tashlangan demo (`src/types/index.ts`, 2026-11-23 da o‘chirildi) bilan solishtirganda:
- `announcements` va `auctions` birlashtirildi, chunki oddiy e'lonlar bo‘lmaydi.
- `users.balance` o‘rniga `wallets` va `wallet_entries` keldi.
- `blocked_objects` o‘rniga `users.is_blocked` va `auctions.status='blocked'` ishlatiladi.
- `advertisements` va `user_settings` MVP'dan chiqarildi.
- `pinfl`, `vet_passport` va `language` olib tashlandi, chunki ular doiradan tashqarida.
