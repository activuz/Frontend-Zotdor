from rest_framework import exceptions

from core.errors import DomainError, exception_handler


def test_domain_error_uses_uniform_body() -> None:
    response = exception_handler(DomainError("bid_too_low", "Taklif juda past", 409), {})
    assert response is not None
    assert response.status_code == 409
    assert response.data == {"error": {"code": "bid_too_low", "message": "Taklif juda past"}}


def test_validation_error_keeps_field_messages() -> None:
    response = exception_handler(exceptions.ValidationError({"amount": ["Majburiy maydon."]}), {})
    assert response is not None
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid"
    assert response.data["error"]["fields"] == {"amount": ["Majburiy maydon."]}


def test_auth_error_has_uzbek_message() -> None:
    response = exception_handler(exceptions.NotAuthenticated(), {})
    assert response is not None
    assert response.data["error"]["code"] == "not_authenticated"


def test_unhandled_exception_is_left_to_django() -> None:
    assert exception_handler(ValueError("boom"), {}) is None
