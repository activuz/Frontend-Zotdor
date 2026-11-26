from procrastinate.contrib.django import app

from notifications import services


@app.task(queue="default", queueing_lock="send_outbox")
def send_outbox() -> None:
    services.send_pending()


@app.periodic(cron="* * * * *")
@app.task(queue="default")
def send_outbox_periodic(timestamp: int) -> None:
    services.send_pending()


@app.task(queue="default")
def send_push(notification_id: int) -> None:
    """One job per notification: browsers (Web Push) and the Android app (FCM)."""
    services.send_web_push(notification_id)
    services.send_fcm(notification_id)


@app.periodic(cron="* * * * *")
@app.task(queue="default", queueing_lock="send_reminders")
def send_reminders(timestamp: int) -> None:
    services.send_reminders()
