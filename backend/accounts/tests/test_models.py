import pytest
from django.core.exceptions import ValidationError

from accounts.models import User

pytestmark = pytest.mark.django_db


def test_regular_user_has_no_usable_password() -> None:
    user = User.objects.create_user(phone="+998901234567")
    assert user.role == User.Role.USER
    assert not user.has_usable_password()
    assert not user.is_staff


@pytest.mark.parametrize("phone", ["998901234567", "+99890123456", "+79001234567", "+998 90 123 45 67"])
def test_phone_must_be_uzbek_e164(phone: str) -> None:
    with pytest.raises(ValidationError):
        User.objects.create_user(phone=phone)


def test_superuser_is_admin_role() -> None:
    user = User.objects.create_superuser(phone="+998901111111", password="a-long-test-password")
    assert user.role == User.Role.ADMIN
    assert user.is_superuser and user.is_staff
    assert user.is_moderator_or_admin
