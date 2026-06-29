"""
Shopping locale service — maps ISO country codes to SerpAPI locale params
and ISO 4217 currency codes for the google_shopping engine.

Note: 'az' (Azerbaijan) is intentionally NOT in SHOPPING_SUPPORTED.
Google Shopping has no inventory there; searches fall through to local-stores lane.
"""

# All countries supported by google_shopping engine (gl parameter)
SHOPPING_SUPPORTED: set[str] = {
    "us", "gb", "ca", "au", "de", "fr", "it", "es", "nl", "be",
    "at", "ch", "se", "no", "dk", "fi", "pl", "cz", "ro", "hu",
    "sk", "hr", "bg", "lt", "lv", "ee", "pt", "ie", "gr", "cy",
    "tr", "ru", "ua", "by", "md", "rs", "ba", "me", "mk", "al",
    "si", "ge", "am", "kz", "uz", "in", "pk", "bd", "lk", "my",
    "sg", "ph", "th", "id", "vn", "hk", "tw", "jp", "kr", "cn",
    "za", "ng", "ke", "gh", "eg", "ma", "dz", "tn", "sa", "ae",
    "qa", "kw", "bh", "om", "jo", "lb", "il", "br", "mx", "ar",
    "cl", "co", "pe", "ve", "nz",
}

_LOCALE_MAP: dict[str, dict] = {
    "us": {"gl": "us", "hl": "en", "google_domain": "google.com", "location": "United States"},
    "gb": {"gl": "gb", "hl": "en", "google_domain": "google.co.uk", "location": "United Kingdom"},
    "ca": {"gl": "ca", "hl": "en", "google_domain": "google.ca", "location": "Canada"},
    "au": {"gl": "au", "hl": "en", "google_domain": "google.com.au", "location": "Australia"},
    "nz": {"gl": "nz", "hl": "en", "google_domain": "google.co.nz", "location": "New Zealand"},
    "ie": {"gl": "ie", "hl": "en", "google_domain": "google.ie", "location": "Ireland"},
    "de": {"gl": "de", "hl": "de", "google_domain": "google.de", "location": "Germany"},
    "at": {"gl": "at", "hl": "de", "google_domain": "google.at", "location": "Austria"},
    "ch": {"gl": "ch", "hl": "de", "google_domain": "google.ch", "location": "Switzerland"},
    "fr": {"gl": "fr", "hl": "fr", "google_domain": "google.fr", "location": "France"},
    "be": {"gl": "be", "hl": "fr", "google_domain": "google.be", "location": "Belgium"},
    "it": {"gl": "it", "hl": "it", "google_domain": "google.it", "location": "Italy"},
    "es": {"gl": "es", "hl": "es", "google_domain": "google.es", "location": "Spain"},
    "pt": {"gl": "pt", "hl": "pt", "google_domain": "google.pt", "location": "Portugal"},
    "nl": {"gl": "nl", "hl": "nl", "google_domain": "google.nl", "location": "Netherlands"},
    "se": {"gl": "se", "hl": "sv", "google_domain": "google.se", "location": "Sweden"},
    "no": {"gl": "no", "hl": "no", "google_domain": "google.no", "location": "Norway"},
    "dk": {"gl": "dk", "hl": "da", "google_domain": "google.dk", "location": "Denmark"},
    "fi": {"gl": "fi", "hl": "fi", "google_domain": "google.fi", "location": "Finland"},
    "pl": {"gl": "pl", "hl": "pl", "google_domain": "google.pl", "location": "Poland"},
    "cz": {"gl": "cz", "hl": "cs", "google_domain": "google.cz", "location": "Czech Republic"},
    "ro": {"gl": "ro", "hl": "ro", "google_domain": "google.ro", "location": "Romania"},
    "hu": {"gl": "hu", "hl": "hu", "google_domain": "google.hu", "location": "Hungary"},
    "sk": {"gl": "sk", "hl": "sk", "google_domain": "google.sk", "location": "Slovakia"},
    "hr": {"gl": "hr", "hl": "hr", "google_domain": "google.hr", "location": "Croatia"},
    "bg": {"gl": "bg", "hl": "bg", "google_domain": "google.bg", "location": "Bulgaria"},
    "lt": {"gl": "lt", "hl": "lt", "google_domain": "google.lt", "location": "Lithuania"},
    "lv": {"gl": "lv", "hl": "lv", "google_domain": "google.lv", "location": "Latvia"},
    "ee": {"gl": "ee", "hl": "et", "google_domain": "google.ee", "location": "Estonia"},
    "gr": {"gl": "gr", "hl": "el", "google_domain": "google.gr", "location": "Greece"},
    "cy": {"gl": "cy", "hl": "el", "google_domain": "google.com.cy", "location": "Cyprus"},
    "si": {"gl": "si", "hl": "sl", "google_domain": "google.si", "location": "Slovenia"},
    "tr": {"gl": "tr", "hl": "tr", "google_domain": "google.com.tr", "location": "Turkey"},
    "ru": {"gl": "ru", "hl": "ru", "google_domain": "google.ru", "location": "Russia"},
    "ua": {"gl": "ua", "hl": "uk", "google_domain": "google.com.ua", "location": "Ukraine"},
    "by": {"gl": "by", "hl": "ru", "google_domain": "google.com", "location": "Belarus"},
    "md": {"gl": "md", "hl": "ro", "google_domain": "google.md", "location": "Moldova"},
    "ge": {"gl": "ge", "hl": "ka", "google_domain": "google.ge", "location": "Georgia"},
    "am": {"gl": "am", "hl": "hy", "google_domain": "google.am", "location": "Armenia"},
    "kz": {"gl": "kz", "hl": "ru", "google_domain": "google.kz", "location": "Kazakhstan"},
    "il": {"gl": "il", "hl": "iw", "google_domain": "google.co.il", "location": "Israel"},
    "sa": {"gl": "sa", "hl": "ar", "google_domain": "google.com.sa", "location": "Saudi Arabia"},
    "ae": {"gl": "ae", "hl": "ar", "google_domain": "google.ae", "location": "United Arab Emirates"},
    "qa": {"gl": "qa", "hl": "ar", "google_domain": "google.com.qa", "location": "Qatar"},
    "kw": {"gl": "kw", "hl": "ar", "google_domain": "google.com.kw", "location": "Kuwait"},
    "bh": {"gl": "bh", "hl": "ar", "google_domain": "google.com.bh", "location": "Bahrain"},
    "om": {"gl": "om", "hl": "ar", "google_domain": "google.com.om", "location": "Oman"},
    "jo": {"gl": "jo", "hl": "ar", "google_domain": "google.jo", "location": "Jordan"},
    "lb": {"gl": "lb", "hl": "ar", "google_domain": "google.com.lb", "location": "Lebanon"},
    "eg": {"gl": "eg", "hl": "ar", "google_domain": "google.com.eg", "location": "Egypt"},
    "ma": {"gl": "ma", "hl": "fr", "google_domain": "google.co.ma", "location": "Morocco"},
    "dz": {"gl": "dz", "hl": "fr", "google_domain": "google.dz", "location": "Algeria"},
    "tn": {"gl": "tn", "hl": "fr", "google_domain": "google.com.tn", "location": "Tunisia"},
    "ng": {"gl": "ng", "hl": "en", "google_domain": "google.com.ng", "location": "Nigeria"},
    "za": {"gl": "za", "hl": "en", "google_domain": "google.co.za", "location": "South Africa"},
    "ke": {"gl": "ke", "hl": "en", "google_domain": "google.co.ke", "location": "Kenya"},
    "gh": {"gl": "gh", "hl": "en", "google_domain": "google.com.gh", "location": "Ghana"},
    "in": {"gl": "in", "hl": "en", "google_domain": "google.co.in", "location": "India"},
    "pk": {"gl": "pk", "hl": "en", "google_domain": "google.com.pk", "location": "Pakistan"},
    "bd": {"gl": "bd", "hl": "bn", "google_domain": "google.com.bd", "location": "Bangladesh"},
    "lk": {"gl": "lk", "hl": "en", "google_domain": "google.lk", "location": "Sri Lanka"},
    "cn": {"gl": "cn", "hl": "zh-CN", "google_domain": "google.com.hk", "location": "China"},
    "hk": {"gl": "hk", "hl": "zh-TW", "google_domain": "google.com.hk", "location": "Hong Kong"},
    "tw": {"gl": "tw", "hl": "zh-TW", "google_domain": "google.com.tw", "location": "Taiwan"},
    "jp": {"gl": "jp", "hl": "ja", "google_domain": "google.co.jp", "location": "Japan"},
    "kr": {"gl": "kr", "hl": "ko", "google_domain": "google.co.kr", "location": "South Korea"},
    "sg": {"gl": "sg", "hl": "en", "google_domain": "google.com.sg", "location": "Singapore"},
    "my": {"gl": "my", "hl": "ms", "google_domain": "google.com.my", "location": "Malaysia"},
    "th": {"gl": "th", "hl": "th", "google_domain": "google.co.th", "location": "Thailand"},
    "id": {"gl": "id", "hl": "id", "google_domain": "google.co.id", "location": "Indonesia"},
    "ph": {"gl": "ph", "hl": "en", "google_domain": "google.com.ph", "location": "Philippines"},
    "vn": {"gl": "vn", "hl": "vi", "google_domain": "google.com.vn", "location": "Vietnam"},
    "br": {"gl": "br", "hl": "pt", "google_domain": "google.com.br", "location": "Brazil"},
    "mx": {"gl": "mx", "hl": "es", "google_domain": "google.com.mx", "location": "Mexico"},
    "ar": {"gl": "ar", "hl": "es", "google_domain": "google.com.ar", "location": "Argentina"},
    "cl": {"gl": "cl", "hl": "es", "google_domain": "google.cl", "location": "Chile"},
    "co": {"gl": "co", "hl": "es", "google_domain": "google.com.co", "location": "Colombia"},
    "pe": {"gl": "pe", "hl": "es", "google_domain": "google.com.pe", "location": "Peru"},
    "ve": {"gl": "ve", "hl": "es", "google_domain": "google.co.ve", "location": "Venezuela"},
}

_CURRENCY_MAP: dict[str, str] = {
    "us": "USD", "gb": "GBP", "eu": "EUR",
    "de": "EUR", "fr": "EUR", "it": "EUR", "es": "EUR", "nl": "EUR",
    "be": "EUR", "at": "EUR", "pt": "EUR", "ie": "EUR", "fi": "EUR",
    "gr": "EUR", "cy": "EUR", "ee": "EUR", "lt": "EUR", "lv": "EUR",
    "sk": "EUR", "si": "EUR", "mt": "EUR", "hr": "EUR", "me": "EUR",
    "rs": "RSD", "ba": "BAM", "mk": "MKD", "al": "ALL",
    "tr": "TRY", "ru": "RUB", "ua": "UAH", "by": "BYN",
    "az": "AZN", "ge": "GEL", "am": "AMD", "kz": "KZT", "uz": "UZS",
    "sa": "SAR", "ae": "AED", "qa": "QAR", "kw": "KWD",
    "bh": "BHD", "om": "OMR", "jo": "JOD", "lb": "LBP",
    "eg": "EGP", "ma": "MAD", "tn": "TND", "ng": "NGN",
    "za": "ZAR", "ke": "KES", "gh": "GHS",
    "in": "INR", "pk": "PKR", "bd": "BDT", "lk": "LKR",
    "cn": "CNY",  # google.com blocked in mainland China; use HK domain
    "jp": "JPY", "kr": "KRW", "hk": "HKD", "tw": "TWD",
    "sg": "SGD", "my": "MYR", "th": "THB", "id": "IDR",
    "ph": "PHP", "vn": "VND",
    "au": "AUD", "nz": "NZD", "ca": "CAD",
    "br": "BRL", "mx": "MXN", "ar": "ARS", "cl": "CLP",
    "co": "COP", "pe": "PEN",
    "ch": "CHF", "se": "SEK", "no": "NOK", "dk": "DKK",
    "pl": "PLN", "cz": "CZK", "hu": "HUF", "ro": "RON",
    "il": "ILS",
}


def locale_for(country: str) -> dict | None:
    """Return SerpAPI locale params for a country, or None if google_shopping is unsupported."""
    if country not in SHOPPING_SUPPORTED:
        return None
    if country in _LOCALE_MAP:
        return _LOCALE_MAP[country]
    # Fallback: use google.com with the country's gl
    return {"gl": country, "hl": "en", "google_domain": "google.com", "location": country.upper()}


def currency_for(country: str) -> str:
    """Return the ISO 4217 currency code for a country. Defaults to 'USD' if unknown."""
    return _CURRENCY_MAP.get(country, "USD")
