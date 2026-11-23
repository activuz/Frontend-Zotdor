# AGENTS.md — Zotdor.uz

Bu fayl repo bilan ishlaydigan AI agentlar va dasturchilar uchun. Kod yozishdan oldin uni to‘liq o‘qing.

## Loyiha

Chorva mollarini auksion orqali sotish platformasi. Sotuvchi narx va vaqt belgilaydi, xaridorlar taklif beradi, sotuvchi g‘olibni tanlaydi. Platforma sotuvchining balansidan 0.2% komissiya oladi. Batafsil: [docs/PRD.md](docs/PRD.md).

## Joriy holat (2026-11-23)

- `backend/` — kirish, profil, ma'lumotnomalar, hamyon, auksionlar (media va tekshiruvlar bilan), takliflar, bitimlar va baholar, shikoyatlar, bildirishnomalar (outbox), to‘lovlar (`fake` va Click) hamda panel API tayyor va test qilingan.
- `frontend/` — barcha ekranlar haqiqiy API bilan ishlaydi (2026-11-23): feed, qidiruv, auksion sahifasi va takliflar, sotish ustasi va kamera, g‘olibni tanlash, bitim, `/me/*`, bildirishnomalar, hamyon (to‘ldirish va qaytarish). Demo rejimi, `src/mocks/` va `DemoNotice` olib tashlandi.
- `panel/` — moderator va admin paneli (port 3001): navbatlar, foydalanuvchilar, sozlamalar, toifalar, audit. Tiplar o‘sha `backend/schema.yml` dan (`npm run api:types`); panel javoblari `panel_api/schemas.py` da tasvirlangan.
- Production: sayt va panel — Vercel (`web.zotdor.uz`, `panel.zotdor.uz`), API va worker — Render (`api.zotdor.uz`, `render.yaml`), baza va fayllar — Nhost. Qo‘llanma: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Fayllar `auctions/storage.py` orqali saqlanadi (`STORAGE_BACKEND=local|nhost`).
- `deploy/` — muqobil variant: bitta VPS uchun docker compose, nginx, zaxira nusxa va tiklash ([deploy/README.md](deploy/README.md)). Docker faqat Render image'i va shu yerda ishlatiladi.
- Ish boshlashdan oldin [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) dagi joriy bosqichni va undagi belgilanmagan vazifalarni tekshiring.

## Hujjatlar

| Fayl | Qachon o‘qiladi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | biznes qoidalari (BR-xx), taxminlar (A-xx) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | qatlamlar, qarorlar (D-x), holat mashinasi, xavfsizlik |
| [docs/DATABASE.md](docs/DATABASE.md) | modellar va constraint'lar |
| [docs/API.md](docs/API.md) | endpointlar, xato formati |
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | ekranlar, chetki holatlar, bildirishnomalar |
| [docs/DESIGN.md](docs/DESIGN.md) | tokenlar, tipografika, matn qoidalari |
| [docs/TESTING.md](docs/TESTING.md) | majburiy test holatlari, "tayyor" ta'rifi |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | bosqichlar va bog‘liqliklar |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | production: Vercel, Render, Nhost sozlash |

**Hujjat va kod bir-biriga mos bo‘lishi shart.** Modelni, endpointni yoki biznes qoidani o‘zgartirsangiz, tegishli hujjatni o‘sha o‘zgarish ichida yangilang. Biznes qoidasini o‘zgartirish kerak bo‘lsa, avval mahsulot egasidan so‘rang. Uni o‘zingiz hal qilmang.

## Stack

- **backend/**: Python 3.13, Django 5, DRF, PostgreSQL 17+, Procrastinate, drf-spectacular, Pillow, ffmpeg.
- **frontend/**, **panel/**: React 18, TypeScript (strict), Vite, Tailwind 3, React Query 5, React Router 6, lucide-react.
- Yangi dependency faqat aniq sabab bilan qo‘shiladi va sababi PR tavsifida yoziladi. Mavjud vositalar yetadigan joyda yangi kutubxona qo‘shilmaydi.

## Buyruqlar

Lokal muhit Docker'siz ishlaydi: PostgreSQL to‘g‘ridan-to‘g‘ri o‘rnatiladi, backend esa `backend/.venv` virtual muhitida. Docker faqat VPS deploy'i uchun ishlatiladi (10-bosqich). Windows'da `.venv/Scripts/`, Linux va macOS'da `.venv/bin/` yo‘lidan foydalaniladi.

```bash
# backend (birinchi marta: py -3.13 -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt;
#          cp .env.example .env va qiymatlarni to‘ldirish)
cd backend && .venv/Scripts/python manage.py migrate
cd backend && .venv/Scripts/python manage.py load_reference           # viloyat/tuman/toifalar (idempotent)
cd backend && .venv/Scripts/python manage.py runserver 8000
cd backend && .venv/Scripts/python manage.py telegram_poll            # botni lokal ishga tushirish (webhook'ni o‘chiradi!)
cd backend && .venv/Scripts/python manage.py procrastinate worker     # fon vazifalari
cd backend && .venv/Scripts/pytest
cd backend && .venv/Scripts/ruff check . && .venv/Scripts/ruff format --check . && .venv/Scripts/mypy .
cd backend && .venv/Scripts/python manage.py spectacular --file schema.yml --validate   # API o‘zgarganda

# frontend
cd frontend && npm run dev | npm run lint | npm run build
cd frontend && npm run api:types        # backend/schema.yml → src/api/schema.d.ts
cd panel && npm run dev | npm run lint | npm run build | npm run api:types   # port 3001
```

API o‘zgarsa, `schema.yml` hamda `frontend/` va `panel/` dagi `schema.d.ts` qayta generatsiya qilinadi va hammasi o‘sha commit'ga qo‘shiladi. Lokal ishlab chiqishda Vite `/api` so‘rovlarini `localhost:8000` ga proxy qiladi, shuning uchun cookie birinchi tomon cookie'si bo‘ladi va login ishlaydi. Frontend unit testlari (Vitest) hali yo‘q.

## Backend qoidalari

- Biznes logika faqat `<app>/services.py` da yoziladi. View'lar yupqa bo‘ladi. Model `save()` va signallar ichida biznes logika yozilmaydi.
- Pul faqat `wallet.services` orqali o‘zgaradi. `Wallet` qatoriga to‘g‘ridan-to‘g‘ri `update()` qilish taqiqlanadi.
- Auksion holati faqat `auctions.services.transition()` orqali o‘zgaradi va har bir o‘tish `AuctionEvent` ga yoziladi.
- Bir vaqtdalikka sezgir operatsiyalar `transaction.atomic()` va `select_for_update()` bilan bajariladi. Vaqt shartlari bazada tekshiriladi. Worker'ning o‘z vaqtida ishlashiga tayanilmaydi.
- Tashqi so‘rovlar (Telegram, Click) tranzaksiya ichida yuborilmaydi. Ular `transaction.on_commit` orqali navbatga qo‘yiladi.
- Pul `int` (butun so‘m) sifatida saqlanadi. `float` ishlatilmaydi.
- Vaqt UTC'da saqlanadi: `timezone.now()`. `datetime.now()` ishlatilmaydi.
- Xatolar `core.errors.DomainError(code, message)` orqali qaytariladi. `message` foydalanuvchi uchun o‘zbekcha matn bo‘ladi.
- Panel endpointidagi har bir mutatsiya `core.audit.log()` ni chaqiradi.

## Frontend qoidalari

- API tiplari `src/api/schema.d.ts` dan olinadi va bu fayl generatsiya qilinadi. Server javobi uchun tipni qo‘lda yozmang.
- **Mock fallback taqiqlanadi.** API xato bersa, foydalanuvchiga xato ko‘rsatiladi. HTTP faqat `src/api/http.ts` orqali yuboriladi. Demo ekranlar qo‘shilmaydi.
- So‘rov qiladigan har bir ekranda loading, empty, error va success holatlari bo‘lishi shart.
- `alert()`, `confirm()` va `any` ishlatilmaydi.
- Ranglar faqat Tailwind tokenlari orqali beriladi (DESIGN.md §2). `[#xxxxxx]` ishlatilmaydi. 13 px dan kichik matn bo‘lmaydi.
- Bosiladigan element `button` yoki `a`/`Link` bo‘ladi. `div onClick` ishlatilmaydi.
- Struktura `src/features/<feature>/` bo‘yicha. Umumiy UI `src/components/ui/` da turadi.

## Kontent qoidalari

- Interfeys matnlari o‘zbek lotin yozuvida, `ʻ` (U+02BB) va `ʼ` (U+02BC) belgilari bilan yoziladi.
- Mavjud bo‘lmagan ma'lumot to‘qib chiqarilmaydi: telefon raqami, manzil, sertifikat, statistika, foydalanuvchilar soni. Haqiqiy ma'lumot bo‘lmasa, element ko‘rsatilmaydi.
- Placeholder matn, "Lorem", "Wireframe", "TODO" kabi yozuvlar UI'da qolmaydi.
- Batafsil: [docs/DESIGN.md §5](docs/DESIGN.md).

## Xavfsizlik

- Maxfiy kalitlar faqat env'da saqlanadi. `.env` commit qilinmaydi, `.env.example` esa yangilanib turadi.
- Har bir endpoint uchun permission aniq yoziladi. Obyekt egaligi tekshiriladi.
- Fayl turi kontentni ochib tekshiriladi (Pillow, ffprobe). Content-Type'ga ishonilmaydi.
- Telefon raqami va aniq joylashuv faqat BR-33 ruxsat bergan joyda ko‘rsatiladi.

## Ish tartibi

1. Vazifani rejadagi bandga bog‘lang. Agar u rejada bo‘lmasa, avval so‘rang.
2. Kod yozishdan oldin tegishli BR, API va DB bo‘limlarini o‘qing.
3. Avval test yozing (TESTING.md dagi majburiy holatlar), keyin implementatsiya qiling.
4. Lint, test va build'ni ishga tushiring. Natijani qanday bo‘lsa, shunday yozing: o‘tmagan testni o‘tdi deb aytmang, ishga tushirilmagan tekshiruvni bajarildi demang.
5. Hujjatlarni yangilang. Rejada bajarilgan bandni belgilang.
6. Commit xabari Conventional Commits formatida yoziladi (`feat:`, `fix:`, `docs:` …).
