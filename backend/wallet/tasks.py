import logging

from procrastinate.contrib.django import app

from wallet import services

logger = logging.getLogger(__name__)


@app.periodic(cron="0 22 * * *")  # 03:00 Asia/Tashkent
@app.task(queue="default")
def expire_bonuses(timestamp: int) -> None:
    count = services.expire_bonuses()
    logger.info("expired signup bonuses: %s wallets", count)


@app.periodic(cron="30 22 * * *")  # 03:30 Asia/Tashkent
@app.task(queue="default")
def reconcile_wallets(timestamp: int) -> None:
    problems = services.reconcile()
    if problems:
        # Surfaces in logs/monitoring; money must never be "fixed" automatically.
        logger.error("wallet reconcile found %s mismatches: %s", len(problems), problems[:20])
