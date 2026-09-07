"""
One place to turn a stored money figure into a Decimal.

Project.value is a Float column while the CS finance fields are Numeric, so
any total that mixes them raises TypeError. Everything in this module that
adds money up reads through here.
"""
from decimal import Decimal


def money(value):
    """`value` as a Decimal, with None counting as zero. Floats convert via
    str so the Decimal matches the figure as written, not the binary float
    behind it."""
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))
