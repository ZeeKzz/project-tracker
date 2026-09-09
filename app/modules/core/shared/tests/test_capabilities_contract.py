"""Contract test for the capabilities refactor.

Permission logic lives in one map. These assertions are what stops the old
pattern creeping back: a new module importing role_required, or hand-rolling
its own admin_required, would pass its own tests and quietly reintroduce the
scattered role checks this refactor removed.
"""
import re
from pathlib import Path

import pytest

import app as app_package
from app.modules.core.shared.lib.capabilities import (
    ADMIN_ONLY,
    ALL_CAPABILITIES,
    ROLE_CAPABILITIES,
    ROLE_LABELS,
)
from app.modules.core.shared.tests.role_literals import (
    BASELINE_PATH,
    collect_role_literals,
)

APP_ROOT = Path(app_package.__file__).parent


def _source_files():
    """Every .py and .html under app/, excluding tests and caches."""
    for path in APP_ROOT.rglob('*'):
        if path.suffix not in ('.py', '.html'):
            continue
        parts = path.parts
        if 'tests' in parts or '__pycache__' in parts:
            continue
        yield path


def _offenders(needle):
    hits = []
    for path in _source_files():
        text = path.read_text(encoding='utf-8', errors='ignore')
        for lineno, line in enumerate(text.splitlines(), 1):
            if needle in line:
                hits.append(f'{path.relative_to(APP_ROOT)}:{lineno}: {line.strip()}')
    return hits


def _offenders_re(pattern):
    rx = re.compile(pattern)
    hits = []
    for path in _source_files():
        text = path.read_text(encoding='utf-8', errors='ignore')
        for lineno, line in enumerate(text.splitlines(), 1):
            if rx.search(line):
                hits.append(f'{path.relative_to(APP_ROOT)}:{lineno}: {line.strip()}')
    return hits


def test_nothing_imports_the_retired_role_decorator():
    """role_required was the old gate. Every call site now goes through the
    capabilities map, so an import of it is a regression."""
    hits = _offenders('import role_required')
    assert not hits, 'role_required is retired:\n' + '\n'.join(hits)


def test_no_module_hand_rolls_its_own_admin_check():
    """admin.py and admin_achievements.py each defined their own copy. Both are
    now one-line aliases for require_api('...', real_user=True); a `def` here
    means someone wrote a fresh one."""
    hits = _offenders('def admin_required(')
    assert not hits, 'hand-rolled admin gate:\n' + '\n'.join(hits)


# Two role-set constants survive on purpose, and neither decides permissions:
#   _REVIEW_ROLES        the CS review lock — a temporary config state
#   _ROLE_SNAPSHOT_ROLES which people get a tile on the team snapshot
_ALLOWED_ROLE_SETS = ('_REVIEW_ROLES', '_ROLE_SNAPSHOT_ROLES')


def test_no_route_module_declares_its_own_permission_role_set():
    """Constants like _CLIENT_SERVICING_ROLES / _FINANCE_EDIT_ROLES were how
    role sets used to spread. The map is the only place roles and permissions
    meet now. Anything new here needs a capability, or a line in the allowlist
    above saying why it is not a gate.

    Matched by regex so `_ROLES=` with any spacing is caught, not just the one
    literal `_ROLES = ` spelling.
    """
    hits = [
        h for h in _offenders_re(r'_ROLES\s*=')
        if 'capabilities.py' not in h
        and 'role_literals.py' not in h
        and not any(name in h for name in _ALLOWED_ROLE_SETS)
    ]
    assert not hits, 'local role set:\n' + '\n'.join(hits)


def test_no_unreviewed_role_literal():
    """Every `.role` comparison left in the code is a branch / relationship /
    validation deliberately kept out of the map, recorded in the baseline. A new
    one that is not in the baseline is either a gate that should use can(), or an
    intentional literal that needs a review and a baseline entry.

    Regenerate after an intentional change:  python generate_role_literal_baseline.py
    """
    assert BASELINE_PATH.exists(), (
        'role-literal baseline missing — run: python generate_role_literal_baseline.py'
    )
    baseline = {
        line.strip()
        for line in BASELINE_PATH.read_text(encoding='utf-8').splitlines()
        if line.strip()
    }
    current = collect_role_literals()

    added = current - baseline
    assert not added, (
        'New role literal(s) not in the baseline. If a gate, use can(); if an '
        'intentional branch/relationship/validation, run '
        'generate_role_literal_baseline.py and commit the baseline:\n'
        + '\n'.join(sorted(added))
    )

    removed = baseline - current
    assert not removed, (
        'Baseline lists role literals that no longer exist — regenerate it:\n'
        + '\n'.join(sorted(removed))
    )


def test_the_map_is_internally_consistent():
    granted = set()
    for role, caps in ROLE_CAPABILITIES.items():
        named = {c for c in caps if c != '*'}
        assert not (named - ALL_CAPABILITIES), f'{role} grants an unknown capability'
        granted |= named
    assert ALL_CAPABILITIES - granted - ADMIN_ONLY == set(), 'capability nobody can reach'
    assert set(ROLE_LABELS) == set(ROLE_CAPABILITIES), 'role picker and map disagree'


@pytest.mark.parametrize('role', sorted(ROLE_CAPABILITIES))
def test_no_role_but_admin_holds_an_admin_only_capability(role):
    if role == 'admin':
        return
    assert not (ROLE_CAPABILITIES[role] & ADMIN_ONLY)
