# Production'ga chiqarish qo‘llanmasi — Vercel + Render + Nhost

Bu qo‘llanma tanlangan production sxemasini qadam-baqadam sozlaydi. Muqobil variant — hammasi bitta VPS'da — [deploy/README.md](../deploy/README.md) da, u ham ishlaydigan holatda saqlangan.

| Qism | Xizmat | Manzil |
|---|---|---|
| Foydalanuvchi sayti (`frontend/`) | Vercel | https://web.zotdor.uz |
| Panel (`panel/`) | Vercel | https://panel.zotdor.uz |
| Landing (`landing/`, Next.js) | Vercel | https://zotdor.uz |
| API, Telegram bot, fon vazifalari (`backend/`) | Render (Docker) | https://api.zotdor.uz |
| PostgreSQL va fayllar (rasm, video) | Nhost, loyiha `ipzsvyjvfumhpjhqwhtt` | `*.nhost.run` |

```
brauzer ──► web.zotdor.uz / panel.zotdor.uz (Vercel, statik)
   │
   ├──► api.zotdor.uz (Render: gunicorn + worker) ──► Nhost Postgres
   │                                    └──────────► Nhost Storage (yozish, admin secret bilan)
   └──► *.storage.*.nhost.run (rasm va videoni to‘g‘ridan-to‘g‘ri o‘qish)
```

**Nima uchun hammasi `zotdor.uz` ostida bo‘lishi shart:** sessiya cookie'si `api.zotdor.uz` da turadi. `web.zotdor.uz` va `api.zotdor.uz` bitta sayt (same-site) hisoblanadi, shuning uchun brauzer cookie'ni yuboradi. `*.vercel.app` yoki `*.onrender.com` manzillarida login **ishlamaydi** — faqat custom domenlar orqali sinang.

Sozlash tartibi: **1. Nhost → 2. Render → 3. Vercel (ikki loyiha) → 4. DNS → 5. Telegram → 6. Click → 7. Birinchi admin → 8. Tekshirish.**

---

## 0. Oldindan tayyorlang

- **Yangi bot tokeni.** Eski token chatda ko‘ringan: @BotFather → `/revoke` → yangi tokenni oling.
- `zotdor.uz` domenining DNS boshqaruviga kirish huquqi.
- GitHub'dagi `activuz/Frontend-Zotdor` repo'si (Render va Vercel shu repo'dan build qiladi). Deploy qilinadigan branch — `main`.

---

## 1. Nhost — baza va fayllar

Nhost loyihasi: subdomen `ipzsvyjvfumhpjhqwhtt`. Dashboard'da **region**ni aniqlang (masalan, `eu-central-1`) — quyidagi manzillarda `<region>` o‘rniga yoziladi.

### 1.1. Reja

Bepul reja faol bo‘lmagan loyihani to‘xtatib qo‘yadi va kunlik zaxira nusxa bermaydi. Production uchun **Pro** reja kerak.

### 1.2. Ma'lumotlar bazasi

1. **Settings → Database**: parolni o‘rnating (yoki mavjudini oling).
2. To‘g‘ridan-to‘g‘ri ulanish manzilini yig‘ing (pooler emas — fon vazifalari `LISTEN/NOTIFY` ishlatadi):

   ```
   postgres://postgres:<PAROL>@ipzsvyjvfumhpjhqwhtt.db.<region>.nhost.run:5432/ipzsvyjvfumhpjhqwhtt?sslmode=require
   ```

   Parolda `@`, `:`, `/` kabi belgilar bo‘lsa, ularni URL-kodlang (`@` → `%40`).
3. Bu satr Render'dagi `DATABASE_URL` bo‘ladi. Jadvallarni Django o‘zi yaratadi (`public` sxemasi). Nhost'ning `auth` va `storage` sxemalariga tegilmaydi.
4. Hasura konsolida (`Data`) Django jadvallarini **track qilmang**: ular GraphQL orqali ochilmasligi kerak.

### 1.3. Storage: bucket'lar

**Database → SQL Editor** da bajaring:

```sql
insert into storage.buckets (id, max_upload_file_size, presigned_urls_enabled, cache_control)
values
  ('media-public',  70000000, false, 'max-age=2592000'),
  ('media-private', 70000000, false, 'no-store')
on conflict (id) do update set max_upload_file_size = excluded.max_upload_file_size;
```

- `media-public` — qayta ishlangan rasm, thumbnail, video va poster (EXIF olib tashlangan). Brauzer ularni to‘g‘ridan-to‘g‘ri o‘qiydi.
- `media-private` — foydalanuvchi yuklagan original fayllar (EXIF/GPS bilan). Ular **hech qachon** ochiq bo‘lmaydi (BR-33).
- Standart bucket chegarasi 50 MB; video 60 MB gacha bo‘lgani uchun 70 MB qo‘yilgan.

### 1.4. Storage: ruxsatlar

Hasura konsoli → **Data → storage → files → Permissions**:

| Rol | select | insert / update / delete |
|---|---|---|
| `public` | **Custom check:** `{"bucket_id":{"_eq":"media-public"}}`, barcha ustunlar | yo‘q |
| `user` | xuddi `public` dek | yo‘q |

Yozish va o‘chirishni faqat backend admin secret bilan bajaradi. Brauzerga hech qanday Nhost kaliti berilmaydi.

### 1.5. Admin secret va Storage URL

- **Settings → Secrets** (yoki Hasura bo‘limi): `NHOST_ADMIN_SECRET` qiymati.
- Storage manzili: `https://ipzsvyjvfumhpjhqwhtt.storage.<region>.nhost.run` → `NHOST_STORAGE_URL`.

Tekshirish (kompyuteringizda):

```sh
curl -s -X POST "$NHOST_STORAGE_URL/v1/files" \
  -H "x-hasura-admin-secret: $NHOST_ADMIN_SECRET" \
  -F "bucket-id=media-public" -F "file[]=@test.jpg"
# javobdagi id bilan:
curl -I "$NHOST_STORAGE_URL/v1/files/<id>"          # admin secret'siz 200 qaytishi kerak (public)
```

`media-private` ga yuklangan fayl admin secret'siz `403` qaytarishi kerak.

---

## 2. Render — API va worker

### 2.1. Blueprint

1. Render → **New → Blueprint** → `activuz/Frontend-Zotdor` repo'si, branch `main`.
2. Render repo ildizidagi [`render.yaml`](../render.yaml) ni o‘qiydi va ikkita servis yaratadi:
   - `zotdor-api` — web (Docker, `backend/Dockerfile`, ffmpeg bilan). Ishga tushganda migratsiyalarni qo‘llaydi (`backend/start.sh`).
   - `zotdor-worker` — fon vazifalari: auksion vaqtlari, Telegram xabarlari, eslatmalar, video qayta ishlash.
3. Render `sync: false` qiymatlarni so‘raydi:

| Kalit | Qiymat |
|---|---|
| `DATABASE_URL` | 1.2-banddagi satr |
| `NHOST_STORAGE_URL` | 1.5-band |
| `NHOST_ADMIN_SECRET` | 1.5-band |
| `TELEGRAM_BOT_TOKEN` | 0-banddagi yangi token |
| `CLICK_*` | shartnoma bo‘lmasa bo‘sh qoldiring — to‘ldirish "To‘lov tizimi hali ulanmagan" deydi |

`DJANGO_SECRET_KEY` va `TELEGRAM_WEBHOOK_SECRET` ni Render o‘zi yaratadi. Qolganlari `render.yaml` da yozilgan: `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `CSRF_COOKIE_DOMAIN=.zotdor.uz`, `FRONTEND_URL`, `STORAGE_BACKEND=nhost`.

### 2.2. Reja va narx

- **Free** reja ishlamaydi: servis 15 daqiqa so‘rovsiz turgach uxlaydi (auksionlar vaqtida tugamaydi), worker esa bepul rejada umuman yo‘q.
- Tavsiya: ikkala servis ham **Starter**.
- Tejash varianti: `zotdor-worker` ni o‘chiring va `zotdor-api` da `RUN_WORKER_IN_WEB=true` qiling. Shunda worker web konteyner ichida ishlaydi. Kamchiligi: worker yiqilsa, faqat servis qayta ishga tushganda tiklanadi. Yuklama oshganda alohida worker'ga qayting.
- Region: `frankfurt` (O‘zbekistonga eng yaqin). Nhost region'i ham shunga yaqin bo‘lgani ma'qul.

### 2.3. Domen

`zotdor-api` → **Settings → Custom Domains** → `api.zotdor.uz`. Render ko‘rsatgan CNAME'ni 4-bandda DNS'ga qo‘shing. Sertifikatni Render o‘zi oladi.

### 2.4. Birinchi ishga tushirishdan keyin

`zotdor-api` → **Shell**:

```sh
python manage.py load_reference                       # viloyat, tuman, toifalar — FAQAT birinchi marta
python manage.py telegram_set_webhook https://api.zotdor.uz
python -c "import urllib.request,os; print(urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health').read())"
# → {"status":"ok","db":"ok","worker":"ok"}
```

`worker` holati `unknown` yoki `stale` bo‘lsa, worker ishlamayapti — `zotdor-worker` loglarini tekshiring.

Django admin (`/django-admin/`) faqat favqulodda holatlar uchun va Render'da stilsiz ochiladi. Odatiy ishlar panelda qilinadi.

---

## 3. Vercel — sayt va panel

Ikkita alohida loyiha, ikkalasi ham shu repo'dan:

| Sozlama | Sayt | Panel |
|---|---|---|
| Root Directory | `frontend` | `panel` |
| Framework | Vite (avtomatik) | Vite |
| Build command | `npm run build` | `npm run build` |
| Output | `dist` | `dist` |
| Env: `VITE_API_URL` | `https://api.zotdor.uz` | `https://api.zotdor.uz` |
| Domen | `web.zotdor.uz` | `panel.zotdor.uz` |

- `VITE_API_URL` build vaqtida kodga yoziladi: uni o‘zgartirsangiz, **Redeploy** qiling.
- SPA marshrutlari va xavfsizlik sarlavhalari (CSP, HSTS, kamera ruxsati faqat saytda) `frontend/vercel.json` va `panel/vercel.json` da.
- CSP'da `https://api.zotdor.uz` va `https://*.nhost.run` ruxsat etilgan. API domeni o‘zgarsa, ikkala `vercel.json` ni ham yangilang.
- Preview deploy'lar (`*.vercel.app`) sahifani ko‘rsatadi, lekin ularda login ishlamaydi (cookie boshqa saytga tegishli bo‘lib qoladi).

### Landing (`landing/`)

Uchinchi Vercel loyihasi: **Root Directory = `landing`**, Framework — Next.js (avtomatik), domen `zotdor.uz` (va `www.zotdor.uz` → `zotdor.uz` yoʻnaltirish).

| Env | Qiymat |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.zotdor.uz` |
| `NEXT_PUBLIC_SITE_URL` | `https://web.zotdor.uz` |
| `NEXT_PUBLIC_LANDING_URL` | `https://zotdor.uz` |

- Sahifa API'dan `/config`, `/reference/regions` va ochiq auksionlarni oladi va ularni har 60 soniyada yangilaydi (ISR). API ishlamay qolsa, boʻlimlar xato holatini koʻrsatadi, sahifa esa ochilaveradi.
- Aloqa formasi brauzerdan `POST https://api.zotdor.uz/api/v1/leads` ga yuboriladi. Shuning uchun Render'dagi `CORS_ALLOWED_ORIGINS` ga `https://zotdor.uz,https://www.zotdor.uz` qoʻshilishi shart (`render.yaml` da bor, dashboard'da ham tekshiring).
- Arizalarning Telegram nusxasi uchun Render'da `LEADS_TELEGRAM_CHAT_ID` ni toʻldiring: xodimlar guruhi yoki shaxsiy chat id. Bot (`ZotdorPlatformBot`) oʻsha chatga qoʻshilgan boʻlishi kerak. Boʻsh boʻlsa, arizalar faqat panelda koʻrinadi.
- Push sozlamasini tekshirish: `https://api.zotdor.uz/api/v1/push/public-key` → `public_key` qiymat bo‘lishi (VAPID kalitlari kiritilgan) va `app_push: true` (Firebase kaliti kiritilgan) kerak. Yuborishni worker bajaradi: `zotdor-worker` ishlab turgan bo‘lishi shart.
- Android ilova push’i (FR-21): Firebase loyihasining service account JSON’ini **bitta qiymat** sifatida Render’dagi `zotdor-backend` guruhiga `FIREBASE_SERVICE_ACCOUNT_JSON` nomi bilan kiriting (API va worker). Bu maxfiy kalit: Vercel (frontend) env’iga va repo’ga qo‘yilmaydi. Ilovadagi `google-services.json` shu loyihadan bo‘lishi kerak. Batafsil: [ANDROID.md](ANDROID.md).
- Brauzer push bildirishnomalari (FR-20): bir marta `python manage.py generate_vapid_keys` ni ishga tushiring va chiqqan `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ni Render’dagi `zotdor-backend` guruhiga kiriting (API va worker ikkalasiga ham kerak). Ixtiyoriy: `VAPID_SUBJECT` (standart `https://web.zotdor.uz`). Kalitlar bo‘sh bo‘lsa, push o‘chiq va tugma ko‘rinmaydi. Maxfiy kalitni almashtirish barcha obunalarni bekor qiladi.
- Xatolik xabarlari (FR-19) uchun alohida chat kerak boʻlsa, `SUPPORT_TELEGRAM_CHAT_ID` ni toʻldiring. Boʻsh boʻlsa, ular `LEADS_TELEGRAM_CHAT_ID` chatiga boradi.

---

Sayt ishga tushgach, qidiruv tizimlariga qo‘shish: [SEO.md](SEO.md), 3-bo‘lim.

---

## 4. DNS (`zotdor.uz` zonasi)

| Yozuv | Tur | Qiymat |
|---|---|---|
| `web` | CNAME | Vercel ko‘rsatgan qiymat (odatda `cname.vercel-dns.com`) |
| `panel` | CNAME | Vercel ko‘rsatgan qiymat |
| `@` (zotdor.uz) | A / CNAME | Vercel koʻrsatgan qiymat (landing) |
| `www` | CNAME | Vercel koʻrsatgan qiymat |
| `api` | CNAME | `zotdor-api.onrender.com` (Render ko‘rsatgani) |

Vercel va Render'da domen holati "Verified / Certificate issued" bo‘lguncha kuting.

---

## 5. Telegram

- Webhook 2.4-bandda o‘rnatildi. Tekshirish: botga `/start` yozing — javob kelishi kerak.
- **Diqqat:** lokal `manage.py telegram_poll` webhook'ni o‘chiradi. Uni production boti bilan ishga tushirmang. Lokal ishlab chiqish uchun alohida test bot oching.

## 6. Click (shartnomadan keyin)

Click kabinetida:

- Prepare URL: `https://api.zotdor.uz/api/payments/click/prepare`
- Complete URL: `https://api.zotdor.uz/api/payments/click/complete`

Render'da `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_MERCHANT_USER_ID`, `CLICK_SECRET_KEY` ni to‘ldiring. Qaytish manzili avtomatik: `https://web.zotdor.uz/wallet?payment=<id>`.

## 7. Birinchi administrator

1. Admin bo‘ladigan odam https://web.zotdor.uz da Telegram orqali bir marta kirsin.
2. Render → `zotdor-api` → **Shell**:

   ```sh
   python manage.py shell -c "from accounts.models import User; User.objects.filter(phone='+998XXXXXXXXX').update(role='admin')"
   ```

3. https://panel.zotdor.uz ga kiring. Keyingi moderator va adminlar panelning "Foydalanuvchilar" bo‘limida tayinlanadi.

## 8. Ishga tushgandan keyin tekshirish

- [ ] `https://api.zotdor.uz/api/health` → `"status":"ok"`.
- [ ] `https://web.zotdor.uz` ochiladi, bosh sahifada yo‘nalishlar ko‘rinadi (API va CORS ishlayapti).
- [ ] Telegram orqali kirish → profil to‘ldirish → 50 000 so‘m bonus hamyonda.
- [ ] Telefonda `/sell`: kamera ochiladi, 4 ta rasm va 1 ta video yuklanadi. Rasmlar `*.nhost.run` manzilidan ko‘rinadi.
- [ ] Original fayl (`media-private`) manzili admin secret'siz ochilmaydi.
- [ ] Ikkinchi akkaunt bilan taklif berish; auksion vaqtida tugaydi (worker ishlayapti).
- [ ] Telegram'ga bildirishnomalar keladi.
- [ ] Panel: moderatsiya navbati, foydalanuvchi kartasi va audit jurnali ochiladi.

## 9. Kundalik ishlar

- **Yangilash:** `main` branch'iga push → Render va Vercel avtomatik deploy qiladi. Migratsiyalar API ishga tushganda qo‘llanadi.
- **Zaxira nusxa:** Nhost Pro kunlik baza zaxirasini o‘zi qiladi (Dashboard → Backups). Fayllar Nhost Storage'da turadi. Tiklash Nhost dashboard'idan qilinadi. Har chorakda bir marta staging loyihada sinab ko‘ring.
- **Monitoring:** `https://api.zotdor.uz/api/health` ni tashqi xizmatga (masalan, UptimeRobot, har 1 daqiqada) ulang. `status` `ok` bo‘lmasa, ogohlantirish yuborilsin.
- **Loglar:** Render → servis → Logs. Hamyon reconcile xatolari `ERROR` darajasida yoziladi.

## 10. Muammolar

| Belgi | Sabab va yechim |
|---|---|
| Konsolda `Cannot read properties of null (reading 'next' / 'directions')` yoki ekranda "Server notoʻgʻri javob qaytardi" | So‘rov API'ga yetmayapti: Vercel'da `VITE_API_URL=https://api.zotdor.uz` yo‘q yoki u qo‘shilgandan keyin Redeploy qilinmagan. Yangi versiyada bunday build o‘zi xato bilan to‘xtaydi. Tekshirish: DevTools → Network → so‘rov `https://api.zotdor.uz/api/v1/...` ga ketishi kerak, `web.zotdor.uz/api/...` ga emas. |
| Build "VITE_API_URL is not set" bilan to‘xtaydi | Vercel → Settings → Environment Variables → `VITE_API_URL` (Production va Preview uchun) → Redeploy. |
| Login ishlaydi, lekin saqlashda (masalan, profil) `403` va "Bu amal uchun ruxsat yo‘q" | CSRF tekshiruvi. Render'dagi kod eski bo‘lishi mumkin (token `/auth/csrf` javobidan olinadigan versiya deploy qilinmagan). Shuningdek `CSRF_TRUSTED_ORIGINS` da `https://web.zotdor.uz` va `https://panel.zotdor.uz` borligini tekshiring. Yangi versiyada CSRF xatosi `csrf_failed` kodi va "Sahifani yangilab, qayta urinib ko‘ring" matni bilan qaytadi. |
| Login "CSRF" xatosi bilan rad etiladi | `CSRF_TRUSTED_ORIGINS` ni tekshiring. Sayt `*.vercel.app` dan ochilgan bo‘lishi mumkin. |
| Loglarda `FATAL: no authentication method is found` | `DATABASE_URL` oxirida `?sslmode=require` yo‘q yoki parol/foydalanuvchi noto‘g‘ri. Nhost faqat SSL ulanishni qabul qiladi. |
| Brauzer konsolida CORS xatosi | `CORS_ALLOWED_ORIGINS` da `https://web.zotdor.uz` aniq shu ko‘rinishda (oxirida `/` siz) bo‘lishi kerak. |
| `400 Bad Request` (DisallowedHost) | `ALLOWED_HOSTS` ga `api.zotdor.uz` qo‘shilmagan. Bu ro‘yxatda `https://` yozilmaydi. |
| Rasm yuklanadi, lekin "Faylni saqlab bo‘lmadi" | `NHOST_STORAGE_URL` yoki admin secret noto‘g‘ri, yoki bucket yaratilmagan (1.3). Render loglarida `Nhost storage POST 4xx`. |
| Rasm yuklashda 503, Render logida `Nhost storage POST 403: error code: 1010` | Nhost oldidagi Cloudflare so‘rovni User-Agent bo‘yicha bloklagan. `auctions/storage.py` o‘z `USER_AGENT` ini yuboradi — eski image deploy qilinmaganini tekshiring. |
| Rasm saqlandi, lekin ko‘rinmaydi | `public` roli uchun `storage.files` select ruxsati yo‘q (1.4) yoki CSP domeni mos emas. |
| Video "Qayta ishlanmoqda…" dan o‘tmaydi | Worker ishlamayapti (`/api/health` → `worker`). |
| Health: `db: down` | `DATABASE_URL`, `sslmode=require`, Nhost loyihasi pauza holatida emasligini tekshiring. |
