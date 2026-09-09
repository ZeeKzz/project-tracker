"""The tray binds handlers on the feedback module's detail fragments by id and
class. Those two files can be edited without ever opening the tray's JS, so this
reads the contract the JS declares and checks the templates still honour it."""
import json
import re
from pathlib import Path

import pytest

_MODULE = Path(__file__).resolve().parents[1]
_JS = _MODULE / 'static' / 'js' / 'signal_tray.js'
_TEMPLATES = _MODULE / 'templates' / 'feedback'


def _declared_contract():
    """Pull FRAGMENT_CONTRACT out of the JS without running it. The literal is
    plain JSON once the quotes are normalised and any trailing comma is gone."""
    source = _JS.read_text(encoding='utf-8')
    match = re.search(r'var FRAGMENT_CONTRACT = (\{.*?\});', source, re.DOTALL)
    assert match, 'FRAGMENT_CONTRACT is no longer declared in signal_tray.js'
    literal = match.group(1).replace("'", '"')
    literal = re.sub(r',(\s*[}\]])', r'\1', literal)
    return json.loads(literal)


def _template_source(name):
    path = _TEMPLATES / name
    assert path.exists(), f'{name} is gone - the tray injects it'
    return path.read_text(encoding='utf-8')


def _carries(html, selector):
    token = selector[1:]
    if selector.startswith('#'):
        return f'id="{token}' in html
    return any(token in attr for attr in re.findall(r'class="([^"]*)"', html))


@pytest.mark.parametrize('template', sorted(_declared_contract()))
def test_the_fragment_still_carries_every_selector_the_tray_binds(template):
    html = _template_source(template)
    missing = [s for s in _declared_contract()[template] if not _carries(html, s)]
    assert not missing, (
        f'{template} no longer carries {missing}. The Signal tray binds these - '
        f'either restore them or update FRAGMENT_CONTRACT in signal_tray.js.'
    )
