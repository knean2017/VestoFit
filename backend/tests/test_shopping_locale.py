from app.services.shopping_locale import currency_for, locale_for, retailers_for


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


def test_retailers_for_azerbaijan():
    domains = retailers_for("az")
    assert "birmarket.az" in domains
    assert "trendyol.com" in domains


def test_retailers_for_unknown_country_returns_empty():
    assert retailers_for("zz") == []
