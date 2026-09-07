"""Regenerate the route-contract baseline from the live app.

Run once from the repo root when routes intentionally change (or to restore a
lost baseline):  python -m app.modules.core.shared.tests.regen_route_baseline

Writes refactor/route_baseline.txt at the repo root — the exact path
test_routes_contract.py's _baseline_path() reads from. Commit it.

The route set written here comes from current_routes() below, which
test_routes_contract.py imports too — one definition, so a baseline written
by this script can never disagree with the contract that reads it.
"""
import os


def current_routes(app):
    """The routes that make up the contract.

    Static routes (the app's own plus one per blueprint as assets move into
    modules) are infrastructure, not contract, so they are left out.
    """
    routes = set()
    for r in app.url_map.iter_rules():
        if r.endpoint == 'static' or r.endpoint.endswith('.static'):
            continue
        methods = ','.join(sorted(m for m in r.methods if m not in {'HEAD', 'OPTIONS'}))
        routes.add(f'{r.rule}\t{methods}\t{r.endpoint}')
    return routes


def baseline_path(app):
    # app.root_path is .../project-tracker/app; the baseline lives one level up.
    return os.path.join(os.path.dirname(app.root_path), 'refactor', 'route_baseline.txt')


def main():
    from app import create_app

    app = create_app()
    routes = current_routes(app)
    out = baseline_path(app)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sorted(routes)) + '\n')
    print(f'wrote {len(routes)} routes -> {out}')


if __name__ == '__main__':
    main()
