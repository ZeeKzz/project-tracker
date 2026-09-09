# The management/admin time-tracking page: a full-page table of business
# hours per project and per deliverable, broken down by status. The hour
# math and row-building live in the module's logic.py; this file is just
# the route.

from flask import Blueprint, render_template, abort
from flask_login import login_required
from app.modules.core.shared.lib.utils import get_actor
from app.modules.time_tracking.logic import build_time_tracking_rows
from app.modules.core.shared.lib.capabilities import can

time_tracking_bp = Blueprint('time_tracking', __name__, template_folder='../templates')


@time_tracking_bp.route('/time-tracking')
@login_required
def index():
    """
    Full-page time-tracking breakdown for admin/management.

    Uses a manual get_actor() role check rather than the shared
    a real-user gate: this is a read-only reporting view, so it must
    be emulation-aware (an admin emulating a CS/Designer/Team Lead should see
    it as unreachable as that role would). A real-user gate checks the real
    current_user, which is right for admin-only WRITE routes but wrong for a
    read-only view like this one.
    """
    actor = get_actor()
    if not can('view_time_reports', actor):
        abort(403)

    return render_template('time_tracking/index.html', rows=build_time_tracking_rows())
