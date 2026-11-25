from procrastinate.contrib.django import app

from deals import services


@app.periodic(cron="15 * * * *")
@app.task(queue="default")
def complete_due_deals(timestamp: int) -> None:
    services.complete_due_deals()
