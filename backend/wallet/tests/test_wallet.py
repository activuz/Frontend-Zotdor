"""Money rules (BR-40..46) and ledger integrity — docs/TESTING.md "Pul"."""

from __future__ import annotations

import threading
import uuid
from datetime import timedelta

import pytest
import time_machine
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from core.errors import DomainError
from core.models import PlatformSettings
from notifications.models import Notification, TelegramOutbox
from wallet import services
from wallet.models import Bucket, EntryType, Hold, Wallet, WalletEntry

pytestmark = pytest.mark.django_db

AUCTION = "auction"


@pytest.fixture
def admin() -> User:
    return User.objects.create_user(phone="+998909999999", role=User.Role.ADMIN)


def make_user(phone: str = "+998901234567") -> User:
    return User.objects.create_user(phone=phone, first_name="Ali")


def topup(user: User, amount: int, admin: User) -> None:
    services.adjust(user, Bucket.MAIN, amount, actor=admin, note="test top-up")


def wallet_of(user: User) -> Wallet:
    return Wallet.objects.get(user=user)


def assert_consistent() -> None:
    assert services.reconcile() == []


# --- rounding -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("amount", "expected"),
    [(25_000_000, 50_000), (23_500_000, 47_000), (3_333_333, 6_667), (1, 1), (0, 0)],
)
def test_commission_rounds_up_to_whole_som(amount: int, expected: int) -> None:
    assert services.commission_for(amount, 20) == expected


# --- signup bonus -----------------------------------------------------------------------------


def test_signup_bonus_granted_once() -> None:
    user = make_user()
    assert services.grant_signup_bonus(user) is not None
    assert services.grant_signup_bonus(user) is None
    w = wallet_of(user)
    assert w.bonus_balance == 50_000
    assert w.bonus_expires_at is not None
    assert w.bonus_expires_at - timezone.now() > timedelta(days=89)
    assert_consistent()


def test_signup_bonus_follows_settings() -> None:
    PlatformSettings.objects.update_or_create(id=1, defaults={"signup_bonus": 30_000, "bonus_ttl_days": 10})
    user = make_user()
    services.grant_signup_bonus(user)
    assert wallet_of(user).bonus_balance == 30_000


def test_expired_bonus_burns_and_unexpired_stays() -> None:
    old, fresh = make_user(), make_user("+998901111111")
    services.grant_signup_bonus(old)
    with time_machine.travel(timezone.now() + timedelta(days=60)):
        services.grant_signup_bonus(fresh)
    with time_machine.travel(timezone.now() + timedelta(days=91)):
        assert services.expire_bonuses() == 1
    assert wallet_of(old).bonus_balance == 0
    assert wallet_of(fresh).bonus_balance == 50_000
    assert WalletEntry.objects.filter(user=old, type=EntryType.BONUS_EXPIRE, amount=-50_000).exists()
    assert_consistent()


# --- holds and commission --------------------------------------------------------------------


def test_hold_reduces_available_and_release_restores_it() -> None:
    user = make_user()
    services.grant_signup_bonus(user)
    ref = uuid.uuid4()
    services.hold(user, AUCTION, ref, 50_000)
    w = wallet_of(user)
    assert (w.held_amount, w.available) == (50_000, 0)

    services.release_hold(AUCTION, ref)
    w = wallet_of(user)
    assert (w.held_amount, w.available, w.bonus_balance) == (0, 50_000, 50_000)
    assert Hold.objects.get(ref_id=ref).status == Hold.Status.RELEASED
    assert_consistent()


def test_hold_refused_when_not_enough_money() -> None:
    user = make_user()
    services.grant_signup_bonus(user)
    with pytest.raises(DomainError) as err:
        services.hold(user, AUCTION, uuid.uuid4(), 50_001)
    assert err.value.code == "insufficient_balance"
    assert not Hold.objects.exists()


def test_capture_takes_bonus_first_then_main_and_returns_the_rest(admin: User) -> None:
    user = make_user()
    services.grant_signup_bonus(user)  # 50 000 bonus
    topup(user, 100_000, admin)
    ref, deal = uuid.uuid4(), uuid.uuid4()
    services.hold(user, AUCTION, ref, 60_000)  # 0.2% of a 30 000 000 asking price

    charge = services.capture_commission(AUCTION, ref, 70_000, charge_ref_type="deal", charge_ref_id=deal)

    assert (charge.from_bonus, charge.from_main) == (50_000, 20_000)
    w = wallet_of(user)
    assert (w.bonus_balance, w.main_balance, w.held_amount) == (0, 80_000, 0)
    assert Hold.objects.get(ref_id=ref).status == Hold.Status.CAPTURED
    assert_consistent()


def test_commission_above_balance_creates_debt_and_blocks_new_holds(admin: User) -> None:
    user = make_user()
    services.grant_signup_bonus(user)
    ref = uuid.uuid4()
    services.hold(user, AUCTION, ref, 50_000)
    # Accepted bid was far above the asking price (BR-42).
    services.capture_commission(AUCTION, ref, 62_000, charge_ref_type="deal", charge_ref_id=uuid.uuid4())

    w = wallet_of(user)
    assert w.main_balance == -12_000
    assert w.has_debt
    with pytest.raises(DomainError) as err:
        services.hold(user, AUCTION, uuid.uuid4(), 1_000)
    assert err.value.code == "wallet_debt"

    topup(user, 20_000, admin)  # paying off the debt makes new holds possible again
    services.hold(user, AUCTION, uuid.uuid4(), 1_000)
    assert_consistent()


def test_debt_blocks_hold_even_with_bonus_available(admin: User) -> None:
    user = make_user()
    topup(user, 10_000, admin)
    ref = uuid.uuid4()
    services.hold(user, AUCTION, ref, 10_000)
    services.capture_commission(AUCTION, ref, 15_000, charge_ref_type="deal", charge_ref_id=uuid.uuid4())
    services.grant_signup_bonus(user)  # available is positive, but main is in debt
    with pytest.raises(DomainError) as err:
        services.hold(user, AUCTION, uuid.uuid4(), 1_000)
    assert err.value.code == "wallet_debt"


def test_release_or_capture_twice_is_rejected(admin: User) -> None:
    user = make_user()
    topup(user, 100_000, admin)
    ref = uuid.uuid4()
    services.hold(user, AUCTION, ref, 10_000)
    services.release_hold(AUCTION, ref)
    with pytest.raises(ValueError):
        services.release_hold(AUCTION, ref)
    with pytest.raises(ValueError):
        services.capture_commission(AUCTION, ref, 10_000, charge_ref_type="deal", charge_ref_id=uuid.uuid4())
    assert_consistent()


# --- manual adjustments -----------------------------------------------------------------------


def test_adjust_requires_note_and_never_touches_holds(admin: User) -> None:
    user = make_user()
    with pytest.raises(DomainError):
        services.adjust(user, Bucket.MAIN, 1000, actor=admin, note="  ")
    with pytest.raises(ValueError):
        services.adjust(user, Bucket.HOLD, 1000, actor=admin, note="x")


def test_bonus_cannot_be_adjusted_below_zero(admin: User) -> None:
    with pytest.raises(DomainError):
        services.adjust(make_user(), Bucket.BONUS, -1, actor=admin, note="x")


def test_adjustment_records_actor_and_note(admin: User) -> None:
    entry = services.adjust(make_user(), Bucket.MAIN, 25_000, actor=admin, note="Qoʻlda toʻldirish")
    assert entry.actor == admin
    assert entry.balance_after == 25_000


# --- integrity ----------------------------------------------------------------------------------


def test_reconcile_detects_direct_balance_tampering(admin: User) -> None:
    user = make_user()
    topup(user, 10_000, admin)
    Wallet.objects.filter(user=user).update(main_balance=99_999)  # bypassing services
    assert [p.field for p in services.reconcile()] == ["main_balance"]


@pytest.mark.django_db(transaction=True)
def test_parallel_holds_cannot_overspend() -> None:
    """Two requests race to reserve 40 000 each from 50 000: exactly one may win."""
    user = make_user()
    services.grant_signup_bonus(user)
    results: list[str] = []
    barrier = threading.Barrier(2)

    def attempt() -> None:
        try:
            barrier.wait()
            services.hold(user, AUCTION, uuid.uuid4(), 40_000)
            results.append("ok")
        except DomainError as exc:
            results.append(exc.code)
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results) == ["insufficient_balance", "ok"]
    assert wallet_of(user).held_amount == 40_000
    assert_consistent()


# --- login integration and API -------------------------------------------------------------


def test_new_account_from_login_gets_bonus(telegram_settings: object) -> None:
    from accounts.services import SharedContact, bind_telegram, complete_login, start_login, verify_contact

    started = start_login("+998901234567", ip=None)
    token = started.deep_link.rsplit("=", 1)[1]
    bind_telegram(token, 777)
    verify_contact(SharedContact(from_user_id=777, contact_user_id=777, phone_number="998901234567"))
    result = complete_login(started.request.id, started.poll_secret)
    assert result.user is not None
    assert wallet_of(result.user).bonus_balance == 50_000
    note = Notification.objects.get(user=result.user, type="bonus_granted")
    assert "50 000" in note.title and note.link == "/wallet"
    assert TelegramOutbox.objects.filter(chat_id=777, text__contains="bonus").exists()


@pytest.mark.parametrize(("commission", "expected"), [(40_000, 2_000), (18_000, 900), (19, 0), (0, 0)])
def test_cashback_is_five_percent_of_commission_rounded_down(commission: int, expected: int) -> None:
    assert services.cashback_for(commission, 5) == expected


def test_cashback_accumulates_and_extends_whole_bonus_expiry() -> None:
    user = make_user()
    services.grant_signup_bonus(user)
    first_expiry = wallet_of(user).bonus_expires_at
    assert first_expiry is not None
    deal1, deal2 = uuid.uuid4(), uuid.uuid4()
    with time_machine.travel(timezone.now() + timedelta(days=60)):
        assert services.grant_cashback(user, 40_000, deal1) == 2_000
        assert services.grant_cashback(user, 40_000, deal1) == 0  # once per deal
        assert services.grant_cashback(user, 20_000, deal2) == 1_000
        w = wallet_of(user)
        assert w.bonus_balance == 53_000  # not a one-time bonus: it keeps growing
        assert w.bonus_expires_at is not None and w.bonus_expires_at > first_expiry + timedelta(days=59)
    # The signup part would have burned at day 90; the fresh cashback moved the whole expiry.
    with time_machine.travel(timezone.now() + timedelta(days=100)):
        assert services.expire_bonuses() == 0
    assert_consistent()


def test_cashback_follows_settings() -> None:
    s = PlatformSettings.load()
    s.cashback_pct = 0
    s.save()
    user = make_user()
    assert services.grant_cashback(user, 40_000, uuid.uuid4()) == 0
    assert not WalletEntry.objects.filter(user=user, type=EntryType.BONUS_CASHBACK).exists()


def test_reverse_cashback_never_makes_bonus_negative(admin: User) -> None:
    user = make_user()
    deal = uuid.uuid4()
    services.grant_cashback(user, 40_000, deal)  # +2 000 bonus
    services.adjust(user, Bucket.BONUS, -1_500, actor=admin, note="spent elsewhere")
    assert services.reverse_cashback(user, deal, actor=admin) == 500
    assert services.reverse_cashback(user, deal, actor=admin) == 0
    assert wallet_of(user).bonus_balance == 0
    assert_consistent()


def test_wallet_api_shows_balances() -> None:
    user = make_user()
    services.grant_signup_bonus(user)
    client = APIClient()
    client.force_authenticate(user)
    body = client.get("/api/v1/wallet").json()
    assert body["bonus_balance"] == 50_000
    assert body["available"] == 50_000
    assert body["has_debt"] is False


def test_entries_api_lists_only_own_entries_newest_first(admin: User) -> None:
    me, other = make_user(), make_user("+998935550000")
    services.grant_signup_bonus(me)
    services.grant_signup_bonus(other)
    topup(me, 5_000, admin)
    client = APIClient()
    client.force_authenticate(me)
    body = client.get("/api/v1/wallet/entries").json()
    assert [e["title"] for e in body["results"]] == ["Administrator tuzatishi", "Roʻyxatdan oʻtish bonusi"]
    assert "next" in body


def test_wallet_requires_login() -> None:
    assert APIClient().get("/api/v1/wallet").status_code in (401, 403)
