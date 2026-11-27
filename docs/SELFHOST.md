# B reja: API o‘z kompyuterda (ngrok)

Render'dagi API sekin ishlasa yoki to‘xtasa, **API va worker** shu Windows kompyuterda ishga tushiriladi va ngrok orqali tashqariga chiqariladi. Sayt (`web.zotdor.uz`), panel va landing Vercel'da qoladi. Fayllar (rasm, video) Nhost Storage'da qoladi, ularni ko‘chirish shart emas. Bazaning o‘zi esa **lokal PostgreSQL'ga** ko‘chiriladi, chunki uydan Nhost'ga (Frankfurt) har bir SQL so‘rovi uzoq yo‘l bosib o‘tadi va API Render'dagidan ham sekin ishlaydi.

```
Foydalanuvchi ─▶ web.zotdor.uz (Vercel) ─▶ api.zotdor.uz / *.ngrok-free.app
                                              │ ngrok agent (shu kompyuter)
                                              ▼
                                   waitress 127.0.0.1:8000 ─▶ PostgreSQL (lokal)
                                   procrastinate worker   ─▶ Nhost Storage (fayllar)
```

Fayllar: `selfhost/` papkasi.

| Fayl | Vazifasi |
|---|---|
| `.env.example` → `.env` | Barcha sozlamalar. `backend/.env` bu rejimda **o‘qilmaydi** (`ZOTDOR_ENV_FILE`) |
| `start.ps1` | Paketlar, `check --deploy`, migratsiya, API (waitress), worker, ngrok, health tekshiruvi. `-SetWebhook` — Telegram'ni shu yerga ko‘chiradi, `-NoNgrok` — faqat lokal |
| `stop.ps1` | Uchala jarayonni to‘xtatadi |
| `db-from-nhost.ps1` | Nhost → lokal (B rejaga o‘tish) |
| `db-to-nhost.ps1` | Lokal → Nhost (Render'ga qaytish) |
| `serve.py`, `requirements.txt` | Windows uchun WSGI server (gunicorn Windows'da ishlamaydi) |

Loglar `selfhost/logs/`, zaxira nusxalar `selfhost/backups/` da saqlanadi (ikkalasi ham git'ga tushmaydi).

## 1. Ommaviy manzilni tanlash

ngrok bitta subdomen = bitta hostname. Bizga faqat API kerak, shuning uchun bitta domen yetadi.

| | 1-variant (tavsiya) | 2-variant (bepul) |
|---|---|---|
| ngrok tarifi | pullik (custom domain) | bepul doimiy domen `*.ngrok-free.app` |
| Manzil | `api.zotdor.uz` | `<nom>.ngrok-free.app` |
| DNS | `api` CNAME → ngrok ko‘rsatgan qiymat (Render o‘rniga) | o‘zgarmaydi |
| Vercel | hech narsa o‘zgarmaydi | `VITE_API_URL` (web, panel), `NEXT_PUBLIC_API_URL` (landing) → ngrok manzili, Redeploy; `frontend/vercel.json` va `panel/vercel.json` CSP `connect-src` ga shu domen |
| Cookie | `CSRF_COOKIE_DOMAIN=.zotdor.uz`, `COOKIE_SAMESITE=Lax` | `CSRF_COOKIE_DOMAIN=` (bo‘sh), `COOKIE_SAMESITE=None` |
| Ogohlantirish sahifasi | yo‘q | ngrok brauzerga ko‘rsatadi; saytlar `ngrok-skip-browser-warning` sarlavhasini o‘zi yuboradi (`api/http.ts`) |
| Android ilova | o‘zgarishsiz ishlaydi | sayt orqali ishlaydi (ilova `web.zotdor.uz` ni ochadi) |
| Kamchilik | oylik to‘lov | cookie uchinchi tomon cookie'siga aylanadi: Safari/iPhone va uchinchi tomon cookie'lari o‘chirilgan brauzerlarda **kirish ishlamaydi** |

2-variant faqat qisqa muddatga, favqulodda holat uchun.

## 2. Birinchi marta tayyorlash

1. PostgreSQL 17+ (shu kompyuterda 19 o‘rnatilgan) va lokal baza:
   ```powershell
   & "C:\Program Files\PostgreSQL\19\bin\psql.exe" -U postgres -c "CREATE ROLE zotdor LOGIN PASSWORD '<parol>' CREATEDB;" -c "CREATE DATABASE zotdor OWNER zotdor;"
   ```
2. `backend\.venv` (AGENTS.md → Buyruqlar), `ffmpeg`/`ffprobe` PATH'da.
3. ngrok: `winget install ngrok.ngrok`, keyin `ngrok config add-authtoken <token>` (dashboard.ngrok.com). 1-variantda ngrok dashboard → Domains → `api.zotdor.uz` qo‘shing va ko‘rsatilgan CNAME'ni DNS'ga yozing (Render o‘rniga).
4. `Copy-Item selfhost\.env.example selfhost\.env` va to‘ldiring. Qiymatlarni Render → Environment'dan oling. `DJANGO_SECRET_KEY` Render'dagi bilan bir xil bo‘lsa, foydalanuvchilar qayta kirmaydi. `TELEGRAM_WEBHOOK_SECRET` ham bir xil bo‘lishi kerak.
5. Kompyuter uxlab qolmasin: Sozlamalar → Tizim → Quvvat → "Uyqu: hech qachon".

## 3. B rejaga o‘tish

```powershell
# 1) Render → zotdor-api va zotdor-worker → Suspend (Nhost'ga yozuv to‘xtaydi)
# 2) Bazani ko‘chirish (Nhost'ga faqat o‘qish uchun ulanadi; lokal jadvallar almashtiriladi)
powershell -ExecutionPolicy Bypass -File selfhost\db-from-nhost.ps1
# 3) Ishga tushirish va Telegram webhook'ni shu yerga ko‘chirish
powershell -ExecutionPolicy Bypass -File selfhost\start.ps1 -SetWebhook
```

Skript har bosqichni tekshiradi: lokal `DATABASE_URL` lokal manzil emasligi, `.env` to‘ldirilmagani, API yoki ngrok javob bermasligi. Ko‘chirishdan keyin har bir jadval qatorlari soni Nhost bilan solishtiriladi.

Click: merchant kabinetidagi callback manzili `api.zotdor.uz` bo‘lsa, 1-variantda o‘zgartirish shart emas. 2-variantda uni ngrok manziliga almashtiring.

Kundalik: `stop.ps1` / `start.ps1` (webhook'siz). Kompyuter yonganda o‘zi ishga tushishi uchun:
```powershell
schtasks /Create /TN "Zotdor API" /SC ONLOGON /RL HIGHEST /TR "powershell -ExecutionPolicy Bypass -File C:\Users\<siz>\Projects\Zotdor\selfhost\start.ps1"
```

## 4. Render'ga qaytish

```powershell
powershell -ExecutionPolicy Bypass -File selfhost\stop.ps1
powershell -ExecutionPolicy Bypass -File selfhost\db-to-nhost.ps1
# Render → Resume; 1-variantda DNS: api CNAME → zotdor-api.onrender.com
cd backend; .venv\Scripts\python manage.py telegram_set_webhook https://api.zotdor.uz
```

`db-to-nhost.ps1`:
- lokal jarayonlar ishlayotgan bo‘lsa, to‘xtaydi;
- Nhost'dagi boshqa ulanishlarni (masalan, hali ishlayotgan Render) ko‘rsatadi;
- avval Nhost'ning hozirgi holatini `selfhost\backups\nhost-before-push-*.dump` ga saqlaydi;
- lokal nusxani **bitta tranzaksiyada** yozadi: xato bo‘lsa, Nhost o‘zgarmaydi;
- faqat `public` sxemaga tegadi. Nhost'ning `auth`/`storage` sxemalari va fayllar o‘zgarmaydi;
- oxirida jadval qatorlari sonini solishtiradi;
- `NHOSTGA YOZ` deb yozib tasdiqlashni so‘raydi.

Nhost'ni zaxiradan tiklash (kerak bo‘lsa):
```powershell
& "C:\Program Files\PostgreSQL\19\bin\pg_restore.exe" --clean --if-exists --no-owner --no-privileges --single-transaction -d "<NHOST_DATABASE_URL>" selfhost\backups\nhost-before-push-<vaqt>.dump
```

## 5. Muammolar

| Belgi | Sabab va yechim |
|---|---|
| `start.ps1`: "API javob bermadi" | `selfhost\logs\api.err.log`. Ko‘pincha `DATABASE_URL` paroli yoki baza yo‘qligi |
| Lokal OK, ommaviy manzil javob bermaydi | `selfhost\logs\ngrok.log`: authtoken, domen ngrok'da qo‘shilmagan yoki DNS hali tarqalmagan |
| Saytda "Serverga ulanib boʻlmadi" (2-variant) | Vercel'da `VITE_API_URL` va CSP'ga ngrok domeni qo‘shilmagan yoki Redeploy qilinmagan; `CORS_ALLOWED_ORIGINS` |
| Kirgandan keyin darhol chiqib ketadi (2-variant) | `COOKIE_SAMESITE=None` va `CSRF_COOKIE_DOMAIN=` bo‘sh emas; Safari'da bu variant ishlamaydi |
| Videolar "processing" da qoladi | worker ishlamayapti (`selfhost\logs\worker.err.log`) yoki `FFMPEG_BIN` noto‘g‘ri |
| `db-*.ps1`: "Sonlar mos emas" | Ko‘chirish paytida manba bazaga yozildi (Render yoki lokal API ishlab turgan). To‘xtatib, qayta ishga tushiring |
| PostgreSQL versiyasi | Lokal `pg_dump` (19) Nhost'dan yangi bo‘lishi kerak. Eski serverga yozishda faqat `transaction_timeout` qatori olib tashlanadi. Boshqa mos kelmaslik bo‘lsa, tranzaksiya bekor bo‘ladi va Nhost o‘zgarmaydi |
