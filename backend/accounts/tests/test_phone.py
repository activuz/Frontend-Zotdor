import pytest

from accounts.phone import mask_phone, normalize_phone


@pytest.mark.parametrize(
    "raw",
    ["+998901234567", "998901234567", "+998 90 123-45-67", "90 123 45 67", "(90) 1234567", " 901234567 "],
)
def test_accepts_common_uzbek_formats(raw: str) -> None:
    assert normalize_phone(raw) == "+998901234567"


@pytest.mark.parametrize("raw", ["", "12345", "+79001234567", "+9989012345678", "abc", "8901234567"])
def test_rejects_non_uzbek_or_malformed(raw: str) -> None:
    assert normalize_phone(raw) is None


def test_mask_keeps_operator_code_and_last_two_digits() -> None:
    assert mask_phone("+998901234567") == "+998 90 *** ** 67"
