# Zaxiradan tiklash

Bu tartib har chorakda staging serverda sinab ko‘riladi (docs/ARCHITECTURE.md §8). Sinov sanasi va natijasi shu faylning oxiridagi jurnalga yoziladi.

## 1. Kerakli fayllar

`BACKUP_DIR` (yoki `BACKUP_REMOTE`) dan eng so‘nggi juftlikni oling:

- `db-<vaqt>.dump` — `pg_dump -Fc` formatidagi baza;
- `media-<vaqt>.tar.gz` — yuklangan rasm va videolar.

## 2. Tiklash

Repo ildizida bajariladi:

```sh
COMPOSE="docker compose -f deploy/docker-compose.yml --env-file deploy/.env"

# API, worker va nginx'ni to‘xtating, baza ishlab tursin
$COMPOSE stop api worker nginx
$COMPOSE up -d db

# Bazani qayta yarating va dump'ni yuklang
$COMPOSE exec -T db dropdb -U zotdor --if-exists zotdor
$COMPOSE exec -T db createdb -U zotdor zotdor
$COMPOSE exec -T db pg_restore -U zotdor -d zotdor --no-owner < /path/to/db-<vaqt>.dump

# Media
$COMPOSE run --rm --no-deps -T -v /path/to:/backup --user root --entrypoint sh api \
  -c "rm -rf /data/media/* && tar -C /data -xzf /backup/media-<vaqt>.tar.gz && chown -R 10001 /data/media"

# Migratsiyalar (zaxira eski versiyadan bo‘lsa) va ishga tushirish
$COMPOSE up -d --build
```

## 3. Tekshirish

1. `curl https://<DOMAIN>/api/health` → `"status": "ok"`.
2. Hamyonlar mosligi: `$COMPOSE exec api python manage.py wallet_reconcile` — mos kelmaslik bo‘lmasligi kerak.
3. Panelda oxirgi auksionlar va ularning rasmlari ochiladi.
4. Telegram orqali kirish ishlaydi.

## Sinov jurnali

| Sana | Kim | Zaxira vaqti | Natija |
|---|---|---|---|
| | | | |
