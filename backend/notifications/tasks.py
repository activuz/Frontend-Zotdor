from procrastinate.contrib.django import app

from notifications import services


@app.task(queue="default", queueing_lock="send_outbox")
def send_outbox() -> None:
    services.send_pending()


@app.periodic(cron="* * * * *")
@app.task(queue="default")
def send_outbox_periodic(timestamp: int) -> None:
    services.send_pending()


@app.periodic(cron="* * * * *")
@app.task(queue="default", queueing_lock="send_reminders")
def send_reminders(timestamp: int) -> None:
    services.send_reminders()
