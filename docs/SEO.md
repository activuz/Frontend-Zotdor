# Qidiruv tizimlari va havola ko‘rinishi (SEO) — Zotdor.uz

Bu hujjat ikki qismdan iborat. Birinchisi — kodda nima qilingani: qaysi fayl nimaga javob beradi. Ikkinchisi — saytni Google, Yandex va Bing'ga qo‘shish bo‘yicha qadam-baqadam qo‘llanma.

## 1. Saytlar va ularning vazifasi

| Manzil | Nima | Qidiruvda |
|---|---|---|
| `https://zotdor.uz` | Landing (`landing/`, Next.js) — platformani tanishtiradi | ✅ indekslanadi |
| `https://web.zotdor.uz` | Asosiy sayt (`frontend/`, SPA) — auksionlar, qidiruv | ✅ bosh sahifa, qidiruv va har bir auksion |
| `https://panel.zotdor.uz` | Xodimlar paneli | ❌ `noindex`, `robots.txt` da `Disallow: /` |
| `https://api.zotdor.uz` | API | ❌ `robots.txt` da `Disallow: /` |

## 2. Kodda nima qilingan

### Sarlavha va tavsiflar

| Sahifa | `<title>` | Indeks |
|---|---|---|
| `zotdor.uz/` | Zotdor.uz — chorva mollari auksioni | ✅ |
| `web.zotdor.uz/` | Chorva mollari auksioni — Zotdor.uz | ✅ |
| `/search` | Chorva qidirish — Zotdor.uz | ✅ |
| `/a/:id` | `<auksion sarlavhasi> — Zotdor.uz`, tavsif: joy, sotuvchi narxi, holat, tavsifning boshi | ✅ ochiq va tugagan auksionlar; qoralama va moderatsiyadagilar ❌ |
| `/u/:id` | `<ism> — sotuvchi — Zotdor.uz`, tavsif: baho va bitimlar soni | ✅ |
| `/login` | Kirish — Zotdor.uz | ✅ |
| `/terms`, `/privacy`, `/offer` | Foydalanish shartlari / Maxfiylik siyosati / Ommaviy oferta — Zotdor.uz | ✅ |
| `/sell`, `/me/*`, `/deals/*`, `/wallet`, `/notifications`, `/a/:id/decision`, 404 | sahifa nomi | ❌ `noindex` |

Matnlar shu yerda yoziladi:

- `frontend/src/lib/seo.ts` — `useSeo()` va statik sahifalar ro‘yxati (`STATIC`). Yangi ochiq sahifa qo‘shilsa, shu ro‘yxatga qo‘shing.
- `frontend/src/features/auctions/seo.ts` — auksion sahifasining sarlavhasi, tavsifi, rasmi va `Product` JSON-LD.
- `frontend/index.html` — JS ishlamaguncha ko‘rinadigan standart teglar.
- `landing/src/app/layout.tsx` — landing'ning title, description, Open Graph.

### Open Graph (Telegram, Facebook, WhatsApp'da havola ko‘rinishi)

- **Landing:** rasm `landing/src/app/opengraph-image.tsx` da koddan chiziladi (1200×630) va `https://zotdor.uz/opengraph-image` manzilida turadi. Sayt sahifalari uchun ham standart rasm sifatida shu ishlatiladi.
- **Auksion havolasi:** Telegram va Facebook botlari JavaScript'ni bajarmaydi. Shuning uchun `frontend/vercel.json` faqat shu botlarni (User-Agent bo‘yicha) `/a/:id` dan `https://api.zotdor.uz/api/seo/a/:id` ga yo‘naltiradi. U yerda backend auksion sarlavhasi, narxi, joyi va **birinchi rasmi** bilan tayyor HTML qaytaradi (`backend/seo/views.py`). Odamlar va Google oddiy saytni ko‘radi.
- Yangi bot qo‘shish kerak bo‘lsa (masalan, boshqa messenjer), uning User-Agent nomini `vercel.json` dagi ro‘yxatga qo‘shing.

### Sitemap

| Fayl | Nima bor | Qanday yangilanadi |
|---|---|---|
| `https://web.zotdor.uz/sitemap.xml` | `/`, `/search`, `/login`, `/terms`, `/privacy`, `/offer`, shu sitemap'dagi auksionlar sotuvchilarining profillari (`/u/:id`), barcha ochiq (`scheduled`, `live`) auksionlar va oxirgi 30 kunda tugaganlar | **Avtomatik.** Vercel bu manzilni `api.zotdor.uz/api/seo/sitemap.xml` ga yo‘naltiradi; backend uni har so‘rovda bazadan tuzadi (10 daqiqa kesh). Auksion e'lon qilinishi bilan sitemap'ga tushadi, 30 kundan keyin o‘zi chiqib ketadi. |
| `https://zotdor.uz/sitemap.xml` | landing sahifasi | `landing/src/app/sitemap.ts` |

Qoidalar `backend/seo/views.py` da: `FINISHED_KEEP_DAYS = 30`, `OPEN_STATUSES`, `FINISHED_STATUSES`, `STATIC_PAGES`. Qoralama, moderatsiyadagi, rad etilgan, bloklangan va bekor qilingan auksionlar sitemap'ga hech qachon tushmaydi.

### Tuzilgan ma'lumot (JSON-LD)

- Landing: `FAQPage` (savol-javoblar), `Organization` va `WebSite`.
- Auksion sahifasi: `Product` + `Offer` (narx `UZS`, holat `InStock` yoki `SoldOut`, rasmlar).

### robots.txt

- `web.zotdor.uz/robots.txt` — `frontend/public/robots.txt`: shaxsiy sahifalar yopiq, sitemap ko‘rsatilgan.
- `zotdor.uz/robots.txt` — `landing/src/app/robots.ts`.
- `panel.zotdor.uz/robots.txt` va `api.zotdor.uz/robots.txt` — hammasi yopiq.

## 3. Qidiruvga qo‘shish — qadam-baqadam

Boshlashdan oldin hamma narsa deploy qilingan bo‘lsin va quyidagilar ochilsin:

```
https://zotdor.uz/robots.txt
https://zotdor.uz/sitemap.xml
https://web.zotdor.uz/robots.txt
https://web.zotdor.uz/sitemap.xml      ← ichida /a/... qatorlari bo‘lishi kerak
```

### 3.1. Google Search Console

1. https://search.google.com/search-console ga kiring (Google akkaunt bilan).
2. **Add property** → **Domain** turini tanlang → `zotdor.uz` deb yozing. Domen turi barcha subdomenlarni (`web.`, `www.`) birdaniga qamraydi.
3. Google bergan `TXT` yozuvni (`google-site-verification=...`) DNS'ga qo‘shing: `zotdor.uz` zonasi → yangi yozuv, turi `TXT`, nomi `@`, qiymati Google bergan qator. 5–30 daqiqa kuting va **Verify** ni bosing.
4. **Sitemaps** bo‘limida ikkala sitemap'ni yuboring:
   - `https://zotdor.uz/sitemap.xml`
   - `https://web.zotdor.uz/sitemap.xml`
   Holat "Success" bo‘lishi kerak. Sitemap avtomatik yangilangani uchun qayta yuborish shart emas: Google uni o‘zi qayta o‘qiydi.
5. **URL Inspection** da `https://web.zotdor.uz/` va bitta auksion havolasini tekshiring → **Test live URL** → **View tested page → Screenshot**. Skrinshotda auksion ko‘rinsa, Google JavaScript'ni to‘g‘ri bajaryapti. So‘ng **Request indexing** ni bosing (kuniga cheklangan miqdor).
6. Bir-ikki hafta ichida **Pages** hisobotida "Indexed" sahifalar paydo bo‘ladi. `noindex` sahifalar "Excluded by 'noindex' tag" bo‘limida turadi — bu to‘g‘ri.

### 3.2. Yandex Webmaster (O‘zbekistonda muhim)

1. https://webmaster.yandex.com ga kiring → **Add site** → `https://web.zotdor.uz`.
2. Tasdiqlash usuli: **DNS** (TXT yozuv `yandex-verification: ...`) yoki **Meta tag**. DNS usuli kodni o‘zgartirmaydi.
3. Xuddi shunday `https://zotdor.uz` ni ham alohida qo‘shing (Yandex har bir subdomenni alohida sayt deb hisoblaydi).
4. **Indexing → Sitemap files** bo‘limiga mos sitemap'ni qo‘shing.
5. **Indexing → Reindex pages** orqali bosh sahifa va bir nechta auksionni yuboring.
6. **Site information → Regionality** da hudud sifatida O‘zbekistonni ko‘rsating.

### 3.3. Bing Webmaster Tools

1. https://www.bing.com/webmasters → **Import from Google Search Console** ni tanlang. Saytlar va sitemap'lar o‘zi ko‘chadi.
2. Import ishlamasa, qo‘lda qo‘shing va DNS (CNAME) orqali tasdiqlang.

### 3.4. Havola ko‘rinishini tekshirish

- **Telegram:** @WebpageBot ga auksion havolasini yuboring. U keshni yangilaydi va yangi ko‘rinishni ko‘rsatadi. Sarlavha, narx va rasm chiqishi kerak.
- **Facebook:** https://developers.facebook.com/tools/debug/ → havolani kiriting → **Scrape Again**.
- **Qo‘lda:** bot sifatida so‘rov yuborib ko‘ring:

```sh
curl -s -A "TelegramBot (like TwitterBot)" https://web.zotdor.uz/a/<auksion-id> | grep og:
```

`og:title`, `og:description`, `og:image` qatorlari chiqishi kerak.

### 3.5. Tuzilgan ma'lumotni tekshirish

- https://search.google.com/test/rich-results — `https://zotdor.uz` (FAQ) va bitta auksion havolasi (Product).
- https://validator.schema.org — xuddi shu havolalar.

## 4. Ishga tushgandan keyin

- Oyiga bir marta Search Console'da **Pages** va **Core Web Vitals** hisobotlarini ko‘ring.
- Yangi ochiq sahifa qo‘shilsa: `frontend/src/lib/seo.ts` dagi `STATIC` ro‘yxatiga sarlavha va tavsif yozing, `backend/seo/views.py` dagi `STATIC_PAGES` ga qo‘shing.
- Yangi shaxsiy sahifa qo‘shilsa: `STATIC` ga `noindex: true` bilan qo‘shing va `frontend/public/robots.txt` ga `Disallow` qatorini yozing.
- Domen o‘zgarsa: `FRONTEND_URL` (Render), `NEXT_PUBLIC_*` (Vercel, landing), `frontend/public/robots.txt`, `frontend/index.html`, `frontend/vercel.json` dagi manzillarni yangilang.

## 5. Muammolar

| Belgi | Sabab va yechim |
|---|---|
| `web.zotdor.uz/sitemap.xml` HTML (sayt) qaytaradi | `frontend/vercel.json` dagi `/sitemap.xml` qoidasi deploy qilinmagan yoki catch-all qoidadan keyin turibdi. U birinchi bo‘lishi kerak. |
| Sitemap'da auksionlar yo‘q | Ochiq auksion yo‘q yoki `FRONTEND_URL` noto‘g‘ri. `https://api.zotdor.uz/api/seo/sitemap.xml` ni to‘g‘ridan-to‘g‘ri oching. |
| Telegram'da rasm chiqmaydi | Nhost'da `public` rol uchun `storage.files` select ruxsati yo‘q (DEPLOYMENT.md 1.4) yoki Telegram eski keshni ko‘rsatyapti — @WebpageBot orqali yangilang. |
| Search Console: "Crawled — currently not indexed" | Yangi sayt uchun odatiy. Sahifalar soni ko‘paygani va tashqi havolalar paydo bo‘lgani sari o‘tadi. Landing va Telegram kanaldan saytga havolalar qo‘ying. |
| Auksion "Duplicate, Google chose different canonical" | `canonical` har doim `https://web.zotdor.uz/a/<id>` bo‘lishi kerak. `VITE_SITE_URL` berilgan bo‘lsa, u aynan shu domen bo‘lsin. |
