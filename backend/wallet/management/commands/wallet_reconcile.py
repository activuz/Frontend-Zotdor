from typing import Any

from django.core.management.base import BaseCommand, CommandError

from wallet.services import reconcile


class Command(BaseCommand):
    help = "Check that cached wallet balances match the ledger and active holds."

    def handle(self, *args: Any, **options: Any) -> None:
        problems = reconcile()
        if not problems:
            self.stdout.write(self.style.SUCCESS("All wallets match the ledger."))
            return
        for p in problems:
            self.stderr.write(f"{p.user_id} {p.field}: cached={p.cached} ledger={p.ledger}")
        raise CommandError(f"{len(problems)} mismatches")
