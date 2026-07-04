from app.services.shopping_locale import currency_for, locale_for


def test_currency_for_known_country():
    assert currency_for("az") == "AZN"
    assert currency_for("us") == "USD"


def test_currency_for_unknown_country_defaults_usd():
    assert currency_for("zz") == "USD"


def test_locale_for_supported_country():
    locale = locale_for("de")
    assert locale is not None
    assert locale["gl"] == "de"


def test_locale_for_unsupported_country_returns_none():
    assert locale_for("az") is None
