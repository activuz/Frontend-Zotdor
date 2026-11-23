import logging

from procrastinate.contrib.django import app

from auctions import media as media_store
from auctions import services
from auctions.models import AuctionMedia
from core.models import PlatformSettings

logger = logging.getLogger(__name__)


@app.periodic(cron="* * * * *")
@app.task(queue="default", queueing_lock="auction_tick")
def auction_tick(timestamp: int) -> None:
    counts = services.tick()
    if any(counts.values()):
        logger.info("auction tick: %s", counts)


@app.task(queue="media")
def process_video(media_id: str) -> None:
    item = AuctionMedia.objects.filter(id=media_id, status=AuctionMedia.MediaStatus.PROCESSING).first()
    if item is not None:
        media_store.process(item, PlatformSettings.load().video_max_s)
