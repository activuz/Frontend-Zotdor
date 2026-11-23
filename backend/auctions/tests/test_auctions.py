"""Marketplace flows: auctions, bids, decision, deals, payments, panel (docs/TESTING.md)."""

from __future__ import annotations

import hashlib
import io
import random
import uuid
from datetime import timedelta
from typing import Any
from unittest.mock import patch

import pytest
import time_machine
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image, ImageDraw
from rest_framework.test import APIClient

from accounts.models import User
from auctions import services
from auctions.models import Auction, AuctionMedia, Bid, Status
from core.errors import DomainError
from core.models import StaffAuditLog
from deals import services as deal_services
from deals.models import Deal
from notifications.models import Notification, TelegramOutbox
from payments import services as payment_services
from payments.models import Payment, RefundRequest
from reference.models import AnimalClass, AnimalType, Direction, District
from wallet import services as wallet
from wallet.models import Bucket, Wallet

pytestmark = pytest.mark.django_db

PRICE = 10_000_000  # hold = 0.2% = 20 000


@pytest.fixture(autouse=True)
def _media_root(settings: Any, tmp_path: Any, load_reference_data: None) -> None:
    settings.MEDIA_ROOT = str(tmp_path)


def make_user(phone: str, district_name: str = "Zangiota tumani", **extra: Any) -> User:
    district = District.objects.get(name=district_name)
    user = User.objects.create_user(
        phone=phone, first_name="Test", region=district.region, district=district, **extra
    )
    wallet.grant_signup_bonus(user)
    return user


@pytest.fixture
def seller() -> User:
    return make_user("+998901000001")


@pytest.fixture
def buyer() -> User:
    return make_user("+998901000002", "Chilonzor tumani")


@pytest.fixture
def far_buyer() -> User:
    return make_user("+998901000003", "Nukus shahri")


@pytest.fixture
def moderator() -> User:
    return User.objects.create_user(phone="+998909000001", role=User.Role.MODERATOR, first_name="Mod")


@pytest.fixture
def admin() -> User:
    return User.objects.create_user(phone="+998909000002", role=User.Role.ADMIN, first_name="Adm")


def photo(seed: int) -> SimpleUploadedFile:
    rnd = random.Random(seed)  # noqa: S311 - test data
    img = Image.new("RGB", (1280, 960), (rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255)))
    draw = ImageDraw.Draw(img)
    for _ in range(25):
        x, y = rnd.randint(0, 1200), rnd.randint(0, 900)
        color = (rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255))
        draw.rectangle([x, y, x + rnd.randint(20, 300), y + rnd.randint(20, 300)], fill=color)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return SimpleUploadedFile(f"p{seed}.jpg", buf.getvalue(), content_type="image/jpeg")


def taxonomy() -> dict[str, Any]:
    t = AnimalType.objects.get(slug="qoramol")
    return {
        "direction": Direction.objects.get(slug="gosht"),
        "animal_type": t,
        "animal_class": AnimalClass.objects.get(animal_type=t, name="Sigir"),
        "age_months": 36,
        "weight_kg": 450,
        "asking_price": PRICE,
        "duration_minutes": 60,
        "start_now": True,
        "description": "Sogʻlom, emlangan sigir.",
    }


def draft_with_media(user: User, seed: int = 1, photos: int = 4, video: bool = True, **over: Any) -> Auction:
    a = services.create_draft(user, {**taxonomy(), **over})
    session = services.open_capture_session(a.id, user)
    for i in range(photos):
        services.add_media(a.id, user, photo(seed * 100 + i), "photo", session.id, {})
    if video:
        AuctionMedia.objects.create(
            auction=a,
            capture_session=session,
            kind="video",
            status="ready",
            original_path="x",
            file_path="v.mp4",
        )
    return a


def live_auction(user: User, **over: Any) -> Auction:
    a = draft_with_media(user, **over)
    result = services.submit(a.id, user)
    assert result.outcome == "published", [r.message for r in result.results]
    return Auction.objects.get(id=a.id)


def available(user: User) -> int:
    return Wallet.objects.get(user=user).available


# --- creation and checks ------------------------------------------------------------------------


def test_title_is_generated_from_fields(seller: User) -> None:
    a = services.create_draft(seller, taxonomy())
    assert a.title == "Qoramol · Sigir · 3 yosh"
    assert a.district == seller.district


def test_photos_are_processed(seller: User) -> None:
    a = draft_with_media(seller, photos=1, video=False)
    m = a.media.get()
    assert m.status == "ready" and m.file_path.endswith(".webp") and m.thumb_path
    assert m.phash is not None and m.width == 1280


def test_upload_needs_live_capture_session(seller: User) -> None:
    a = services.create_draft(seller, taxonomy())
    session = services.open_capture_session(a.id, seller)
    with time_machine.travel(timezone.now() + timedelta(minutes=21)), pytest.raises(DomainError) as err:
        services.add_media(a.id, seller, photo(1), "photo", session.id, {})
    assert err.value.code == "capture_session_expired"


def test_storage_failure_is_503_not_a_bad_file(seller: User) -> None:
    from auctions import storage

    a = services.create_draft(seller, taxonomy())
    session = services.open_capture_session(a.id, seller)
    with (
        patch("auctions.storage.save", side_effect=storage.StorageError("Nhost storage POST 403")),
        pytest.raises(DomainError) as err,
    ):
        services.add_media(a.id, seller, photo(1), "photo", session.id, {})
    assert (err.value.code, err.value.http_status) == ("storage_unavailable", 503)
    assert not a.media.exists()


def test_too_large_upload_is_413(seller: User, settings: Any) -> None:
    settings.PHOTO_MAX_BYTES = 10
    a = services.create_draft(seller, taxonomy())
    session = services.open_capture_session(a.id, seller)
    with pytest.raises(DomainError) as err:
        services.add_media(a.id, seller, photo(1), "photo", session.id, {})
    assert (err.value.code, err.value.http_status) == ("file_too_large", 413)


def test_non_image_upload_fails_processing(seller: User) -> None:
    a = services.create_draft(seller, taxonomy())
    session = services.open_capture_session(a.id, seller)
    fake = SimpleUploadedFile("x.jpg", b"not an image", content_type="image/jpeg")
    item = services.add_media(a.id, seller, fake, "photo", session.id, {})
    item.refresh_from_db()
    assert item.status == "failed" and item.error


def test_submit_publishes_and_holds_commission(seller: User) -> None:
    a = live_auction(seller)
    assert a.status == Status.LIVE
    assert (a.hold_amount, a.min_bid, a.max_bid) == (20_000, 5_000_000, 30_000_000)
    assert available(seller) == 30_000
    assert wallet.reconcile() == []


@pytest.mark.parametrize(
    "description",
    ["Tel: 90 123 45 67", "Telegram: @chorvador_ali", "batafsil t.me/zotdor_test", "+998 (93) 555-12-34"],
)
def test_contacts_in_description_are_rejected(seller: User, description: str) -> None:
    a = draft_with_media(seller, description=description)
    assert services.submit(a.id, seller).outcome == "rejected"
    assert available(seller) == 50_000  # no hold


def test_prices_in_description_are_not_phone_numbers(seller: User) -> None:
    a = draft_with_media(seller, description="Oldin 95 000 000 soʻmga soʻragan edim, 450 kg.")
    assert services.submit(a.id, seller).outcome == "published"


def test_profanity_is_rejected(seller: User) -> None:
    a = draft_with_media(seller, description="Sotaman, suka")
    assert services.submit(a.id, seller).outcome == "rejected"


def test_missing_media_is_rejected_with_reason(seller: User) -> None:
    a = draft_with_media(seller, photos=2, video=False)
    assert services.submit(a.id, seller).outcome == "rejected"
    assert "rasm" in Auction.objects.get(id=a.id).rejection_reason


def test_insufficient_balance_blocks_publishing(seller: User) -> None:
    a = draft_with_media(seller, asking_price=50_000_000)  # hold 100 000 > 50 000 bonus
    with pytest.raises(DomainError) as err:
        services.submit(a.id, seller)
    assert err.value.code == "insufficient_balance"
    assert Auction.objects.get(id=a.id).status == Status.DRAFT


def test_copied_photos_go_to_moderation(seller: User, buyer: User, moderator: User) -> None:
    live_auction(buyer, seed=7)
    copy = draft_with_media(seller, seed=7)
    assert services.submit(copy.id, seller).outcome == "pending_review"
    assert available(seller) == 30_000  # held while in review

    services.reject(copy.id, moderator, "Rasmlar boshqa eʼlondan olingan")
    assert Auction.objects.get(id=copy.id).status == Status.REJECTED
    assert available(seller) == 50_000

    other = draft_with_media(seller, seed=7)
    services.submit(other.id, seller)
    services.approve(other.id, moderator)
    assert Auction.objects.get(id=other.id).status == Status.LIVE


def test_scheduled_auction_starts_on_tick(seller: User) -> None:
    start = timezone.now() + timedelta(hours=2)
    a = draft_with_media(seller, start_now=False, starts_at=start)
    assert services.submit(a.id, seller).outcome == "published"
    assert Auction.objects.get(id=a.id).status == Status.SCHEDULED
    with time_machine.travel(start + timedelta(seconds=5)):
        assert services.tick()["started"] == 1
    assert Auction.objects.get(id=a.id).status == Status.LIVE


def test_schedule_more_than_7_days_ahead_is_refused(seller: User) -> None:
    a = draft_with_media(seller, start_now=False, starts_at=timezone.now() + timedelta(days=8))
    with pytest.raises(DomainError) as err:
        services.submit(a.id, seller)
    assert err.value.code == "invalid_start"


# --- bidding -------------------------------------------------------------------------------------


def test_bid_limits_and_ownership(seller: User, buyer: User) -> None:
    a = live_auction(seller)
    for amount, code in ((4_999_999, "bid_too_low"), (30_000_001, "bid_too_high")):
        with pytest.raises(DomainError) as err:
            services.place_bid(a.id, buyer, amount)
        assert err.value.code == code
    with pytest.raises(DomainError) as err:
        services.place_bid(a.id, seller, 9_000_000)
    assert err.value.code == "own_auction"
    services.place_bid(a.id, buyer, 5_000_000)  # boundary accepted


def test_rebid_supersedes_and_tiers_rank_by_amount(seller: User) -> None:
    a = live_auction(seller)
    bidders = [make_user(f"+99890200000{i}", "Chilonzor tumani") for i in range(5)]
    for i, b in enumerate(bidders):
        services.place_bid(a.id, b, 6_000_000 + i * 100_000)
    with time_machine.travel(timezone.now() + timedelta(seconds=11)):
        services.place_bid(a.id, bidders[0], 9_000_000)  # lowest bidder jumps to the top
    ranked = services.ranked_bids(a)
    assert [r.tier for r in ranked] == ["green", "yellow", "yellow", "red", "red"]
    assert ranked[0].bid.bidder == bidders[0] and ranked[0].pseudonym == "Xaridor #1"
    assert Bid.objects.filter(auction=a, bidder=bidders[0], status="active").count() == 1
    assert Notification.objects.filter(user=bidders[4], type="outbid").exists()
    a.refresh_from_db()
    assert (a.top_bid_amount, a.active_bids_count, a.bidders_count) == (9_000_000, 5, 5)


def test_rapid_rebid_is_rate_limited(seller: User, buyer: User) -> None:
    a = live_auction(seller)
    services.place_bid(a.id, buyer, 6_000_000)
    with pytest.raises(DomainError) as err:
        services.place_bid(a.id, buyer, 6_100_000)
    assert err.value.code == "rate_limited"


def test_no_bid_after_end_even_if_worker_is_late(seller: User, buyer: User) -> None:
    a = live_auction(seller)
    # The bid check uses the database clock (NFR-03), so move ends_at instead of the Python clock.
    Auction.objects.filter(id=a.id).update(ends_at=timezone.now() - timedelta(seconds=1))
    assert Auction.objects.get(id=a.id).status == Status.LIVE  # tick has not run
    with pytest.raises(DomainError) as err:
        services.place_bid(a.id, buyer, 6_000_000)
    assert err.value.code == "auction_not_live"


# --- decision and deal -------------------------------------------------------------------------


def test_end_accept_charges_commission_and_reveals_contacts(
    seller: User, buyer: User, far_buyer: User
) -> None:
    a = live_auction(seller)
    services.place_bid(a.id, buyer, 9_000_000)
    services.place_bid(a.id, far_buyer, 12_000_000)
    with time_machine.travel(timezone.now() + timedelta(minutes=61)):
        assert services.tick()["ended"] == 1
        rows, recommended = services.decision_rows(Auction.objects.get(id=a.id))
        assert {r.ranked.bid.bidder for r in recommended} == {buyer, far_buyer}
        nearest = min((r for r in rows if r.distance_km is not None), key=lambda r: r.distance_km or 0)
        assert nearest.ranked.bid.bidder == buyer
        bid = Bid.objects.get(auction=a, bidder=buyer)
        deal = services.accept_bid(a.id, seller, bid.id)  # a lower but nearer bid (BR-31)

    assert deal.price == 9_000_000 and deal.commission_amount == 18_000
    w = Wallet.objects.get(user=seller)
    assert (w.bonus_balance, w.held_amount) == (32_000, 0)
    assert Auction.objects.get(id=a.id).status == Status.SOLD
    assert Notification.objects.filter(user=far_buyer, type="bid_not_selected").exists()

    client = APIClient()
    client.force_authenticate(buyer)
    body = client.get(f"/api/v1/deals/{deal.id}").json()
    assert body["counterparty"]["phone"] == seller.phone
    assert body["commission_amount"] is None  # only the seller sees the commission
    stranger = APIClient()
    stranger.force_authenticate(far_buyer)
    assert stranger.get(f"/api/v1/deals/{deal.id}").status_code == 404
    assert wallet.reconcile() == []


def test_early_accept_needs_ten_minutes(seller: User, buyer: User, far_buyer: User) -> None:
    a = live_auction(seller)
    services.place_bid(a.id, buyer, 7_000_000)
    bid = Bid.objects.get(auction=a)
    with pytest.raises(DomainError) as err:
        services.accept_bid(a.id, seller, bid.id)
    assert err.value.code == "early_accept_too_soon"
    with time_machine.travel(timezone.now() + timedelta(minutes=11)):
        services.accept_bid(a.id, seller, bid.id)
        a.refresh_from_db()
        assert a.status == Status.SOLD and a.ends_at is not None and a.ends_at <= timezone.now()
        with pytest.raises(DomainError) as err:
            services.place_bid(a.id, far_buyer, 8_000_000)
        assert err.value.code == "auction_not_live"


def test_no_bids_ends_unsold_and_releases_hold(seller: User) -> None:
    a = live_auction(seller)
    with time_machine.travel(timezone.now() + timedelta(minutes=61)):
        services.tick()
    assert Auction.objects.get(id=a.id).status == Status.UNSOLD
    assert available(seller) == 50_000


def test_decision_window_expiry_and_reject_all(seller: User, buyer: User) -> None:
    a = live_auction(seller)
    b = live_auction(seller, seed=3)
    services.place_bid(a.id, buyer, 6_000_000)
    with time_machine.travel(timezone.now() + timedelta(seconds=11)):
        services.place_bid(b.id, buyer, 6_000_000)
    with time_machine.travel(timezone.now() + timedelta(minutes=61)):
        services.tick()
        services.reject_all(b.id, seller)
    with time_machine.travel(timezone.now() + timedelta(hours=50)):
        assert services.tick()["expired"] == 1
    assert Auction.objects.get(id=a.id).status == Status.UNSOLD
    assert Auction.objects.get(id=b.id).status == Status.UNSOLD
    assert available(seller) == 50_000
    assert wallet.reconcile() == []


def test_cancel_rules(seller: User, buyer: User) -> None:
    a = live_auction(seller)
    services.cancel(a.id, seller, "fikrim oʻzgardi")
    assert available(seller) == 50_000
    b = live_auction(seller, seed=2)
    services.place_bid(b.id, buyer, 6_000_000)
    with pytest.raises(DomainError) as err:
        services.cancel(b.id, seller)
    assert err.value.code == "has_bids"


def test_block_voids_bids_and_releases_hold(seller: User, buyer: User, moderator: User) -> None:
    a = live_auction(seller)
    services.place_bid(a.id, buyer, 6_000_000)
    services.block(a.id, moderator, "soxta eʼlon")
    assert Bid.objects.get(auction=a).status == "void"
    assert available(seller) == 50_000


def sold_deal(seller: User, buyer: User) -> Deal:
    a = live_auction(seller)
    services.place_bid(a.id, buyer, 8_000_000)
    with time_machine.travel(timezone.now() + timedelta(minutes=61)):
        services.tick()
        return services.accept_bid(a.id, seller, Bid.objects.get(auction=a).id)


def test_mutual_ratings_and_single_rating(seller: User, buyer: User) -> None:
    deal = sold_deal(seller, buyer)
    deal_services.rate(deal.id, buyer, 5, "Yaxshi sotuvchi")
    deal_services.rate(deal.id, seller, 4)
    seller.refresh_from_db()
    buyer.refresh_from_db()
    assert (float(seller.rating_avg or 0), seller.rating_count, seller.deals_count) == (5.0, 1, 1)
    assert float(buyer.rating_avg or 0) == 4.0
    with pytest.raises(DomainError):
        deal_services.rate(deal.id, buyer, 1)


def test_approved_claim_refunds_commission(seller: User, buyer: User, moderator: User) -> None:
    deal = sold_deal(seller, buyer)
    assert available(seller) == 50_000 - 16_000
    with pytest.raises(DomainError):
        deal_services.file_claim(deal.id, buyer, "men xaridorman")  # only the seller
    claim = deal_services.file_claim(deal.id, seller, "Xaridor kelmadi")
    deal_services.resolve_claim(claim.id, moderator, approve=True, note="Tasdiqlandi")
    assert available(seller) == 50_000
    assert Deal.objects.get(id=deal.id).status == "failed"
    assert wallet.reconcile() == []


# --- payments -----------------------------------------------------------------------------------


def click_params(payment: Payment, action: str, trans: int = 777, **over: str) -> dict[str, str]:
    p = {
        "click_trans_id": str(trans),
        "service_id": "123",
        "click_paydoc_id": "555",
        "merchant_trans_id": str(payment.id),
        "amount": f"{payment.amount}.00",
        "action": action,
        "error": "0",
        "error_note": "Success",
        "sign_time": "2026-11-23 10:00:00",
    }
    if action == "1":
        p["merchant_prepare_id"] = str(trans)
    p.update(over)
    prepare = p.get("merchant_prepare_id", "") if action == "1" else ""
    raw = (
        f"{p['click_trans_id']}{p['service_id']}secret{p['merchant_trans_id']}"
        f"{prepare}{p['amount']}{action}{p['sign_time']}"
    )
    p["sign_string"] = hashlib.md5(raw.encode()).hexdigest()  # noqa: S324
    return p


@pytest.fixture
def click_settings(settings: Any) -> Any:
    settings.PAYMENTS_PROVIDER = "click"
    settings.CLICK_SERVICE_ID = "123"
    settings.CLICK_MERCHANT_ID = "456"
    settings.CLICK_SECRET_KEY = "secret"
    return settings


def test_click_prepare_complete_is_idempotent(click_settings: Any, buyer: User) -> None:
    payment, url = payment_services.start_topup(buyer, 100_000)
    assert url.startswith("https://my.click.uz/services/pay?")
    assert payment_services.click_prepare(click_params(payment, "0"))["error"] == 0
    first = payment_services.click_complete(click_params(payment, "1"))
    again = payment_services.click_complete(click_params(payment, "1"))
    assert (first["error"], again["error"]) == (0, -4)
    assert Wallet.objects.get(user=buyer).main_balance == 100_000
    assert wallet.reconcile() == []


def test_click_rejects_bad_sign_and_amount(click_settings: Any, buyer: User) -> None:
    payment, _ = payment_services.start_topup(buyer, 100_000)
    bad = click_params(payment, "0")
    bad["sign_string"] = "0" * 32
    assert payment_services.click_prepare(bad)["error"] == -1
    assert payment_services.click_prepare(click_params(payment, "0", amount="1.00"))["error"] == -2
    assert Payment.objects.get(id=payment.id).status == "created"


def test_click_cancelled_payment_does_not_credit(click_settings: Any, buyer: User) -> None:
    payment, _ = payment_services.start_topup(buyer, 50_000)
    payment_services.click_prepare(click_params(payment, "0"))
    assert payment_services.click_complete(click_params(payment, "1", error="-5017"))["error"] == -9
    assert Wallet.objects.get(user=buyer).main_balance == 0


def test_refund_request_flow(buyer: User, admin: User, moderator: User) -> None:
    wallet.adjust(buyer, Bucket.MAIN, 200_000, actor=admin, note="test")
    req = payment_services.create_refund_request(buyer, 150_000, "CLK-1", "Xato toʻladim")
    with pytest.raises(DomainError):
        payment_services.create_refund_request(buyer, 10_000, "CLK-2", "yana")
    payment_services.resolve_refund(req.id, moderator, done=True, note="Click kabinetidan qaytarildi")
    assert Wallet.objects.get(user=buyer).main_balance == 50_000
    assert RefundRequest.objects.get(id=req.id).status == "done"


# --- panel and notifications ----------------------------------------------------------------------


def test_panel_permissions_and_audit(seller: User, buyer: User, moderator: User, admin: User) -> None:
    live_auction(buyer, seed=9)
    a = draft_with_media(seller, seed=9)
    services.submit(a.id, seller)

    user_client, mod_client, admin_client = APIClient(), APIClient(), APIClient()
    user_client.force_authenticate(seller)
    mod_client.force_authenticate(moderator)
    admin_client.force_authenticate(admin)

    assert user_client.get("/api/panel/auctions").status_code == 403
    queue = mod_client.get("/api/panel/auctions").json()
    assert [row["id"] for row in queue["results"]] == [str(a.id)]
    assert mod_client.post(f"/api/panel/auctions/{a.id}/approve", {}, format="json").status_code == 200
    assert StaffAuditLog.objects.filter(action="auction.approve", target_id=str(a.id)).exists()

    assert mod_client.patch("/api/panel/settings", {"signup_bonus": 1}, format="json").status_code == 403
    assert (
        admin_client.patch("/api/panel/settings", {"commission_rate_bp": 30}, format="json").status_code
        == 200
    )
    assert StaffAuditLog.objects.filter(action="settings.update").exists()
    adj = admin_client.post(
        f"/api/panel/users/{buyer.id}/wallet/adjust",
        {"bucket": "main", "amount": 5000, "note": "qoʻlda"},
        format="json",
    )
    assert adj.status_code == 200 and adj.json()["main_balance"] == 5000


def test_telegram_outbox_is_sent_by_worker(seller: User) -> None:
    from notifications.services import notify, send_pending

    seller.telegram_user_id = 4242
    seller.save()
    notify(seller, "test", "Salom", "matn", "/a/1")
    with patch("telegram_bot.client.call") as call:
        assert send_pending() == 1
    call.assert_called_once()
    assert TelegramOutbox.objects.get().status == "sent"


# --- public API -------------------------------------------------------------------------------------


def test_feed_sorting_and_visibility(seller: User, buyer: User) -> None:
    near = live_auction(seller, seed=11)
    far_seller = make_user("+998901000099", "Nukus shahri")
    far = live_auction(far_seller, seed=12)
    draft = services.create_draft(seller, taxonomy())

    client = APIClient()
    client.force_authenticate(buyer)  # buyer lives in Chilonzor (Toshkent)
    ids = [r["id"] for r in client.get("/api/v1/auctions?sort=nearest").json()["results"]]
    assert ids == [str(near.id), str(far.id)]
    assert client.get(f"/api/v1/auctions/{draft.id}").status_code == 404
    anon = APIClient().get("/api/v1/auctions?sort=nearest")
    assert anon.status_code == 400 and anon.json()["error"]["code"] == "location_required"

    services.place_bid(near.id, buyer, 6_000_000)
    bids = APIClient().get(f"/api/v1/auctions/{near.id}/bids").json()
    assert bids[0]["tier"] == "green" and bids[0]["pseudonym"] == "Xaridor #1"
    assert "phone" not in str(bids)

    detail = client.get(f"/api/v1/auctions/{near.id}").json()
    assert detail["my_bid"]["rank"] == 1
    assert "phone" not in detail["seller"]


def test_watchlist_and_reports(seller: User, buyer: User) -> None:
    a = live_auction(seller)
    client = APIClient()
    client.force_authenticate(buyer)
    assert client.post(f"/api/v1/auctions/{a.id}/watch").status_code == 204
    assert [x["id"] for x in client.get("/api/v1/me/watchlist").json()] == [str(a.id)]
    report = {"target_type": "auction", "target_id": str(a.id), "reason": "fake"}
    assert client.post("/api/v1/reports", report, format="json").status_code == 201
    assert client.post("/api/v1/reports", report, format="json").status_code == 409


def test_unknown_ids_are_404(buyer: User) -> None:
    client = APIClient()
    client.force_authenticate(buyer)
    assert client.get(f"/api/v1/auctions/{uuid.uuid4()}").status_code == 404


def test_panel_responses_match_declared_schema(
    seller: User, buyer: User, moderator: User, admin: User
) -> None:
    """The panel app's TypeScript types come from panel_api.schemas; real responses must carry those keys."""
    from panel_api import schemas

    deal = sold_deal(seller, buyer)
    deal_services.file_claim(deal.id, seller, "Xaridor kelmadi")
    RefundRequest.objects.create(user=buyer, amount=10_000, click_reference="X1", reason="test")
    client = APIClient()
    client.force_authenticate(admin)

    assert client.patch("/api/panel/settings", {"signup_bonus": 50_000}, format="json").status_code == 200

    def keys(serializer: Any) -> set[str]:
        return set(serializer().fields.keys())

    assert keys(schemas.PanelStats) <= set(client.get("/api/panel/stats").json())
    for path, item in (
        ("/api/panel/auctions?status=all", schemas.PanelAuctionRow),
        ("/api/panel/claims", schemas.PanelClaim),
        ("/api/panel/refund-requests", schemas.PanelRefund),
        ("/api/panel/users", schemas.PanelUser),
        ("/api/panel/audit-log", schemas.PanelAuditRow),
    ):
        body = client.get(path).json()
        assert body["results"], path
        assert keys(item) <= set(body["results"][0]), path
    detail = client.get(f"/api/panel/auctions/{deal.auction_id}").json()
    assert keys(schemas.PanelAuctionDetail) <= set(detail)
    user = client.get(f"/api/panel/users/{seller.id}").json()
    assert keys(schemas.PanelUserDetail) <= set(user)


# --- reminders (F8) ---------------------------------------------------------------------------


def test_ending_soon_reminder_is_telegram_only_and_sent_once(seller: User, buyer: User) -> None:
    from notifications.services import send_reminders

    a = live_auction(seller)
    services.place_bid(a.id, buyer, 8_000_000)
    assert a.ends_at is not None
    with time_machine.travel(a.ends_at - timedelta(minutes=5)):
        assert send_reminders()["ending"] == 1
        assert send_reminders()["ending"] == 0
    assert not Notification.objects.filter(type="ending_soon").exists()


def test_seller_digest_at_most_every_30_minutes(seller: User, buyer: User, far_buyer: User) -> None:
    from notifications.services import send_reminders

    a = live_auction(seller)
    services.place_bid(a.id, buyer, 8_000_000)
    with time_machine.travel(timezone.now() + timedelta(minutes=5)):
        services.place_bid(a.id, far_buyer, 9_000_000)
        assert send_reminders()["digest"] == 0  # first_bid was just sent
    with time_machine.travel(timezone.now() + timedelta(minutes=31)):
        assert send_reminders()["digest"] == 1
        assert send_reminders()["digest"] == 0
    assert Notification.objects.filter(user=seller, type="bid_digest").count() == 1


def test_decision_rating_and_bonus_reminders(seller: User, buyer: User) -> None:
    from notifications.services import send_reminders

    a = live_auction(seller)
    services.place_bid(a.id, buyer, 8_000_000)
    with time_machine.travel(timezone.now() + timedelta(minutes=61)):
        services.tick()
    a.refresh_from_db()
    assert a.decision_deadline is not None
    with time_machine.travel(a.decision_deadline - timedelta(hours=1)):
        assert send_reminders()["decision"] == 1
        assert send_reminders()["decision"] == 0
        services.accept_bid(a.id, seller, Bid.objects.get(auction=a).id)
    with time_machine.travel(a.decision_deadline + timedelta(hours=25)):
        assert send_reminders()["rating"] == 2
        assert send_reminders()["rating"] == 0
    w = Wallet.objects.get(user=buyer)
    assert w.bonus_expires_at is not None
    with time_machine.travel(w.bonus_expires_at - timedelta(days=3)):
        assert send_reminders()["bonus"] >= 1
        assert send_reminders()["bonus"] == 0
