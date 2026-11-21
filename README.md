/bt# Zotdor loyihasi

## Biz odamlar o‘rgangan haqiqiy mol bozoridagi jonli savdolashuv muhitini onlayn formatga 1 ga 1 ko‘chirib, unga haqiqiy tasvir va adolatli narx nazorati orqali to‘liq ishonch olib kirdik. Bu

O‘zbekistondagi yillik ~5 mlrd dollarlik, ammo hanuzgacha tarqoq va norasmiy ishlayotgan chorva bozorini yagona raqamli ekotizimga birlashtiruvchi Agritech marketplace. Biz shunchaki e’lonlar sayti emas, balki an’anaviy mol bozorining real savdolashuv mexanikasini 1 ga 1 raqamli muhitga ko‘chirgan boshqariluvchi savdo platformasini qurmoqdamiz. Tizim so‘m/kg bo‘yicha bozor narxlarini shakllantiradi, faqat platforma ichida olingan haqiqiy media-dalillar va sotuvchi reytingi orqali ishonchni kafolatlaydi. Natijada o‘rtadagi samarasiz dallollar zanjiri qisqarib, respublika bo‘ylab shaffof, ma’lumotlarga asoslangan (data-driven) yirik chorva savdo aylanmasi vujudga keladi.

---

Uning foydalari:

1. Davlatga: chorvachilik sohasida yashirin va tartibsiz savdoni ochiq, hisobdor hamda zamonaviy raqamli iqtisodiyotga o‘tkazuvchi milliy platforma. Loyiha respublika bo‘ylab chorva bosh soni, zotdorlik darajasi va hududlararo narx tafovutlari bo‘yicha real vaqt rejimidagi tahliliy ma’lumotlarni shakllantiradi. An’anaviy bozor muhitini saqlab qolgan holda, savdo jarayoniga raqamli nazorat, veterinariya-pasport integratsiyasi va kelajakda logistika hamda moliyaviy xizmatlarni ulash orqali mamlakat agrosanoat infratuzilmasini yangi bosqichga olib chiqadi.
2. Fermerlarga: Endi mol sotish yoki olish uchun saharlab bozorga borish, yo‘l haqi va chek to‘lash yoki o‘rtakashlarga foydangizni berish shart emas. Zotdor.uz — qo‘lingizdagi telefonda ishlaydigan haqiqiy mol bozori. Bu yerda xuddi bozordagidek jonli savdolashib, narx taklif qilib kelishasiz, lekin hamma jarayon xavfsiz va shaffof: hayvonning rasmi va videosi haqiqiyligi tekshirilgan, narxlar esa bozorga mos. Xaridor uydan chiqmasdan butun O‘zbekiston bo‘ylab o‘ziga kerakli zotni topadi, chorvador esa mehnatining haqiqiy qiymatini oladi.

---

## Texnik ma'lumot

> Yuqoridagi matn loyihaning uzoq muddatli maqsadini tasvirlaydi. Birinchi reliz (MVP) doirasi [docs/PRD.md](docs/PRD.md) da belgilangan: so‘m/kg tahlili va veterinariya pasporti integratsiyasi MVP'ga kirmaydi.

### Joriy holat

- `frontend/` — hozircha demo, `src/mocks/` dagi soxta ma'lumotlar bilan ishlaydi.
- `backend/` — poydevor (0-bosqich): API skeleti va `/api/health`. Biznes funksiyalari [implementatsiya rejasi](docs/IMPLEMENTATION_PLAN.md) bo‘yicha qo‘shiladi.

### Lokal ishga tushirish

Talablar: Node.js 20+, Python 3.13, PostgreSQL 17+ (Docker kerak emas).

```bash
# Backend
cd backend
py -3.13 -m venv .venv                       # Linux/macOS: python3.13 -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt
cp .env.example .env                         # qiymatlarni to‘ldiring
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py runserver 8000   # http://localhost:8000/api/health

# Frontend
cd frontend
npm ci
npm run dev                                  # http://localhost:3000
```

Batafsil buyruqlar: [AGENTS.md](AGENTS.md#buyruqlar).

### Maqsadli tuzilma

```
backend/    Django 5 + DRF + PostgreSQL — API, Telegram bot, worker
frontend/   foydalanuvchi ilovasi (React)
panel/      moderator va admin paneli (React)
deploy/     docker compose, nginx, zaxira nusxa
docs/       hujjatlar
```

### Hujjatlar

- [AGENTS.md](AGENTS.md) — dasturchilar va AI agentlar uchun qoidalar
- [docs/PRD.md](docs/PRD.md) — mahsulot talablari va biznes qoidalari
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arxitektura va texnik qarorlar
- [docs/DATABASE.md](docs/DATABASE.md) — ma'lumotlar bazasi sxemasi
- [docs/API.md](docs/API.md) — API kontrakti
- [docs/USER_FLOWS.md](docs/USER_FLOWS.md) — foydalanuvchi oqimlari
- [docs/DESIGN.md](docs/DESIGN.md) — dizayn tizimi va matn qoidalari
- [docs/TESTING.md](docs/TESTING.md) — test strategiyasi
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — ishlab chiqish bosqichlari