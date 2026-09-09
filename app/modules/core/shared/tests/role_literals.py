"""Shared definition of a "role literal" for the capabilities contract test and
its baseline generator.

One definition, imported by both the test and generate_role_literal_baseline.py,
so the generator can never disagree with the check that reads its output — the
route-contract baseline learned that lesson the hard way.

A role literal is any `.role` compared or membership-tested in code
(`actor.role == 'cs'`, `user.role in (...)`, `new_owner.role != 'project_owner'`).
After the 2.5.1 refactor these are the checks deliberately kept OUT of the
capabilities map — branch selectors, relationship checks, another user's-role
validation — none of them gates. The baseline records every one so a NEW literal
that appears without review fails the contract test.
"""
import re
from pathlib import Path

import app as app_package

APP_ROOT = Path(app_package.__file__).parent
BASELINE_PATH = Path(__file__).parent / 'role_literal_baseline.txt'

# `.role` followed by a comparison or membership test. `.role.in_(` (SQLAlchemy)
# has a dot after .role, so it does not match — query column filters are not
# permission literals.
_ROLE_LITERAL = re.compile(r'\.role\s*(?:==|!=|\bin\b|\bnot\s+in\b)')


def _source_files():
    """Every .py and .html under app/, excluding tests and caches — the same
    surface the other contract assertions scan."""
    for path in APP_ROOT.rglob('*'):
        if path.suffix not in ('.py', '.html'):
            continue
        parts = path.parts
        if 'tests' in parts or '__pycache__' in parts:
            continue
        yield path


def collect_role_literals():
    """Every role-literal line under app/, keyed by relative path + the stripped
    line text — not the line number, so moving a line around does not churn the
    baseline, while changing the check itself does (which is the point). Pure
    comment lines are skipped so prose about a check never counts as one."""
    found = set()
    for path in _source_files():
        text = path.read_text(encoding='utf-8', errors='ignore')
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith('#'):
                continue
            if _ROLE_LITERAL.search(line):
                found.add(f'{path.relative_to(APP_ROOT).as_posix()} :: {stripped}')
    return found
