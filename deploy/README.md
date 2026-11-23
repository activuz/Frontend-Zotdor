# Production deploy (bitta VPS)

Tarkib: `db` (PostgreSQL 17), `api` (gunicorn), `worker` (procrastinate), `nginx` (frontend, panel, `/api`, `/media`, TLS). Arxitektura: [docs/ARCHITECTURE.md §8](../docs/ARCHITECTURE.md).

## Talablar

- Ubuntu 22.04+ VPS, Docker Engine va compose plugin.
- DNS: `DOMAIN` va `PANEL_DOMAIN` VPS IP manziliga yo‘naltirilgan.
- @BotFather'dan yangi bot tokeni (eski token chatlarda ko‘ringan bo‘lsa, `/revoke` qiling).

## Birinchi o‘rnatish

```sh
git clone <repo> /opt/zotdor && cd /opt/zotdor

cp deploy/.env.example deploy/.env           # DOMAIN, PANEL_DOMAIN, POSTGRES_PASSWORD
cp backend/.env.example backend/.env         # quyidagi qiymatlarni to‘ldiring
```

`backend/.env` da production uchun:

```
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<python -c "import secrets; print(secrets.token_urlsafe(50))">
ALLOWED_HOSTS=zotdor.uz,panel.zotdor.uz
CSRF_TRUSTED_ORIGINS=https://zotdor.uz,https://panel.zotdor.uz
CORS_ALLOWED_ORIGINS=
FRONTEND_URL=https://zotdor.uz
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=ZotdorPlatformBot
TELEGRAM_WEBHOOK_SECRET=<kamida 16 belgi, tasodifiy>
PAYMENTS_PROVIDER=click          # Click shartnomasi bo‘lmasa ham shunday qoldiring: to‘ldirish "ulanmagan" deydi
CLICK_SERVICE_ID=  CLICK_MERCHANT_ID=  CLICK_MERCHANT_USER_ID=  CLICK_SECRET_KEY=
```

`DATABASE_URL` va `MEDIA_ROOT` ni compose o‘zi beradi. `fake` to‘lov provayderi production'da ishlamaydi (`DEBUG=false`).

### TLS sertifikati (bir marta)

```sh
sudo docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot \
  certonly --standalone -d zotdor.uz -d panel.zotdor.uz --agree-tos -m <email> --no-eff-email
```

### Ishga tushirish

```sh
COMPOSE="docker compose -f deploy/docker-compose.yml --env-file deploy/.env"
$COMPOSE up -d --build                                    # migrate → api, worker, nginx
$COMPOSE exec api python manage.py load_reference          # faqat birinchi marta
$COMPOSE exec api python manage.py telegram_set_webhook https://zotdor.uz
curl -s https://zotdor.uz/api/health                        # {"status":"ok",...}
```

Birinchi administrator: kerakli odam saytga Telegram orqali bir marta kirsin, keyin:

```sh
$COMPOSE exec api python manage.py shell -c \
  "from accounts.models import User; User.objects.filter(phone='+998901234567').update(role='admin')"
```

Keyingi moderator va adminlar panelning "Foydalanuvchilar" bo‘limida tayinlanadi.

## Muntazam ishlar (root crontab)

```cron
# Zaxira nusxa, har kecha 02:30 (Toshkent)
30 21 * * * cd /opt/zotdor && sh deploy/backup.sh >> /var/log/zotdor-backup.log 2>&1
# Sertifikatni yangilash
0 4 * * 1 cd /opt/zotdor && docker compose -f deploy/docker-compose.yml --env-file deploy/.env run --rm certbot renew --webroot -w /var/www/certbot && docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec nginx nginx -s reload
```

Tiklash: [RESTORE.md](RESTORE.md).

## Yangilash

```sh
git pull && $COMPOSE up -d --build
```

`migrate` servisi har safar migratsiyalarni qo‘llaydi, keyin `api` va `worker` qayta ishga tushadi.

## Monitoring

- `GET /api/health`: `db` va `worker` (heartbeat) holati. `status != "ok"` bo‘lsa ogohlantirish yuboring (UptimeRobot yoki shunga o‘xshash tashqi xizmat, har 1 daqiqada).
- Loglar: `$COMPOSE logs -f api worker`. Hamyon reconcile xatolari `ERROR` darajasida yoziladi.
