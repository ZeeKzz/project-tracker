"""Regenerate the role-literal baseline for the capabilities contract test.

The 2.5.1 refactor routes permission through the capabilities map, but a set of
role literals stay in the code on purpose — branch selectors, relationship
checks, and validation of another user's role — none of them gates. This script
records every such line; the contract test then fails if a NEW role literal
appears that is not in the baseline (either a gate that should use can(), or an
intentional literal that needs a review and a fresh baseline entry).

Run after intentionally adding or changing a role literal, then commit the
updated baseline alongside the change:

    python generate_role_literal_baseline.py
"""
from app.modules.core.shared.tests.role_literals import (
    BASELINE_PATH,
    collect_role_literals,
)


def main():
    entries = sorted(collect_role_literals())
    BASELINE_PATH.write_text('\n'.join(entries) + '\n', encoding='utf-8')
    print(f'Wrote {len(entries)} role-literal entries to {BASELINE_PATH}')


if __name__ == '__main__':
    main()
