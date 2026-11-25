"""Response shapes of the panel API, for the OpenAPI schema only.

Views build plain dicts (see the `_*_row` helpers in views.py); these serializers describe them so
the panel app gets generated TypeScript types instead of hand-written ones.
"""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from auctions.serializers import AuctionDetailSerializer, AuctionListSerializer
from wallet.serializers import WalletEntrySerializer, WalletSerializer

S = serializers.Serializer


def paginated(name: str, item: serializers.BaseSerializer[Any]) -> type[S[Any]]:
    return type(
        name,
        (S,),
        {
            "count": serializers.IntegerField(),
            "next": serializers.CharField(allow_null=True),
            "previous": serializers.CharField(allow_null=True),
            "results": item,
        },
    )


class PanelQueues(S[Any]):
    pending_review = serializers.IntegerField()
    reports = serializers.IntegerField()
    claims = serializers.IntegerField()
    refunds = serializers.IntegerField()
    leads = serializers.IntegerField()
    bug_reports = serializers.IntegerField()


class PanelStats(S[Any]):
    auctions_by_status = serializers.DictField(child=serializers.IntegerField())
    queues = PanelQueues()
    deals_7d = serializers.IntegerField()
    commission_7d = serializers.IntegerField()
    new_users_7d = serializers.IntegerField()


class PanelAuctionRow(AuctionListSerializer):
    seller_phone = serializers.CharField()
    seller_id = serializers.UUIDField()

    class Meta(AuctionListSerializer.Meta):
        fields = [*AuctionListSerializer.Meta.fields, "seller_phone", "seller_id"]


class PanelCheck(S[Any]):
    check_name = serializers.CharField()
    result = serializers.CharField()
    message = serializers.CharField()
    details = serializers.JSONField()


class PanelEvent(S[Any]):
    from_status = serializers.CharField()
    to_status = serializers.CharField()
    reason = serializers.CharField()
    created_at = serializers.DateTimeField()
    actor__phone = serializers.CharField(allow_null=True)


class SellerHistory(S[Any]):
    auctions = serializers.IntegerField()
    blocked = serializers.IntegerField()
    reports = serializers.IntegerField()


class PanelAuctionDetail(AuctionDetailSerializer):
    checks = PanelCheck(many=True)
    events = PanelEvent(many=True)
    seller_phone = serializers.CharField()
    seller_history = SellerHistory()

    class Meta(AuctionDetailSerializer.Meta):
        fields = [*AuctionDetailSerializer.Meta.fields, "checks", "events", "seller_phone", "seller_history"]


class PanelActionResult(S[Any]):
    status = serializers.CharField()


class PanelReport(S[Any]):
    id = serializers.UUIDField()
    target_type = serializers.CharField()
    target_id = serializers.UUIDField()
    reason = serializers.CharField()
    reason_label = serializers.CharField()
    comment = serializers.CharField()
    status = serializers.CharField()
    reporter_phone = serializers.CharField()
    created_at = serializers.DateTimeField()
    handled_note = serializers.CharField()


class PanelLead(S[Any]):
    id = serializers.UUIDField()
    name = serializers.CharField()
    phone = serializers.CharField()
    role = serializers.CharField()
    role_label = serializers.CharField()
    region = serializers.CharField(allow_null=True)
    message = serializers.CharField()
    utm = serializers.CharField()
    status = serializers.CharField()
    handled_note = serializers.CharField()
    created_at = serializers.DateTimeField()
    handled_at = serializers.DateTimeField(allow_null=True)


class PanelBugReport(S[Any]):
    id = serializers.UUIDField()
    message = serializers.CharField()
    user_id = serializers.UUIDField(allow_null=True)
    user_phone = serializers.CharField(allow_null=True)
    contact = serializers.CharField()
    page_url = serializers.CharField()
    user_agent = serializers.CharField()
    viewport = serializers.CharField()
    error_text = serializers.CharField()
    status = serializers.CharField()
    handled_note = serializers.CharField()
    created_at = serializers.DateTimeField()
    handled_at = serializers.DateTimeField(allow_null=True)


class PanelClaim(S[Any]):
    id = serializers.UUIDField()
    deal_id = serializers.UUIDField()
    auction_id = serializers.UUIDField()
    auction_title = serializers.CharField()
    price = serializers.IntegerField()
    commission_amount = serializers.IntegerField(allow_null=True)
    seller_phone = serializers.CharField()
    buyer_phone = serializers.CharField()
    reason = serializers.CharField()
    status = serializers.CharField()
    resolution_note = serializers.CharField()
    created_at = serializers.DateTimeField()


class PanelRefund(S[Any]):
    id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    user_phone = serializers.CharField()
    amount = serializers.IntegerField()
    click_reference = serializers.CharField()
    reason = serializers.CharField()
    status = serializers.CharField()
    note = serializers.CharField()
    created_at = serializers.DateTimeField()
    main_balance = serializers.IntegerField()


class PanelUser(S[Any]):
    id = serializers.UUIDField()
    phone = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    role = serializers.ChoiceField(["user", "moderator", "admin"])
    is_blocked = serializers.BooleanField()
    blocked_reason = serializers.CharField()
    region = serializers.CharField()
    district = serializers.CharField()
    rating_avg = serializers.FloatField(allow_null=True)
    rating_count = serializers.IntegerField()
    deals_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()


class PanelAuditRow(S[Any]):
    id = serializers.IntegerField()
    actor_phone = serializers.CharField()
    action = serializers.CharField()
    target_type = serializers.CharField()
    target_id = serializers.CharField()
    before = serializers.JSONField(allow_null=True)
    after = serializers.JSONField(allow_null=True)
    ip = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()


class PanelUserAudit(S[Any]):
    action = serializers.CharField()
    after = serializers.JSONField(allow_null=True)
    created_at = serializers.DateTimeField()
    actor__phone = serializers.CharField()


class PanelUserDetail(S[Any]):
    user = PanelUser()
    wallet = WalletSerializer()
    entries = WalletEntrySerializer(many=True)
    auctions = AuctionListSerializer(many=True)
    reports_against = serializers.IntegerField()
    audit = PanelUserAudit(many=True)


PanelAuctionPage = paginated("PaginatedPanelAuctionList", PanelAuctionRow(many=True))
PanelReportPage = paginated("PaginatedPanelReportList", PanelReport(many=True))
PanelLeadPage = paginated("PaginatedPanelLeadList", PanelLead(many=True))
PanelBugReportPage = paginated("PaginatedPanelBugReportList", PanelBugReport(many=True))
PanelClaimPage = paginated("PaginatedPanelClaimList", PanelClaim(many=True))
PanelRefundPage = paginated("PaginatedPanelRefundList", PanelRefund(many=True))
PanelUserPage = paginated("PaginatedPanelUserList", PanelUser(many=True))
PanelAuditPage = paginated("PaginatedPanelAuditList", PanelAuditRow(many=True))
