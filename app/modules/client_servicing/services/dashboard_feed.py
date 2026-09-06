"""
Client Servicing's feed for the global Dashboard. The one function the global
Dashboard imports from this module — it decides relevance and who sees each
item, so the global side filters nothing. The computation lives in
lib/dashboard.py; this is just the public seam.
"""
from app.modules.client_servicing.lib.dashboard import feed_items


def feed_for(user):
    """CS items for `user`'s global Dashboard Next Actions, most-urgent first.
    Empty for anyone without CS access; finance items only for finance viewers."""
    return feed_items(user)