"""Staff audit log (BR-62). Every panel mutation calls log()."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from core.models import StaffAuditLog

if TYPE_CHECKING:
    from accounts.models import User


def log(
    actor: User,
    action: str,
    target_type: str,
    target_id: object,
    *,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    ip: str | None = None,
) -> StaffAuditLog:
    return StaffAuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        before=before or {},
        after=after or {},
        ip=ip,
    )
