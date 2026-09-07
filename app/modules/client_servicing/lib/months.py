"""
Invoice month: a real month, stored as the first of that month.

It used to be free text, so the stored values are whatever people typed —
"Aug 2026", "August 2026", "08/2026", "2026-08" (what the Table's month
picker produced). parse_month reads all of those so the migration can carry
them across and a pasted value still lands somewhere sensible.
"""
from datetime import date


_MONTH_NAMES = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9,
    'oct': 10, 'october': 10, 'nov': 11, 'november': 11, 'dec': 12,
    'december': 12,
}


def parse_month(text):
    """A written month as the 1st of that month, or None when it can't be
    read. Accepts a month name or number in either order, and a 2- or
    4-digit year."""
    if not text:
        return None
    tokens = str(text).replace('-', ' ').replace('/', ' ').replace('.', ' ').replace(',', ' ').split()
    month = year = None
    for token in tokens:
        key = token.strip().lower()
        if key in _MONTH_NAMES:
            month = _MONTH_NAMES[key]
        elif key.isdigit():
            number = int(key)
            if len(key) == 4:
                year = number
            elif 1 <= number <= 12 and month is None:
                month = number
            elif len(key) == 2:
                year = 2000 + number
    if month is None or year is None:
        return None
    return date(year, month, 1)


def format_month(value):
    """'Aug 2026' for display. None stays None so callers can show a dash."""
    return value.strftime('%b %Y') if value else None


def month_input_value(value):
    """'2026-08' — what an <input type="month"> reads and writes."""
    return value.strftime('%Y-%m') if value else ''
