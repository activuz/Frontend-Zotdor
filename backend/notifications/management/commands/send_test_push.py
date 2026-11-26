"""Check push end to end for one user: `python manage.py send_test_push +998901234567`.

Prints whether browser push (VAPID) and app push (Firebase) are configured, how many browsers
and installed apps the user has, then sends a test notification and reports how many arrived at
the push services. Run it in the Render shell of the API or the worker (docs/DEPLOYMENT.md).
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from accounts.phone import normalize_phone
from notifications import services
from notifications.models import DeviceToken, Notification, PushSubscription


class Command(BaseCommand):
    help = "Send a test push to one user and report what happened."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("phone")

    def handle(self, *args: Any, **options: Any) -> None:
        phone = normalize_phone(options["phone"])
        user = User.objects.filter(phone=phone).first() if phone else None
        if user is None:
            raise CommandError("Bunday telefon raqamli foydalanuvchi topilmadi.")

        browsers = PushSubscription.objects.filter(user=user).count()
        apps = DeviceToken.objects.filter(user=user).count()
        self.stdout.write(f"Brauzer push (VAPID) sozlangan: {'ha' if services.push_enabled() else 'YOʻQ'}")
        self.stdout.write(f"Ilova push (Firebase) sozlangan: {'ha' if services.fcm_enabled() else 'YOʻQ'}")
        self.stdout.write(f"Foydalanuvchida: {browsers} ta brauzer obunasi, {apps} ta ilova")
        if apps == 0:
            self.stdout.write(
                "  Ilova tokeni yoʻq: ilovaga shu raqam bilan kiring; ilova Firebase tokenini "
                "kirgandan keyin yuboradi."
            )

        n = Notification.objects.create(
            user=user,
            type="test",
            title="Sinov bildirishnomasi",
            body="Zotdor bildirishnomalari ishlayapti.",
            link="/notifications",
        )
        web = services.send_web_push(n.id)
        app = services.send_fcm(n.id)
        self.stdout.write(f"Yuborildi: {web} ta brauzerga, {app} ta ilovaga (xatolar yuqoridagi logda)")
