// main.js - Vitamin Helix
console.log("Vitamin Helix loaded.");

// ── Dev Tools: Wipe Projects ─────────────────────────────────────────────────
// These functions only do anything if the wipe modal exists in the DOM, which
// only happens when DEV_TOOLS_ENABLED=true is set in .env (never on production).

function openWipeModal() {
    var modal = document.getElementById('wipe-modal');
    if (!modal) return;
    // Reset state every time modal opens — clear the input and re-disable the button
    document.getElementById('wipe-confirm-input').value = '';
    document.getElementById('wipe-confirm-btn').disabled = true;
    modal.classList.remove('hidden');
    setTimeout(function () { document.getElementById('wipe-confirm-input').focus(); }, 100);
}

function closeWipeModal() {
    var modal = document.getElementById('wipe-modal');
    if (modal) modal.classList.add('hidden');
}

// Enable the confirm button only when the user has typed exactly 'WIPE'
function checkWipeConfirm() {
    var val = document.getElementById('wipe-confirm-input').value;
    document.getElementById('wipe-confirm-btn').disabled = (val !== 'WIPE');
}

// POST to the wipe route — server double-checks DEV_TOOLS_ENABLED before touching any data
function confirmWipe() {
    var btn = document.getElementById('wipe-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Wiping…';

    fetch('/admin/api/dev/wipe-projects', { method: 'POST' })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            closeWipeModal();
            if (data.success) {
                showToast('All projects wiped. FOC counter reset to FOC-001.', 'success');
            } else {
                showToast(data.error || 'Wipe failed.', 'error');
            }
            // Reset button text for next time
            btn.textContent = 'Wipe Everything';
        })
        .catch(function () {
            showToast('Request failed. Check the server logs.', 'error');
            closeWipeModal();
            btn.textContent = 'Wipe Everything';
        });
}

// ── Scroll Position: save before any form submit, restore on load ────────────
(function () {
    var SCROLL_KEY = 'helix_scroll_' + window.location.pathname;

    // On load: if we saved a scroll position for this page, jump there and clear it
    var savedY = sessionStorage.getItem(SCROLL_KEY);
    if (savedY !== null) {
        // requestAnimationFrame ensures the page has rendered before we scroll
        requestAnimationFrame(function () {
            window.scrollTo(0, parseInt(savedY, 10));
        });
        sessionStorage.removeItem(SCROLL_KEY);
    }

    // Before any form submit on this page, save current scroll position
    document.addEventListener('submit', function () {
        sessionStorage.setItem(SCROLL_KEY, window.scrollY);
    });
})();

// ── Notification Sound (Web Audio API) ──────────────────────────────────────
// Generates a two-tone chime without needing any audio file
window.helixPlayNotificationSound = function () {
    if (localStorage.getItem('helix_audio_notifications') === 'off') return;
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();

        function playTone(freq, startTime, duration) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            // Fade in then out for a soft chime feel
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        }

        var now = ctx.currentTime;
        playTone(880, now, 0.4);        // A5 — first note
        playTone(1108, now + 0.18, 0.5); // C#6 — second note, overlaps slightly
    } catch (e) {
        // Audio context blocked (e.g. before first user interaction) — silent fail
    }
};

// ── Desktop (Browser) Notifications ─────────────────────────────────────────
function helixShowBrowserNotification(message) {
    if (localStorage.getItem('helix_browser_notifications') === 'off') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    new Notification('Vitamin-E', {
        body: message,
        icon: '/static/images/notiftoggle2.png'
    });
}

// ── Notification Polling (every 30 seconds) ──────────────────────────────────
// Polls /notifications/poll?since=<ISO> for new unread notifications.
// On first load, sets the baseline timestamp so we only alert about NEW arrivals.
(function () {
    // Initialise the "last polled" time to now so we don't re-fire existing notifications
    if (!localStorage.getItem('helix_last_poll')) {
        localStorage.setItem('helix_last_poll', new Date().toISOString());
    }

    function pollNotifications() {
        var since = localStorage.getItem('helix_last_poll') || new Date().toISOString();

        fetch('/notifications/poll?since=' + encodeURIComponent(since))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.notifications || data.notifications.length === 0) return;

                // Update the baseline to the newest notification's timestamp
                var latest = data.notifications[data.notifications.length - 1];
                localStorage.setItem('helix_last_poll', latest.created_at);

                // Fire once per batch (first message) — avoids a flood if many arrive
                var msg = data.notifications[0].message;
                helixShowBrowserNotification(msg);
                window.helixPlayNotificationSound();

                // Update the unread badge in the nav without a full page reload
                var badge = document.getElementById('notif-unread-badge');
                if (badge) {
                    // Badge already exists — increment the count
                    var current = parseInt(badge.textContent, 10) || 0;
                    badge.textContent = current + data.notifications.length;
                } else {
                    // Badge doesn't exist yet (count was 0) — create and inject it
                    var bell = document.getElementById('notification-bell');
                    if (bell) {
                        var newBadge = document.createElement('span');
                        newBadge.className = 'bell-badge';
                        newBadge.id = 'notif-unread-badge';
                        newBadge.textContent = data.notifications.length;
                        bell.appendChild(newBadge);
                    }
                }
            })
            .catch(function () {
                // Network error — silently skip this poll cycle
            });
    }

    // Start polling 5s after page load (avoid hitting server during initial render)
    setTimeout(function () {
        pollNotifications();
        setInterval(pollNotifications, 30000); // every 30 seconds
    }, 5000);
})();

// Clickable row logic
document.querySelectorAll('.clickable').forEach(row => {
    row.addEventListener('click', function (e) {
        if (e.target.closest('a, button, select')) return;
        window.location = this.dataset.href;
    });
});

// Notification panel elements
const bell = document.getElementById('notification-bell');
const panel = document.getElementById('notification-panel');
const closeBtn = document.getElementById('close-notifications');

// Open and close the panel when bell is clicked
if (bell && panel) {
    bell.addEventListener('click', function (event) {
        event.stopPropagation();
        panel.classList.toggle('hidden');
    });
}

// Close panel when close button is clicked
if (closeBtn && panel) {
    closeBtn.addEventListener('click', function () {
        panel.classList.add('hidden');
    });
}

// Click anywhere outside the panel closes it
document.addEventListener('click', function (event) {
    if (panel && !panel.classList.contains('hidden')) {
        if (!panel.contains(event.target) && event.target !== bell) {
            panel.classList.add('hidden');
        }
    }
});

// Click a notification - mark as read, then navigate
// Click a notification to mark as read and navigate
document.querySelectorAll('.notification-item:not(.notification-item--archived)').forEach(function (item) {
    item.addEventListener('click', function (e) {
        if (e.target.closest('.notification-archive-btn')) return;
        var notificationId = this.dataset.id;
        fetch('/notifications/' + notificationId + '/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) window.location.href = data.redirect_url;
            });
    });
});

//-----------Notification Helpers------------------------------

// Builds a new archived notification element from existing data
// Called after archiving so the item appears in the Archived tab immediately
function buildArchivedItem(id, message, time) {
    var div = document.createElement('div');
    div.className = 'notification-item notification-item--archived';
    div.dataset.id = id;

    // Inner HTML matches the server rendered archived item structure
    div.innerHTML = `
        <input type="checkbox" class="notif-checkbox hidden" value="${id}">
        <div class="notification-content">
            <p class="notification-message">${message}</p>
            <span class="notification-time">${time}</span>
        </div>
        <button type="button" class="notification-restore-btn" data-id="${id}" title="Restore to inbox">↩</button>
    `;

    // Attach the restore listener on the new button immediately
    // (querySelectorAll only runs on page load, so new elements need manual binding)
    div.querySelector('.notification-restore-btn').addEventListener('click', handleRestore);

    return div;
}

// Builds a new inbox notification element from existing data
// Called after restoring so the item appears in the Inbox tab immediately
function buildInboxItem(id, message, time) {
    var div = document.createElement('div');
    div.className = 'notification-item';
    div.dataset.id = id;

    div.innerHTML = `
        <div class="notification-content">
            <p class="notification-message">${message}</p>
            <span class="notification-time">${time}</span>
        </div>
        <button type="button" class="notification-archive-btn" data-id="${id}" title="Archive">×</button>
    `;

    // Attach the archive listener to the new button immediately
    div.querySelector('.notification-archive-btn').addEventListener('click', handleArchive);

    return div;
}

// Archive a notification
function handleArchive(e) {
    e.stopPropagation();

    var notificationId = this.dataset.id;
    var item = this.closest('.notification-item');

    // Read the message and time text before removing the item from DOM
    var message = item.querySelector('.notification-message').textContent;
    var time = item.querySelector('.notification-time').textContent;

    fetch('/notifications/' + notificationId + '/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })

        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!data.success) return;

            // Update the unread badge count if this was an unread notification
            var badge = document.querySelector('.bell-badge');
            if (badge && item.classList.contains('unread')) {
                var count = parseInt(badge.textContent) - 1;
                if (count <= 0) { badge.remove(); } else { badge.textContent = count; }
            }

            //Remove from inbox
            item.remove();

            //Remove inbox empty state if present, the nadd the item to archived tab
            var archivedView = document.getElementById('notif-archived-view');
            var emptyMsg = archivedView.querySelector('.no-notifications');
            if (emptyMsg) emptyMsg.remove();

            // Insert new archived item at the top of the archived list (after toolbar)
            var toolbar = archivedView.querySelector('.archived-toolbar');
            var newItem = buildArchivedItem(notificationId, message, time);

            if (toolbar) {
                toolbar.insertAdjacentElement('afterend', newItem);
            } else {
                archivedView.prepend(newItem);
            }

            // Show inbox empty state if nothing left in inbox
            var inboxView = document.getElementById('notif-inbox-view');
            if (inboxView && inboxView.querySelectorAll('.notification-item').length === 0) {
                var empty = document.createElement('p');
                empty.className = 'no-notifications';
                empty.textContent = 'No notifications';
                inboxView.appendChild(empty);
            }
        });
}

// Attach to all existing archive buttons on page load
document.querySelectorAll('.notification-archive-btn').forEach(function (btn) {
    btn.addEventListener('click', handleArchive);
})

// Named function so dynamically created restore buttons can reuse the same logic
function handleRestore(e) {
    e.stopPropagation();

    var id = this.dataset.id;
    var item = this.closest('.notification-item');

    // Read message and time before removing from DOM
    var message = item.querySelector('.notification-message').textContent;
    var time = item.querySelector('.notification-time').textContent;

    fetch('/notifications/' + id + '/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!data.success) return;

            // Remove from archived tab
            item.remove();

            // Remove archived empty state if present, then add item to inbox tab
            var inboxView = document.getElementById('notif-inbox-view');
            var emptyMsg = inboxView.querySelector('.no-notifications');
            if (emptyMsg) emptyMsg.remove();

            // Insert restored item at top of inbox
            var newItem = buildInboxItem(id, message, time);
            inboxView.prepend(newItem);

            // Show archived empty state if nothing left in archived tab
            var archivedView = document.getElementById('notif-archived-view');
            if (archivedView && archivedView.querySelectorAll('.notification-item').length === 0) {
                var empty = document.createElement('p');
                empty.className = 'no-notifications';
                empty.textContent = 'No archived notifications';
                archivedView.appendChild(empty);
            }
        })
        .catch(function (err) {
            console.error('Restore failed:', err);
        });
}

// Attach to all existing restore buttons on page load
document.querySelectorAll('.notification-restore-btn').forEach(function (btn) {
    btn.addEventListener('click', handleRestore);
});


// Inbox / Archived Toggle
var btnInbox = document.getElementById('btn-notif-inbox');
var btnArchived = document.getElementById('btn-notif-archived');
var inboxView = document.getElementById('notif-inbox-view');
var archivedView = document.getElementById('notif-archived-view');

if (btnInbox && btnArchived) {
    btnInbox.addEventListener('click', function () {
        btnInbox.classList.add('active');
        btnArchived.classList.remove('active');
        inboxView.classList.remove('hidden');
        archivedView.classList.add('hidden');
    });

    btnArchived.addEventListener('click', function () {
        btnArchived.classList.add('active');
        btnInbox.classList.remove('active');
        archivedView.classList.remove('hidden');
        inboxView.classList.add('hidden');
    });
}

// Archived select / bulk delete
var archivedSelectBtn = document.getElementById('archived-select-btn');
var archivedRemoveBtn = document.getElementById('archived-remove-btn');
var selectModeActive = false;

if (archivedSelectBtn) {
    archivedSelectBtn.addEventListener('click', function () {
        selectModeActive = !selectModeActive;
        var checkboxes = document.querySelectorAll('#notif-archived-view .notif-checkbox');
        checkboxes.forEach(function (cb) {
            cb.classList.toggle('hidden', !selectModeActive);
            if (!selectModeActive) cb.checked = false;
        });
        archivedSelectBtn.textContent = selectModeActive ? 'Cancel' : 'Select';
        archivedRemoveBtn.classList.toggle('hidden', !selectModeActive);
    });
}

if (archivedRemoveBtn) {
    archivedRemoveBtn.addEventListener('click', function () {
        var checked = document.querySelectorAll('#notif-archived-view .notif-checkbox:checked');
        if (checked.length === 0) return;
        var ids = Array.from(checked).map(function (cb) { return parseInt(cb.value); });
        fetch('/notifications/delete-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.success) return;
                ids.forEach(function (id) {
                    var item = document.querySelector('#notif-archived-view .notification-item[data-id="' + id + '"]');
                    if (item) item.remove();
                });
                // Exit select mode
                selectModeActive = false;
                archivedSelectBtn.textContent = 'Select';
                archivedRemoveBtn.classList.add('hidden');
                document.querySelectorAll('#notif-archived-view .notif-checkbox').forEach(function (cb) {
                    cb.classList.add('hidden');
                });
                // Show empty state if nothing left
                var remaining = document.querySelectorAll('#notif-archived-view .notification-item');
                if (remaining.length === 0) {
                    var toolbar = document.getElementById('archived-select-btn').closest('.archived-toolbar');
                    if (toolbar) toolbar.remove();
                    var empty = document.createElement('p');
                    empty.className = 'no-notifications';
                    empty.textContent = 'No archived notifications';
                    document.getElementById('notif-archived-view').appendChild(empty);
                }
            });
    });
}


// Archive All (inbox)
var inboxArchiveAllBtn = document.getElementById('inbox-archive-all-btn');
if (inboxArchiveAllBtn) {
    inboxArchiveAllBtn.addEventListener('click', function () {
        var inboxView = document.getElementById('notif-inbox-view');
        var archivedView = document.getElementById('notif-archived-view');

        // Snapshot inbox items before removing them
        var items = Array.from(inboxView.querySelectorAll('.notification-item'));
        var snapshots = items.map(function (el) {
            return {
                id: el.dataset.id,
                message: el.querySelector('.notification-message').textContent,
                time: el.querySelector('.notification-time').textContent
            };
        });

        fetch('/notifications/archive-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.success) return;

                // Clear inbox
                items.forEach(function (el) { el.remove(); });
                var inboxToolbar = inboxView.querySelector('.archived-toolbar');
                if (inboxToolbar) inboxToolbar.remove();
                var emptyInbox = document.createElement('p');
                emptyInbox.className = 'no-notifications';
                emptyInbox.textContent = 'No notifications';
                inboxView.appendChild(emptyInbox);

                // Clear bell badge
                var badge = document.getElementById('notif-unread-badge');
                if (badge) badge.textContent = '0';

                // If archived view has no toolbar yet, inject one
                if (!archivedView.querySelector('.archived-toolbar')) {
                    var emptyMsg = archivedView.querySelector('.no-notifications');
                    if (emptyMsg) emptyMsg.remove();

                    var toolbar = document.createElement('div');
                    toolbar.className = 'archived-toolbar';
                    toolbar.innerHTML = `
                        <button type="button" id="archived-remove-btn" class="archived-remove-btn hidden">Remove</button>
                        <button type="button" id="archived-delete-all-btn" class="archived-remove-btn">Delete All</button>
                        <button type="button" id="archived-select-btn" class="archived-select-btn">Select</button>
                    `;
                    archivedView.prepend(toolbar);

                    // Re-bind toolbar buttons (they didn't exist at page load)
                    var newSelectBtn = toolbar.querySelector('#archived-select-btn');
                    var newRemoveBtn = toolbar.querySelector('#archived-remove-btn');
                    var newDeleteAllBtn = toolbar.querySelector('#archived-delete-all-btn');

                    if (newSelectBtn) {
                        newSelectBtn.addEventListener('click', function () {
                            selectModeActive = !selectModeActive;
                            archivedView.querySelectorAll('.notif-checkbox').forEach(function (cb) {
                                cb.classList.toggle('hidden', !selectModeActive);
                                if (!selectModeActive) cb.checked = false;
                            });
                            newSelectBtn.textContent = selectModeActive ? 'Cancel' : 'Select';
                            newRemoveBtn.classList.toggle('hidden', !selectModeActive);
                        });
                    }
                    if (newRemoveBtn) {
                        newRemoveBtn.addEventListener('click', function () {
                            var checked = archivedView.querySelectorAll('.notif-checkbox:checked');
                            if (checked.length === 0) return;
                            var ids = Array.from(checked).map(function (cb) { return parseInt(cb.value); });
                            fetch('/notifications/delete-bulk', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids: ids })
                            }).then(function (r) { return r.json(); }).then(function (d) {
                                if (!d.success) return;
                                ids.forEach(function (id) {
                                    var el = archivedView.querySelector('.notification-item[data-id="' + id + '"]');
                                    if (el) el.remove();
                                });
                                selectModeActive = false;
                                newSelectBtn.textContent = 'Select';
                                newRemoveBtn.classList.add('hidden');
                                archivedView.querySelectorAll('.notif-checkbox').forEach(function (cb) { cb.classList.add('hidden'); });
                                if (archivedView.querySelectorAll('.notification-item').length === 0) {
                                    toolbar.remove();
                                    var ep = document.createElement('p');
                                    ep.className = 'no-notifications';
                                    ep.textContent = 'No archived notifications';
                                    archivedView.appendChild(ep);
                                }
                            });
                        });
                    }
                    if (newDeleteAllBtn) {
                        newDeleteAllBtn.addEventListener('click', function () {
                            var allItems = archivedView.querySelectorAll('.notification-item');
                            if (allItems.length === 0) return;
                            var ids = Array.from(allItems).map(function (el) { return parseInt(el.dataset.id); });
                            fetch('/notifications/delete-bulk', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids: ids })
                            }).then(function (r) { return r.json(); }).then(function (d) {
                                if (!d.success) return;
                                allItems.forEach(function (el) { el.remove(); });
                                toolbar.remove();
                                var ep = document.createElement('p');
                                ep.className = 'no-notifications';
                                ep.textContent = 'No archived notifications';
                                archivedView.appendChild(ep);
                            });
                        });
                    }
                }

                // Prepend newly archived items to archived view (most recent first)
                snapshots.reverse().forEach(function (s) {
                    var newItem = buildArchivedItem(s.id, s.message, s.time);
                    var firstItem = archivedView.querySelector('.notification-item');
                    if (firstItem) {
                        archivedView.insertBefore(newItem, firstItem);
                    } else {
                        archivedView.appendChild(newItem);
                    }
                });
            });
    });
}

// Delete All (archived)
var archivedDeleteAllBtn = document.getElementById('archived-delete-all-btn');
if (archivedDeleteAllBtn) {
    archivedDeleteAllBtn.addEventListener('click', function () {
        var items = document.querySelectorAll('#notif-archived-view .notification-item');
        if (items.length === 0) return;
        var ids = Array.from(items).map(function (el) { return parseInt(el.dataset.id); });
        fetch('/notifications/delete-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.success) return;
                var archivedView = document.getElementById('notif-archived-view');
                archivedView.querySelectorAll('.notification-item').forEach(function (el) { el.remove(); });
                var toolbar = archivedView.querySelector('.archived-toolbar');
                if (toolbar) toolbar.remove();
                var empty = document.createElement('p');
                empty.className = 'no-notifications';
                empty.textContent = 'No archived notifications';
                archivedView.appendChild(empty);
            });
    });
}


// ── Approved Projects view — shared across all three dashboards ───────────────
// buildApprovedView() groups window.approvedProjects by year→month and renders
// collapsible year sections with per-month data tables into the given container.

function _escHtml(str) {
    if (!str) return '—';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildApprovedView(containerId, projects) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!projects || projects.length === 0) {
        container.innerHTML = '<p class="empty-state">No approved projects yet.</p>';
        return;
    }

    // Group into { year: { monthName: { order: N, rows: [...] } } }
    var grouped = {};
    projects.forEach(function (p) {
        var d = new Date(p.approved_at);
        var yr = d.getFullYear();
        var mo = d.toLocaleString('en-GB', { month: 'long' });
        var moOrd = d.getMonth(); // 0-based, used for sorting
        if (!grouped[yr]) grouped[yr] = {};
        if (!grouped[yr][mo]) grouped[yr][mo] = { order: moOrd, rows: [] };
        grouped[yr][mo].rows.push(p);
    });

    // Render years descending
    var years = Object.keys(grouped).map(Number).sort(function (a, b) { return b - a; });

    years.forEach(function (yr) {
        var yearEl = document.createElement('div');
        yearEl.className = 'approved-year-group';

        // Collapsible year header
        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'approved-year-toggle';
        toggle.innerHTML = '<span class="approved-chevron">▼</span> ' + yr;

        var body = document.createElement('div');
        body.className = 'approved-year-body';

        toggle.addEventListener('click', function () {
            var isOpen = !body.classList.contains('hidden');
            body.classList.toggle('hidden', isOpen);
            toggle.querySelector('.approved-chevron').textContent = isOpen ? '▶' : '▼';
        });

        yearEl.appendChild(toggle);
        yearEl.appendChild(body);

        // Render months descending within the year
        var months = Object.keys(grouped[yr]).sort(function (a, b) {
            return grouped[yr][b].order - grouped[yr][a].order;
        });

        months.forEach(function (mo) {
            var monthLabel = document.createElement('h4');
            monthLabel.className = 'approved-month-label';
            monthLabel.textContent = mo;
            body.appendChild(monthLabel);

            var wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';

            var table = document.createElement('table');
            table.className = 'data-table';

            // Table header
            var thead = document.createElement('thead');
            thead.innerHTML = '<tr>' +
                '<th>Project Name</th>' +
                '<th>Client</th>' +
                '<th>Brief Type</th>' +
                '<th>CS Lead</th>' +
                '<th>Approved By</th>' +
                '<th>Approved Date</th>' +
                '</tr>';
            table.appendChild(thead);

            // Table body — one row per project
            var tbody = document.createElement('tbody');
            grouped[yr][mo].rows.forEach(function (p) {
                var dateStr = p.approved_at_display;
                var briefLabel = (p.brief_type === 'ccm') ? 'C&amp;CM' : 'Standard';

                var tr = document.createElement('tr');
                tr.className = 'clickable';
                tr.dataset.href = p.url;
                tr.innerHTML =
                    '<td>' + _escHtml(p.name) + '</td>' +
                    '<td>' + _escHtml(p.client) + '</td>' +
                    '<td>' + briefLabel + '</td>' +
                    '<td>' + _escHtml(p.cs_lead) + '</td>' +
                    '<td>' + _escHtml(p.approved_by) + '</td>' +
                    '<td class="mono">' + dateStr + '</td>';

                // Make the row clickable (navigate to project detail)
                tr.addEventListener('click', function () {
                    window.location.href = this.dataset.href;
                });
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            wrapper.appendChild(table);
            body.appendChild(wrapper);
        });

        container.appendChild(yearEl);
    });
}

// ── Approved Projects filters ─────────────────────────────────────────────────
    // Three functions work together: 
    // populateApprovedFilters() - runs once on first open, fills the CS lead and designer dropdowns with unique values from window.approvedProjects
    // getFilteredApprovedProjects() - reads the current filter inputs and returns a filtered subset of window.approvedProjects (AND logic across all filters)
    // initApprovedFilters() - Called afteer buildApprovedView() on first tab open; populates dropdowns and wires up all filter event listeners
    function populateApprovedFilters() {
        var projects = window.approvedProjects || [];
        var csSelect = document.getElementById('approved-cs-filter');
        var designerSelect = document.getElementById('approved-designer-filter');
        if (!csSelect || !designerSelect) return;

        // Collect unique CS leads and designers using objects as sets (key = name)
        var csLeads = {}, designers = {};
        projects.forEach(function (p) {
            if (p.cs_lead) csLeads[p.cs_lead] = true;
            (p.assigned_designers || []).forEach(function (d) { designers[d] = true; });
        });

        // Sort alphabetically and append as <option> elements
        Object.keys(csLeads).sort().forEach(function (name) {
            var opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            csSelect.appendChild(opt);
        });

        Object.keys(designers).sort().forEach(function (name) {
            var opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            designerSelect.appendChild(opt);
        });
    }

    function getFilteredApprovedProjects() {

        // Read current values from all 5 filter inputs (|| {} guards against missing elements)
        var nameQ = (document.getElementById('approved-search') || {}).value || '';
        var csQ = (document.getElementById('approved-cs-filter') || {}).value || '';
        var designerQ = (document.getElementById('approved-designer-filter') || {}).value || '';
        var fromVal = (document.getElementById('approved-from') || {}).value || '';
        var toVal = (document.getElementById('approved-to') || {}).value || '';

        nameQ = nameQ.trim().toLowerCase();

        // Parse date inputs into Date objects; extend toDate to end of day so the full "to" date is included (not just midnight of that day)
        var fromDate = fromVal ? new Date(fromVal) : null;
        var toDate = toVal ? new Date(toVal) : null;
        if (toDate) toDate.setHours(23, 59, 59, 999);

        return (window.approvedProjects || []).filter(function (p) {
            // Empty filter value = match everything (no restriction applied)
            var matchName = !nameQ || p.name.toLowerCase().indexOf(nameQ) !== -1;
            var matchCS = !csQ || p.cs_lead === csQ;

            // indexOf works on the assigned_designers string array
            var matchDesigner = !designerQ || (p.assigned_designers || []).indexOf(designerQ) !== -1;

            // p.approved_at is a UTC ISO string - parse for date comparison
            var pDate = new Date(p.approved_at);
            var matchFrom = !fromDate || pDate >= fromDate;
            var matchTo = !toDate || pDate <= toDate;

            // All conditions must be pass (AND logic)
            return matchName && matchCS && matchDesigner && matchFrom && matchTo;
        });
    }

    function initApprovedFilters() {
        // Populate the CS lead and designer dropdowns on first call
        populateApprovedFilters();

        // Wire up all filter inputs — any change re-renders with the filtered list
        var inputs = ['approved-search', 'approved-cs-filter', 'approved-designer-filter', 'approved-from', 'approved-to'];
        inputs.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', function () {
                buildApprovedView('approved-projects-container', getFilteredApprovedProjects());
            });
        });

        // Clear button resets all inputs and re-renders the full unfiltered list
        var clearBtn = document.getElementById('approved-clear-filters');
        if (clearBtn) clearBtn.addEventListener('click', function () {
            inputs.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.value = '';
            });
            buildApprovedView('approved-projects-container', window.approvedProjects || []);
        });
    }



    // Shared approved-projects toggle elements — present on all three dashboards
    var btnApprovedProjects = document.getElementById('btn-approved-projects');
    var approvedProjectsView = document.getElementById('approved-projects-view');

    // Team lead + designer toggle — team view / personal view / approved projects
    const btnTeamView = document.getElementById('btn-team-view');
    const btnPersonalView = document.getElementById('btn-personal-view');
    const teamView = document.getElementById('team-view');
    const personalView = document.getElementById('personal-view');

    if (btnTeamView && btnPersonalView && teamView && personalView) {
        var dtAllViews = [teamView, personalView];
        var dtAllBtns = [btnTeamView, btnPersonalView];
        if (approvedProjectsView) dtAllViews.push(approvedProjectsView);
        if (btnApprovedProjects) dtAllBtns.push(btnApprovedProjects);

        function switchDTView(activeBtn, activeView) {
            dtAllViews.forEach(function (v) { v.classList.add('hidden'); });
            dtAllBtns.forEach(function (b) { b.classList.remove('active'); });
            activeView.classList.remove('hidden');
            activeBtn.classList.add('active');
        }

        btnTeamView.addEventListener('click', function () { switchDTView(btnTeamView, teamView); });
        btnPersonalView.addEventListener('click', function () { switchDTView(btnPersonalView, personalView); });

        if (btnApprovedProjects && approvedProjectsView) {
            btnApprovedProjects.addEventListener('click', function () {
                switchDTView(btnApprovedProjects, approvedProjectsView);
                // Lazy-render on first open so we don't build the DOM unnecessarily
                if (!approvedProjectsView.dataset.rendered) {
                    buildApprovedView('approved-projects-container', window.approvedProjects || []);
                    initApprovedFilters();
                    approvedProjectsView.dataset.rendered = '1';
                }
            });
        }
    }

    // Conditional team dropdown on register page - shows team selector for designer/team_lead roles
    const roleSelect = document.getElementById('role');
    const teamGroup = document.getElementById('team-group');
    const teamSelect = document.getElementById('team');

    if (roleSelect && teamGroup && teamSelect) {
        roleSelect.addEventListener('change', function () {
            const needsTeam = this.value === 'designer' || this.value === 'team_lead';

            if (needsTeam) {
                teamGroup.classList.remove('hidden');
                teamSelect.required = true;
            } else {
                teamGroup.classList.add('hidden');
                teamSelect.required = false;
                teamSelect.value = '';
            }
        });
    }

    // CS dashboard toggle — my projects / all projects / approved projects
    const btnMyProjects = document.getElementById('btn-my-projects');
    const btnAllProjects = document.getElementById('btn-all-projects');
    const myProjectsView = document.getElementById('my-projects-view');
    const allProjectsView = document.getElementById('all-projects-view');

    if (btnMyProjects && btnAllProjects && myProjectsView && allProjectsView) {
        var csAllViews = [myProjectsView, allProjectsView];
        var csAllBtns = [btnMyProjects, btnAllProjects];
        if (approvedProjectsView) csAllViews.push(approvedProjectsView);
        if (btnApprovedProjects) csAllBtns.push(btnApprovedProjects);

        function switchCSView(activeBtn, activeView) {
            csAllViews.forEach(function (v) { v.classList.add('hidden'); });
            csAllBtns.forEach(function (b) { b.classList.remove('active'); });
            activeView.classList.remove('hidden');
            activeBtn.classList.add('active');
        }

        btnMyProjects.addEventListener('click', function () { switchCSView(btnMyProjects, myProjectsView); });
        btnAllProjects.addEventListener('click', function () { switchCSView(btnAllProjects, allProjectsView); });

        if (btnApprovedProjects && approvedProjectsView) {
            btnApprovedProjects.addEventListener('click', function () {
                switchCSView(btnApprovedProjects, approvedProjectsView);
                // Lazy-render on first open
                if (!approvedProjectsView.dataset.rendered) {
                    buildApprovedView('approved-projects-container', window.approvedProjects || []);
                    initApprovedFilters();
                    approvedProjectsView.dataset.rendered = '1';
                }
            });
        }
    }

    // Account dropdown toggle
    const accountTrigger = document.getElementById('account-trigger');
    const accountDropdown = document.getElementById('account-dropdown');

    if (accountTrigger && accountDropdown) {
        accountTrigger.addEventListener('click', function (event) {
            event.stopPropagation();
            accountDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', function (event) {
            if (!accountDropdown.classList.contains('hidden')) {
                if (!accountDropdown.contains(event.target) && event.target !== accountTrigger) {
                    accountDropdown.classList.add('hidden');
                }
            }
        });
    }

    // ============================================================
    // DRAFTS PAGE
    // ============================================================

    const draftItems = document.querySelectorAll('.draft-item');
    const draftConfirmOverlay = document.getElementById('draftConfirmOverlay');
    const draftConfirmYes = document.getElementById('draftConfirmYes');
    const draftConfirmCancel = document.getElementById('draftConfirmCancel');

    if (draftItems.length > 0) {

        let pendingDeleteId = null;
        let pendingDeleteRow = null;

        draftItems.forEach(function (item) {
            item.addEventListener('click', function () {
                const isActive = this.classList.contains('active');
                draftItems.forEach(function (i) { i.classList.remove('active'); });
                if (!isActive) {
                    this.classList.add('active');
                }
            });
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.draft-item')) {
                draftItems.forEach(function (i) { i.classList.remove('active'); });
            }
        });

        document.querySelectorAll('.draft-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                pendingDeleteId = this.dataset.draftId;
                pendingDeleteRow = this.closest('.draft-item');
                if (draftConfirmOverlay) {
                    draftConfirmOverlay.classList.remove('hidden');
                }
            });
        });

        if (draftConfirmYes) {
            draftConfirmYes.addEventListener('click', function () {
                if (!pendingDeleteId) return;

                fetch('/projects/drafts/' + pendingDeleteId + '/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        if (data.success) {
                            if (draftConfirmOverlay) {
                                draftConfirmOverlay.classList.add('hidden');
                            }
                            if (pendingDeleteRow) {
                                const rowHeight = pendingDeleteRow.offsetHeight;
                                pendingDeleteRow.style.transition = 'opacity 0.25s ease, max-height 0.35s ease 0.2s, margin-bottom 0.35s ease 0.2s, padding 0.35s ease 0.2s';
                                pendingDeleteRow.style.overflow = 'hidden';
                                pendingDeleteRow.style.maxHeight = rowHeight + 'px';
                                pendingDeleteRow.style.opacity = '0';
                                setTimeout(function () {
                                    pendingDeleteRow.style.maxHeight = '0';
                                    pendingDeleteRow.style.marginBottom = '0';
                                    pendingDeleteRow.style.padding = '0';
                                }, 250);
                                setTimeout(function () {
                                    pendingDeleteRow.remove();
                                    const remaining = document.querySelectorAll('.draft-item');
                                    if (remaining.length === 0) {
                                        window.location.href = '/';
                                    }
                                }, 850);
                            }
                            pendingDeleteId = null;
                            pendingDeleteRow = null;
                        }
                    })
                    .catch(function (err) {
                        console.error('Draft delete failed:', err);
                    });
            });
        }

        if (draftConfirmCancel) {
            draftConfirmCancel.addEventListener('click', function () {
                if (draftConfirmOverlay) {
                    draftConfirmOverlay.classList.add('hidden');
                }
                pendingDeleteId = null;
                pendingDeleteRow = null;
            });
        }

    }

    // ── Toast Notifications ──────────────────────────────────────
    function showToast(message, type) {
        var existing = document.getElementById('helixToast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id = 'helixToast';
        toast.textContent = message;

        toast.style.position = 'fixed';
        toast.style.top = '24px';
        toast.style.right = '0';
        toast.style.zIndex = '9999';
        toast.style.padding = '16px 24px';
        toast.style.borderRadius = '6px 0 0 6px';
        toast.style.fontSize = '0.9rem';
        toast.style.fontFamily = 'var(--font-sans)';
        toast.style.boxShadow = '-4px 4px 16px rgba(0,0,0,0.12)';
        toast.style.borderLeft = '5px solid var(--tangerine)';
        toast.style.transform = 'translateX(110%)';
        toast.style.transition = 'transform 0.35s ease';
        toast.style.maxWidth = '320px';

        if (type === 'success') {
            toast.style.backgroundColor = 'var(--pine)';
            toast.style.color = '#ffffff';
        } else {
            toast.style.backgroundColor = 'var(--rose)';
            toast.style.color = '#1a1a1a';
        }

        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                toast.style.transform = 'translateX(0)';
            });
        });

        setTimeout(function () {
            toast.style.transform = 'translateX(110%)';
            setTimeout(function () {
                toast.remove();
            }, 350);
        }, 5000);
    }

    // ============================================================
    // CREATE PROJECT PAGE
    // ============================================================

    if (document.getElementById('sectionBasics')) {

        // ── State ────────────────────────────────────────────────
        let currentDraftId = null;
        let autosaveTimeout = null;
        const briefSavedState = {};

        // ── Completion Bar ───────────────────────────────────────
        var currentCompletion = 0;

        function calculateCompletion() {
            if (typeof EDIT_MODE !== 'undefined' && EDIT_MODE) {
                document.getElementById('completionBarFill').style.width = '100%';
                document.getElementById('completionLabel').textContent = '100% Complete';
                currentCompletion = 100;
                return;
            }

            let score = 0;

            const basicChecks = [
                function () { return document.getElementById('client_id').value !== ''; },
                function () { return document.getElementById('project_name').value.trim() !== ''; },
                function () { return document.getElementById('cs_lead_id').value !== ''; },
                function () { return document.getElementById('job_number').value.trim() !== ''; },
                function () { return document.querySelectorAll('input[name="design_teams"]:checked').length > 0; },
                function () { return document.getElementById('briefing_date').value !== ''; },
                function () { return document.getElementById('first_output_deadline').value !== ''; },
                function () { return document.getElementById('final_deadline').value !== ''; },
            ];

            var basicWeight = 25 / basicChecks.length;
            basicChecks.forEach(function (check) {
                if (check()) score += basicWeight;
            });

            var briefType = document.getElementById('brief_type').value;
            if (briefType === 'ccm') {
                // Only urgency is required — region/customers/deliverables are optional at
                // creation time and can be filled in later via Edit Project.
                var ccmChecks = [
                    function () { return document.getElementById('urgency').value !== ''; },
                ];
                var ccmWeight = 75 / ccmChecks.length;
                ccmChecks.forEach(function (check) {
                    if (check()) score += ccmWeight;
                });
            } else if (briefType === 'standard') {
                // Only design_type_id remains — design_direction was removed from the brief form
                var standardChecks = [
                    function () { return document.getElementById('design_type_id') && document.getElementById('design_type_id').value !== ''; },
                ];
                var standardWeight = 75 / standardChecks.length;
                standardChecks.forEach(function (check) {
                    if (check()) score += standardWeight;
                });
            }

            var pct = Math.min(Math.round(score), 100);
            document.getElementById('completionBarFill').style.width = pct + '%';
            document.getElementById('completionLabel').textContent = pct + '% Complete';
            currentCompletion = pct;
        }

        // ── Brief Type Switcher ──────────────────────────────────
        function switchBriefType(type) {
            var currentType = document.getElementById('brief_type').value;
            if (currentType) {
                briefSavedState[currentType] = captureBriefState(currentType);
            }

            document.getElementById('brief_type').value = type;

            document.querySelectorAll('.brief-type-btn').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.type === type);
            });

            var isCCM = type === 'ccm';
            document.getElementById('sectionConceptKV').classList.add('hidden');
            document.getElementById('sectionCCM').classList.toggle('hidden', !isCCM);
            var conceptKVToggleBtn = document.getElementById('btnConceptKVToggle');
            if (conceptKVToggleBtn) conceptKVToggleBtn.classList.remove('active');
            var hasConceptEl2 = document.getElementById('has_concept');
            if (hasConceptEl2) hasConceptEl2.value = 'false';
            document.getElementById('sectionDeliverables').classList.toggle('hidden', true);
            document.getElementById('sectionStandard').classList.toggle('hidden', type !== 'standard');

            if (briefSavedState[type]) {
                restoreBriefState(type, briefSavedState[type]);
            }

            calculateCompletion();
            scheduleAutosave();
        }

        function captureBriefState(type) {
            if (type === 'ccm') {
                return {
                    urgency: document.getElementById('urgency').value,
                    region_uae: document.getElementById('region_uae').classList.contains('active'),
                    region_gulf: document.getElementById('region_gulf').classList.contains('active'),
                    gulf_kuwait: document.getElementById('gulf_kuwait').classList.contains('active'),
                    gulf_qatar: document.getElementById('gulf_qatar').classList.contains('active'),
                    gulf_bahrain: document.getElementById('gulf_bahrain').classList.contains('active'),
                    gulf_oman: document.getElementById('gulf_oman').classList.contains('active'),
                };
            }
            return {};
        }

        function restoreBriefState(type, state) {
            if (type === 'ccm') {
                document.getElementById('urgency').value = state.urgency || '';

                var uaeBtn = document.getElementById('region_uae');
                var gulfBtn = document.getElementById('region_gulf');
                if (state.region_uae) { uaeBtn.classList.add('active'); } else { uaeBtn.classList.remove('active'); }
                if (state.region_gulf) { gulfBtn.classList.add('active'); } else { gulfBtn.classList.remove('active'); }

                ['kuwait', 'qatar', 'bahrain', 'oman'].forEach(function (c) {
                    var btn = document.getElementById('gulf_' + c);
                    if (btn) {
                        if (state['gulf_' + c]) { btn.classList.add('active'); } else { btn.classList.remove('active'); }
                    }
                });

                handleRegionChange();

                ['kuwait', 'qatar', 'bahrain', 'oman'].forEach(function (c) {
                    if (state['gulf_' + c]) {
                        buildGulfCountryCustomers(c);
                    }
                });
            }
        }

        // ── Customer List Builders ───────────────────────────────
        function buildCustomerChecklist(region, containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;

            var customers = CUSTOMERS_BY_REGION[region] || [];

            customers.forEach(function (customer) {
                var existing = container.querySelector('[data-customer-id="' + customer.id + '"]');
                if (existing) return;

                var pill = document.createElement('div');
                pill.className = 'customer-pill';
                pill.dataset.customerId = customer.id;
                pill.dataset.customerName = customer.name;
                pill.dataset.region = region;
                pill.textContent = customer.name;

                pill.addEventListener('click', function () {
                    this.classList.toggle('selected');
                    handleCustomerToggle(this);
                    calculateCompletion();
                    scheduleAutosave();
                });

                container.appendChild(pill);
            });
        }

        function selectAllCustomers(containerId, btn) {
            var container = document.getElementById(containerId);
            if (!container) return;
            var pills = container.querySelectorAll('.customer-pill');
            var allSelected = Array.from(pills).every(function (p) { return p.classList.contains('selected'); });

            if (allSelected) {
                pills.forEach(function (pill) {
                    pill.classList.remove('selected');
                    handleCustomerToggle(pill);
                });
                if (btn) btn.textContent = 'Select All';
            } else {
                pills.forEach(function (pill) {
                    if (!pill.classList.contains('selected')) {
                        pill.classList.add('selected');
                        handleCustomerToggle(pill);
                    }
                });
                if (btn) btn.textContent = 'Deselect All';
            }
            calculateCompletion();
            scheduleAutosave();
        }

        function buildGulfCountryCustomers(country) {
            var grid = document.getElementById('gulfCustomerGrid');
            if (grid.querySelector('[data-country="' + country + '"]')) return;

            var customers = CUSTOMERS_BY_REGION[country] || [];
            if (customers.length === 0) return;

            var block = document.createElement('div');
            block.className = 'gulf-country-block';
            block.dataset.country = country;

            var label = document.createElement('div');
            label.className = 'gulf-country-label';
            label.textContent = country.charAt(0).toUpperCase() + country.slice(1) + ' Customers';
            block.appendChild(label);

            var checklist = document.createElement('div');
            checklist.className = 'customer-checklist';
            checklist.id = 'gulfCustomers_' + country;
            block.appendChild(checklist);

            var selectAllBtn = document.createElement('button');
            selectAllBtn.type = 'button';
            selectAllBtn.className = 'btn btn--secondary btn--sm';
            selectAllBtn.textContent = 'Select All';
            selectAllBtn.addEventListener('click', function () {
                selectAllCustomers('gulfCustomers_' + country, this);
            });
            block.insertBefore(selectAllBtn, checklist);

            grid.appendChild(block);
            buildCustomerChecklist(country, 'gulfCustomers_' + country);
        }

        function removeGulfCountryCustomers(country) {
            var grid = document.getElementById('gulfCustomerGrid');
            var block = grid.querySelector('[data-country="' + country + '"]');
            if (block) {
                block.querySelectorAll('.customer-pill.selected').forEach(function (pill) {
                    removeDeliverableBlock(pill.dataset.customerId);
                });
                block.remove();
            }
        }

        // ── Region Handling ──────────────────────────────────────
        function handleRegionChange() {
            var uaeActive = document.getElementById('region_uae').classList.contains('active');
            var gulfActive = document.getElementById('region_gulf').classList.contains('active');

            var uaeBlock = document.getElementById('blockUAECustomers');
            var gulfBlock = document.getElementById('blockGulf');

            if (uaeActive) {
                uaeBlock.classList.remove('hidden');
                buildCustomerChecklist('uae', 'uaeCustomerList');
            } else {
                uaeBlock.classList.add('hidden');
                document.querySelectorAll('#uaeCustomerList .customer-pill.selected').forEach(function (pill) {
                    removeDeliverableBlock(pill.dataset.customerId);
                });
            }

            if (gulfActive) {
                gulfBlock.classList.remove('hidden');
            } else {
                gulfBlock.classList.add('hidden');
                ['kuwait', 'qatar', 'bahrain', 'oman'].forEach(function (country) {
                    var el = document.getElementById('gulf_' + country);
                    if (el) el.classList.remove('active');
                    removeGulfCountryCustomers(country);
                });
            }

            calculateCompletion();
        }

        // ── Customer Toggle ──────────────────────────────────────
        function handleCustomerToggle(pill) {
            if (pill.classList.contains('selected')) {
                addDeliverableBlock(
                    pill.dataset.customerId,
                    pill.dataset.customerName,
                    pill.dataset.region
                );
            } else {
                removeDeliverableBlock(pill.dataset.customerId);
            }
        }

        // ── Deliverable Blocks ───────────────────────────────────
        function addDeliverableBlock(customerId, customerName, region) {
            var body = document.getElementById('deliverablesBody');
            if (body.querySelector('[data-customer-id="' + customerId + '"]')) return;

            document.getElementById('sectionDeliverables').classList.remove('hidden');

            var regionSection = body.querySelector(
                '.deliverables-region-section[data-region="' + region + '"]'
            );
            if (!regionSection) {
                regionSection = document.createElement('div');
                regionSection.className = 'deliverables-region-section';
                regionSection.dataset.region = region;

                var heading = document.createElement('div');
                heading.className = 'deliverables-region-heading';
                heading.textContent = region === 'uae' ? 'UAE' :
                    region.charAt(0).toUpperCase() + region.slice(1);
                regionSection.appendChild(heading);

                if (region !== 'uae') {
                    var applyBtn = document.createElement('button');
                    applyBtn.type = 'button';
                    applyBtn.className = 'btn btn--secondary apply-dates-btn';
                    applyBtn.textContent = 'Apply same dates to all ' +
                        region.charAt(0).toUpperCase() + region.slice(1) + ' customers';
                    applyBtn.addEventListener('click', function () {
                        applyDatesToRegion(region);
                    });
                    regionSection.appendChild(applyBtn);
                }

                body.appendChild(regionSection);
            }

            var block = document.createElement('div');
            block.className = 'deliverables-customer-block';
            block.dataset.customerId = customerId;

            // Build the 00:00–23:00 time options once and reuse per block
            var timeOptions = '<option value="">— Any —</option>';
            for (var h = 0; h < 24; h++) {
                var hh = (h < 10 ? '0' : '') + h + ':00';
                timeOptions += '<option value="' + hh + '">' + hh + '</option>';
            }

            block.innerHTML =
                '<h4 class="deliverables-customer-heading">' + customerName + '</h4>' +
                '<div class="deliverables-customer-dates">' +
                '<div class="customer-date-field">' +
                '<label class="customer-date-label">Design Deadline</label>' +
                '<input type="date" class="form-input" id="design_deadline_' + customerId + '">' +
                '</div>' +
                '<div class="customer-date-field">' +
                '<label class="customer-date-label">Time</label>' +
                '<select class="form-select" id="design_deadline_time_' + customerId + '" style="max-width:110px;">' +
                timeOptions +
                '</select>' +
                '</div>' +
                '<div class="customer-date-field">' +
                '<label class="customer-date-label">Installation Date</label>' +
                '<input type="date" class="form-input" id="installation_date_' + customerId + '">' +
                '</div>' +
                '</div>' +
                '<div class="deliverable-rows" id="deliverableRows_' + customerId + '"></div>' +
                '<button type="button" class="btn-add-inline add-deliverable-btn" ' +
                'data-customer-id="' + customerId + '">+ Add Deliverable</button>';

            var applyBtn = regionSection.querySelector('.apply-dates-btn');
            if (applyBtn) {
                regionSection.insertBefore(block, applyBtn);
            } else {
                regionSection.appendChild(block);
            }

            block.querySelector('.add-deliverable-btn').addEventListener('click', function () {
                fetchAndShowDeliverableSelector(customerId);
            });
        }

        function removeDeliverableBlock(customerId) {
            var block = document.querySelector(
                '.deliverables-customer-block[data-customer-id="' + customerId + '"]'
            );
            if (block) {
                var regionSection = block.closest('.deliverables-region-section');
                block.remove();
                if (regionSection &&
                    regionSection.querySelectorAll('.deliverables-customer-block').length === 0) {
                    regionSection.remove();
                }
            }

            if (document.querySelectorAll('.deliverables-customer-block').length === 0) {
                document.getElementById('sectionDeliverables').classList.add('hidden');
            }
            calculateCompletion();
        }

        function applyDatesToRegion(region) {
            var blocks = document.querySelectorAll(
                '.deliverables-region-section[data-region="' + region + '"] .deliverables-customer-block'
            );
            if (blocks.length < 2) return;

            var firstId = blocks[0].dataset.customerId;
            var designVal = document.getElementById('design_deadline_' + firstId).value;
            var timeEl = document.getElementById('design_deadline_time_' + firstId);
            var timeVal = timeEl ? timeEl.value : '';
            var installVal = document.getElementById('installation_date_' + firstId).value;

            for (var i = 1; i < blocks.length; i++) {
                var cid = blocks[i].dataset.customerId;
                var ddEl = document.getElementById('design_deadline_' + cid);
                var ddtEl = document.getElementById('design_deadline_time_' + cid);
                var instEl = document.getElementById('installation_date_' + cid);
                if (ddEl) ddEl.value = designVal;
                if (ddtEl) ddtEl.value = timeVal;
                if (instEl) instEl.value = installVal;
            }
        }

        // ── Deliverable Selector ─────────────────────────────────
        function fetchAndShowDeliverableSelector(customerId) {
            var clientId = document.getElementById('client_id').value;
            fetch('/projects/deliverable-types/' + customerId + '?client_id=' + clientId)
                .then(function (res) { return res.json(); })
                .then(function (types) {
                    showDeliverableSelector(customerId, clientId, types);
                })
                .catch(function (err) {
                    console.error('Could not load deliverable types:', err);
                });
        }

        function showDeliverableSelector(customerId, clientId, types) {
            var existingSelector = document.getElementById('delSelector_' + customerId);
            if (existingSelector) existingSelector.remove();

            var rowsContainer = document.getElementById('deliverableRows_' + customerId);

            var selector = document.createElement('div');
            selector.id = 'delSelector_' + customerId;
            selector.style.marginTop = '10px';

            var select = document.createElement('select');
            select.className = 'form-select';

            var defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = '— Select deliverable —';
            select.appendChild(defaultOpt);

            types.forEach(function (type) {
                var opt = document.createElement('option');
                opt.value = type.id;
                opt.textContent = type.is_custom ? type.name + ' (Custom)' : type.name;
                opt.dataset.disciplines = JSON.stringify(type.disciplines);
                select.appendChild(opt);
            });

            var customOpt = document.createElement('option');
            customOpt.value = 'custom';
            customOpt.textContent = '+ Add custom deliverable';
            select.appendChild(customOpt);

            selector.appendChild(select);
            rowsContainer.after(selector);

            select.addEventListener('change', function () {
                var selected = this.options[this.selectedIndex];
                if (this.value === 'custom') {
                    selector.remove();
                    showCustomDeliverableForm(customerId, clientId, types);
                } else if (this.value) {
                    var disciplines = JSON.parse(selected.dataset.disciplines);
                    addDeliverableRow(customerId, this.value, selected.text, disciplines);
                    selector.remove();
                }
            });
        }

        function addDeliverableRow(customerId, typeId, name, disciplines) {
            var rowsContainer = document.getElementById('deliverableRows_' + customerId);

            var row = document.createElement('div');
            row.className = 'deliverable-row';
            row.dataset.typeId = typeId;
            row.dataset.name = name;

            var disciplineTags = disciplines.map(function (d) {
                return '<span class="discipline-tag tag--' + d + '">' + d.toUpperCase() + '</span>';
            }).join('');

            row.innerHTML =
                '<span class="deliverable-row-name">' + name + '</span>' +
                '<div class="deliverable-row-disciplines">' + disciplineTags + '</div>' +
                '<button type="button" class="btn-remove-deliverable" title="Remove">&times;</button>';

            row.querySelector('.btn-remove-deliverable').addEventListener('click', function () {
                row.remove();
                calculateCompletion();
            });

            rowsContainer.appendChild(row);
            calculateCompletion();
        }

        function showCustomDeliverableForm(customerId, clientId, types) {
            var rowsContainer = document.getElementById('deliverableRows_' + customerId);

            var form = document.createElement('div');
            form.className = 'inline-add-form';
            form.style.flexDirection = 'column';
            form.style.alignItems = 'flex-start';
            form.style.gap = '8px';
            form.style.marginTop = '10px';

            var nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'form-input';
            nameInput.placeholder = 'Deliverable name';

            var disciplineRow = document.createElement('div');
            disciplineRow.style.display = 'flex';
            disciplineRow.style.gap = '12px';

            ['2d', '3d', 'technical'].forEach(function (d) {
                var lbl = document.createElement('label');
                lbl.style.display = 'flex';
                lbl.style.alignItems = 'center';
                lbl.style.gap = '4px';
                lbl.style.fontSize = '0.85rem';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = d;
                lbl.appendChild(cb);
                lbl.appendChild(document.createTextNode(d.toUpperCase()));
                disciplineRow.appendChild(lbl);
            });

            var warningMsg = document.createElement('div');
            warningMsg.style.color = 'var(--rose)';
            warningMsg.style.fontSize = '0.85rem';
            warningMsg.style.display = 'none';

            var btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.gap = '8px';

            var confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.className = 'btn btn--primary btn--sm';
            confirmBtn.textContent = 'Add';

            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn--secondary btn--sm';
            cancelBtn.textContent = 'Cancel';

            btnRow.appendChild(confirmBtn);
            btnRow.appendChild(cancelBtn);

            form.appendChild(nameInput);
            form.appendChild(disciplineRow);
            form.appendChild(warningMsg);
            form.appendChild(btnRow);

            rowsContainer.after(form);

            confirmBtn.addEventListener('click', function () {
                var name = nameInput.value.trim();
                var disciplines = Array.from(
                    form.querySelectorAll('input[type="checkbox"]:checked')
                ).map(function (cb) { return cb.value; });

                warningMsg.style.display = 'none';
                warningMsg.textContent = '';
                nameInput.style.borderColor = '';

                if (!name) {
                    warningMsg.textContent = 'Please enter a deliverable name.';
                    warningMsg.style.display = 'block';
                    nameInput.style.borderColor = 'var(--rose)';
                    return;
                }

                if (disciplines.length === 0) {
                    warningMsg.textContent = 'Please select at least one discipline.';
                    warningMsg.style.display = 'block';
                    return;
                }

                var duplicate = types.find(function (t) {
                    return t.name.toLowerCase() === name.toLowerCase();
                });

                if (duplicate) {
                    warningMsg.textContent = 'A deliverable called "' + name + '" already exists for this customer.';
                    warningMsg.style.display = 'block';
                    nameInput.style.borderColor = 'var(--rose)';
                    return;
                }

                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Saving...';

                fetch('/projects/deliverable-types/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        client_id: clientId,
                        customer_id: customerId,
                        disciplines: disciplines
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        if (data.error) {
                            warningMsg.textContent = data.error;
                            warningMsg.style.display = 'block';
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = 'Add';
                            return;
                        }
                        types.push({ id: data.id, name: data.name, disciplines: data.disciplines, is_custom: true });
                        addDeliverableRow(customerId, data.id, data.name, data.disciplines, true);
                        form.remove();
                    })
                    .catch(function (err) {
                        warningMsg.textContent = 'Something went wrong. Please try again.';
                        warningMsg.style.display = 'block';
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'Add';
                    });
            });

            cancelBtn.addEventListener('click', function () {
                form.remove();
            });
        }

        // ── Autosave ─────────────────────────────────────────────
        function collectFormData() {
            var teams = Array.from(
                document.querySelectorAll('input[name="design_teams"]:checked')
            ).map(function (cb) { return cb.value; });

            // Concept & KV are now merged — has_kv always mirrors has_concept
            var hasConceptMergedEl = document.getElementById('has_concept');
            var hasKv = hasConceptMergedEl ? hasConceptMergedEl.value === 'true' : false;

            var customerDates = {};
            document.querySelectorAll('.deliverables-customer-block').forEach(function (block) {
                var cid = block.dataset.customerId;
                var ddEl = document.getElementById('design_deadline_' + cid);
                var ddtEl = document.getElementById('design_deadline_time_' + cid);
                var instEl = document.getElementById('installation_date_' + cid);
                customerDates[cid] = {
                    design_deadline: ddEl ? ddEl.value || null : null,
                    design_deadline_time: ddtEl ? ddtEl.value || null : null,
                    installation_date: instEl ? instEl.value || null : null
                };
            });

            return {
                draft_id: currentDraftId,
                name: document.getElementById('project_name').value.trim(),
                client_id: document.getElementById('client_id').value || null,
                cs_lead_id: document.getElementById('cs_lead_id').value || null,
                job_number: document.getElementById('job_number').value.trim() || null,
                design_teams: teams,
                brief_type: document.getElementById('brief_type').value || null,
                urgency: document.getElementById('urgency') ? document.getElementById('urgency').value || null : null,
                required_output: document.getElementById('required_output') ? document.getElementById('required_output').value || null : null,
                concept_requirements: document.getElementById('concept_requirements') ? document.getElementById('concept_requirements').value.trim() || null : null,
                concept_deadline: document.getElementById('concept_deadline') ? document.getElementById('concept_deadline').value || null : null,
                concept_deadline_time: document.getElementById('concept_deadline_time') ? document.getElementById('concept_deadline_time').value || null : null,
                has_concept: document.getElementById('has_concept') ? document.getElementById('has_concept').value === 'true' : false,
                concept_options_required: document.getElementById('concept_options_required') ? parseInt(document.getElementById('concept_options_required').value) || null : null,
                has_kv: hasKv,  // always mirrors has_concept — merged in UI
                kv_requirements: null,
                kv_deadline: null,
                kv_options_required: null,
                briefing_date: document.getElementById('briefing_date') ? document.getElementById('briefing_date').value || null : null,
                first_output_deadline: document.getElementById('first_output_deadline') ? document.getElementById('first_output_deadline').value || null : null,
                final_deadline: document.getElementById('final_deadline') ? document.getElementById('final_deadline').value || null : null,
                customer_dates: customerDates,
                standard_deliverables: (function () { var el = document.getElementById('standard_deliverables_json'); try { return el ? JSON.parse(el.value || '[]') : []; } catch (e) { return []; } })(),
                design_type_id: document.getElementById('design_type_id') ? document.getElementById('design_type_id').value || null : null,
                design_direction_id: document.getElementById('design_direction_id') ? document.getElementById('design_direction_id').value || null : null,
                client_expectation: document.getElementById('client_expectation') ? document.getElementById('client_expectation').value.trim() || null : null,
                what_to_avoid: document.getElementById('what_to_avoid') ? document.getElementById('what_to_avoid').value.trim() || null : null,
                additional_information: document.getElementById('additional_information') ? document.getElementById('additional_information').value.trim() || null : null,
            };
        }

        function hasAnyData(data) {
            return data.name || data.client_id || data.job_number ||
                data.design_teams.length > 0 || data.briefing_date ||
                data.brief_type;
        }

        function autosave() {
            var data = collectFormData();
            if (!hasAnyData(data)) return;

            var statusEl = document.getElementById('autosaveStatus');
            statusEl.textContent = 'Saving...';

            fetch('/projects/autosave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) {
                        currentDraftId = result.draft_id;

                        // Show saved confirmation, then fade it out after 2s
                        statusEl.textContent = 'Saved ✓';
                        setTimeout(function () { statusEl.textContent = ''; }, 2000);

                        // Enable the reference file upload button now that a draft exists
                        var createRefBtn = document.getElementById('createRefFileBtn');
                        if (createRefBtn && !createRefBtn.dataset.projectId) {
                            createRefBtn.dataset.projectId = result.draft_id;
                            createRefBtn.disabled = false;
                            var createStatus = document.getElementById('createRefFileStatus');
                            if (createStatus) createStatus.textContent = '';
                        }
                    } else {
                        // Server returned success: false — show the error message
                        statusEl.textContent = 'Save failed';
                    }
                })
                .catch(function () {
                    // Network or parse error
                    statusEl.textContent = 'Save failed';
                });
        }

        function scheduleAutosave() {
            if (typeof EDIT_MODE !== 'undefined' && EDIT_MODE) return;
            clearTimeout(autosaveTimeout);
            autosaveTimeout = setTimeout(autosave, 5000);
        }

        // ── Add New Client ────────────────────────────────────────
        function setupAddClient() {
            var btnAdd = document.getElementById('btnAddClient');
            var addForm = document.getElementById('addClientForm');
            var confirmBtn = document.getElementById('confirmAddClient');
            var cancelBtn = document.getElementById('cancelAddClient');
            var nameInput = document.getElementById('newClientName');
            var select = document.getElementById('client_id');

            if (!btnAdd) return;

            btnAdd.addEventListener('click', function () {
                addForm.classList.remove('hidden');
                nameInput.focus();
            });

            cancelBtn.addEventListener('click', function () {
                addForm.classList.add('hidden');
                nameInput.value = '';
            });

            confirmBtn.addEventListener('click', function () {
                var name = nameInput.value.trim();
                if (!name) return;

                fetch('/clients/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        if (data.success) {
                            var option = document.createElement('option');
                            option.value = data.client.id;
                            option.textContent = data.client.name;
                            option.selected = true;
                            select.appendChild(option);
                            addForm.classList.add('hidden');
                            nameInput.value = '';
                            calculateCompletion();
                            scheduleAutosave();
                        } else {
                            alert(data.error || 'Could not add client.');
                        }
                    })
                    .catch(function () {
                        alert('Something went wrong. Please try again.');
                    });
            });
        }

        // ── Submit Form ───────────────────────────────────────────
        function showSubmitBlockedMessage() {
            showToast('Please complete all required fields before submitting.', 'error');
        }

        function openReviewModal() {
            var projectName = document.getElementById('project_name').value.trim();
            var jobNumber = document.getElementById('job_number').value.trim();
            var csLeadEl = document.getElementById('cs_lead_id');
            var csLeadText = csLeadEl.tagName === 'SELECT'
                ? csLeadEl.options[csLeadEl.selectedIndex].text
                : (document.querySelector('.form-static-value') || { textContent: '' }).textContent.trim();
            var briefType = document.getElementById('brief_type').value;

            document.getElementById('reviewProjectName').textContent = projectName;
            document.getElementById('reviewJobNumber').textContent = jobNumber;
            document.getElementById('reviewCSLead').textContent = csLeadText;
            document.getElementById('reviewBriefType').textContent = briefType === 'ccm' ? 'C&CM' : 'Standard';

            var list = document.getElementById('reviewDeliverablesList');
            list.innerHTML = '';

            if (briefType === 'standard') {
                var dtEl = document.getElementById('design_type_id');
                var dtText = dtEl && dtEl.options[dtEl.selectedIndex] ? dtEl.options[dtEl.selectedIndex].text : '—';
                var note = document.createElement('div');
                note.className = 'review-customer-item';
                note.innerHTML = '<div class="review-meta-grid" style="margin:0"><div class="review-meta-item"><span class="review-meta-label">Type of Design</span><span class="review-meta-value">' + dtText + '</span></div></div><p style="margin-top:0.75rem;font-size:0.85rem;color:var(--text-muted)">Deliverables are added after the project is created.</p>';
                list.appendChild(note);
            }

            var regionSections = document.querySelectorAll('.deliverables-region-section');

            regionSections.forEach(function (regionSection) {
                var region = regionSection.dataset.region;

                var regionHeading = document.createElement('div');
                regionHeading.className = 'review-region-heading';
                regionHeading.textContent = region === 'uae' ? 'UAE' :
                    region.charAt(0).toUpperCase() + region.slice(1);
                list.appendChild(regionHeading);

                var customerBlocks = regionSection.querySelectorAll('.deliverables-customer-block');

                customerBlocks.forEach(function (block) {
                    var customerName = block.querySelector('.deliverables-customer-heading').textContent;

                    var customerItem = document.createElement('div');
                    customerItem.className = 'review-customer-item';

                    var customerNameEl = document.createElement('div');
                    customerNameEl.className = 'review-customer-name';
                    customerNameEl.textContent = customerName;
                    customerItem.appendChild(customerNameEl);

                    var deliverableRows = block.querySelectorAll('.deliverable-row');

                    deliverableRows.forEach(function (row) {
                        var name = row.dataset.name;
                        var disciplines = row.querySelectorAll('.discipline-tag');

                        var deliverableRow = document.createElement('div');
                        deliverableRow.className = 'review-deliverable-row';

                        var nameSpan = document.createElement('span');
                        nameSpan.textContent = name;
                        deliverableRow.appendChild(nameSpan);

                        disciplines.forEach(function (tag) {
                            var tagClone = tag.cloneNode(true);
                            deliverableRow.appendChild(tagClone);
                        });

                        customerItem.appendChild(deliverableRow);
                    });

                    list.appendChild(customerItem);
                });
            });

            document.getElementById('reviewModalOverlay').classList.remove('hidden');
        }
        
        // ── Start Project modal ───────────────────────────────────────────────────────
        // The start-project-modal already exists in detail.html.
        // These functions open/close it and POST to the start-project route on confirm.

        var _startProjectId = null; // stores the project ID between open and confirm

        function openStartProjectModal(projectId) {
            _startProjectId = projectId;
            document.getElementById('start-project-modal').classList.remove('hidden');
        }

        function closeStartProjectModal() {
            document.getElementById('start-project-modal').classList.add('hidden');
            _startProjectId = null;
        }

        var startConfirmBtn = document.getElementById('start-project-confirm');
        if (startConfirmBtn) {
            startConfirmBtn.addEventListener('click', function () {
                if (!_startProjectId) return;
                // POST to the existing start-project route
                fetch('/projects/' + _startProjectId + '/start-project', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        if (data.success) {
                            // Reload so the status badge and button update correctly
                            window.location.reload();
                        } else {
                            alert(data.error || 'Could not start project.');
                            closeStartProjectModal();
                        }
                    });
            });
        }

        // ── Edit Mode: Restore State ─────────────────────────────
        function restoreEditState() {
            var briefTypeEl = document.getElementById('brief_type');
            if (briefTypeEl && briefTypeEl.value) {
                switchBriefType(briefTypeEl.value);
            }

            var hasConceptEl = document.getElementById('has_concept');
            if (hasConceptEl && hasConceptEl.value === 'true') {
                document.getElementById('sectionConceptKV').classList.remove('hidden');
                var conceptKVBtn = document.getElementById('btnConceptKVToggle');
                if (conceptKVBtn) conceptKVBtn.classList.add('active');
            }

            if (!EXISTING_CUSTOMERS || EXISTING_CUSTOMERS.length === 0) {
                calculateCompletion();
                return;
            }

            var hasUAE = EXISTING_CUSTOMERS.some(function (c) { return c.region === 'uae'; });
            var gulfCountries = ['kuwait', 'qatar', 'bahrain', 'oman'];
            var activeGulfCountries = gulfCountries.filter(function (country) {
                return EXISTING_CUSTOMERS.some(function (c) { return c.region === country; });
            });

            if (hasUAE) {
                var uaeBtn = document.getElementById('region_uae');
                if (uaeBtn) {
                    uaeBtn.classList.add('active');
                    document.getElementById('blockUAECustomers').classList.remove('hidden');
                    buildCustomerChecklist('uae', 'uaeCustomerList');
                }
            }

            if (activeGulfCountries.length > 0) {
                var gulfBtn = document.getElementById('region_gulf');
                if (gulfBtn) {
                    gulfBtn.classList.add('active');
                    document.getElementById('blockGulf').classList.remove('hidden');
                }
                activeGulfCountries.forEach(function (country) {
                    var btn = document.getElementById('gulf_' + country);
                    if (btn) {
                        btn.classList.add('active');
                        buildGulfCountryCustomers(country);
                    }
                });
            }

            EXISTING_CUSTOMERS.forEach(function (ec) {
                var pill = document.querySelector('.customer-pill[data-customer-id="' + ec.customer_id + '"]');
                if (pill && !pill.classList.contains('selected')) {
                    pill.classList.add('selected');
                    addDeliverableBlock(ec.customer_id, pill.dataset.customerName, ec.region);
                }
                var ddEl = document.getElementById('design_deadline_' + ec.customer_id);
                var ddtEl = document.getElementById('design_deadline_time_' + ec.customer_id);
                var instEl = document.getElementById('installation_date_' + ec.customer_id);
                if (ddEl && ec.design_deadline) ddEl.value = ec.design_deadline;
                if (ddtEl && ec.design_deadline_time) ddtEl.value = ec.design_deadline_time;
                if (instEl && ec.installation_date) instEl.value = ec.installation_date;
            });

            EXISTING_DELIVERABLES.forEach(function (ed) {
                addDeliverableRow(ed.customer_id, ed.type_id, ed.name, ed.disciplines);
            });

            calculateCompletion();
        }

        // ── Edit Mode: Submit ────────────────────────────────────
        function submitEditedProject() {
            var btn = document.getElementById('btnReviewSubmit');
            if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

            var formData = collectFormData();

            var regions = [];
            var uaeBtn2 = document.getElementById('region_uae');
            if (uaeBtn2 && uaeBtn2.classList.contains('active')) regions.push('uae');
            var gulfBtn2 = document.getElementById('region_gulf');
            if (gulfBtn2 && gulfBtn2.classList.contains('active')) {
                ['kuwait', 'qatar', 'bahrain', 'oman'].forEach(function (country) {
                    var b = document.getElementById('gulf_' + country);
                    if (b && b.classList.contains('active')) regions.push(country);
                });
            }

            var deliverables = [];
            document.querySelectorAll('.deliverables-customer-block').forEach(function (block) {
                var customerId = block.dataset.customerId;
                var regionSection = block.closest('.deliverables-region-section');
                var region = regionSection.dataset.region;
                block.querySelectorAll('.deliverable-row').forEach(function (row) {
                    deliverables.push({
                        customer_id: customerId,
                        region: region,
                        type_id: row.dataset.typeId,
                        name: row.dataset.name
                    });
                });
            });

            var payload = Object.assign({}, formData, { regions: regions, deliverables: deliverables });

            fetch('/projects/' + EDIT_PROJECT_ID + '/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.error) {
                        showToast(data.error, 'error');
                        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
                        return;
                    }
                    window.location.href = data.redirect_url + '?toast=Project+updated+successfully';
                })
                .catch(function () {
                    showToast('Something went wrong. Please try again.', 'error');
                    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
                });
        }

        // ── Event Listeners ──────────────────────────────────────

        document.querySelectorAll('.brief-type-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var clientId = document.getElementById('client_id').value;
                if (!clientId) {
                    showToast('Please select a client before choosing a brief type.', 'error');
                    return;
                }
                switchBriefType(this.dataset.type);
            });
        });

        var btnConceptKVToggle = document.getElementById('btnConceptKVToggle');
        if (btnConceptKVToggle) {
            btnConceptKVToggle.addEventListener('click', function () {
                var section = document.getElementById('sectionConceptKV');
                var hasConceptInput = document.getElementById('has_concept');
                var isOpen = !section.classList.contains('hidden');
                section.classList.toggle('hidden', isOpen);
                hasConceptInput.value = isOpen ? 'false' : 'true';
                btnConceptKVToggle.classList.toggle('active', !isOpen);
                scheduleAutosave();
            });
        }

        document.querySelectorAll('.region-btn[data-region]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                this.classList.toggle('active');
                handleRegionChange();
            });
        });

        ['kuwait', 'qatar', 'bahrain', 'oman'].forEach(function (country) {
            var el = document.getElementById('gulf_' + country);
            if (el) {
                el.addEventListener('click', function () {
                    this.classList.toggle('active');
                    if (this.classList.contains('active')) {
                        buildGulfCountryCustomers(country);
                    } else {
                        removeGulfCountryCustomers(country);
                    }
                    calculateCompletion();
                });
            }
        });

        document.querySelectorAll(
            '#sectionBasics input, #sectionBasics select'
        ).forEach(function (el) {
            el.addEventListener('change', function () {
                calculateCompletion();
                scheduleAutosave();
            });
            if (el.type === 'text') {
                el.addEventListener('keyup', function () {
                    calculateCompletion();
                    scheduleAutosave();
                });
            }
        });

        document.querySelectorAll(
            '#sectionCCM select, #sectionCCM textarea'
        ).forEach(function (el) {
            el.addEventListener('change', function () {
                calculateCompletion();
                scheduleAutosave();
            });
        });

        document.querySelectorAll(
            '#sectionStandard select, #sectionStandard textarea'
        ).forEach(function (el) {
            el.addEventListener('change', function () {
                calculateCompletion();
                scheduleAutosave();
            });
        });

        // btnConceptToggle and btnKVToggle replaced by merged btnConceptKVToggle above

        var btnReviewSubmit = document.getElementById('btnReviewSubmit');
        if (btnReviewSubmit) {
            btnReviewSubmit.addEventListener('click', function () {
                if (typeof EDIT_MODE !== 'undefined' && EDIT_MODE) {
                    submitEditedProject();
                } else if (currentCompletion < 100) {
                    showSubmitBlockedMessage();
                } else {
                    openReviewModal();
                }
            });
        }

        var reviewModalClose = document.getElementById('reviewModalClose');
        if (reviewModalClose) {
            reviewModalClose.addEventListener('click', function () {
                document.getElementById('reviewModalOverlay').classList.add('hidden');
            });
        }

        var reviewModalCancel = document.getElementById('reviewModalCancel');
        if (reviewModalCancel) {
            reviewModalCancel.addEventListener('click', function () {
                document.getElementById('reviewModalOverlay').classList.add('hidden');
            });
        }

        var btnSubmitBrief = document.getElementById('btnSubmitBrief');
        if (btnSubmitBrief) {
            btnSubmitBrief.addEventListener('click', function () {
                btnSubmitBrief.disabled = true;
                btnSubmitBrief.textContent = 'Submitting...';

                var formData = collectFormData();

                var regions = [];
                var uaeBtn = document.getElementById('region_uae');
                if (uaeBtn && uaeBtn.classList.contains('active')) {
                    regions.push('uae');
                }
                var gulfBtn = document.getElementById('region_gulf');
                if (gulfBtn && gulfBtn.classList.contains('active')) {
                    ['kuwait', 'qatar', 'bahrain', 'oman'].forEach(function (country) {
                        var btn = document.getElementById('gulf_' + country);
                        if (btn && btn.classList.contains('active')) {
                            regions.push(country);
                        }
                    });
                }

                var deliverables = [];
                document.querySelectorAll('.deliverables-customer-block').forEach(function (block) {
                    var customerId = block.dataset.customerId;
                    var regionSection = block.closest('.deliverables-region-section');
                    var region = regionSection.dataset.region;

                    block.querySelectorAll('.deliverable-row').forEach(function (row) {
                        deliverables.push({
                            customer_id: customerId,
                            region: region,
                            type_id: row.dataset.typeId,
                            name: row.dataset.name
                        });
                    });
                });

                var payload = Object.assign({}, formData, {
                    regions: regions,
                    deliverables: deliverables
                });

                fetch('/projects/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        if (data.error) {
                            showToast(data.error, 'error');
                            btnSubmitBrief.disabled = false;
                            btnSubmitBrief.textContent = 'Submit Brief';
                            return;
                        }
                        clearTimeout(autosaveTimeout);
                        // If the FOC number was already taken by another project, the server
                        // silently assigned the next available one and signals us here.
                        var toastMsg = data.job_number_changed
                            ? 'Project submitted. Job number updated to ' + data.new_job_number + ' — ' + data.old_job_number + ' was already taken.'
                            : 'Project submitted successfully';
                        window.location.href = data.redirect_url + '?toast=' + encodeURIComponent(toastMsg);
                    })
                    .catch(function () {
                        showToast('Something went wrong. Please try again.', 'error');
                        btnSubmitBrief.disabled = false;
                        btnSubmitBrief.textContent = 'Submit Brief';
                    });
            });
        }

        // ── Initialise ───────────────────────────────────────────
        var btnSelectAllUAE = document.getElementById('btnSelectAllUAE');
        if (btnSelectAllUAE) {
            btnSelectAllUAE.addEventListener('click', function () {
                selectAllCustomers('uaeCustomerList', this);
            });
        }

        setupAddClient();

        var urlParams = new URLSearchParams(window.location.search);
        var draftIdParam = urlParams.get('draft_id');
        if (draftIdParam) {
            currentDraftId = parseInt(draftIdParam);
            var briefTypeEl = document.getElementById('brief_type');
            if (briefTypeEl && briefTypeEl.value) {
                switchBriefType(briefTypeEl.value);
            }
            var hasConceptEl = document.getElementById('has_concept');
            if (hasConceptEl && hasConceptEl.value === 'true') {
                document.getElementById('sectionConceptKV').classList.remove('hidden');
                var conceptKVToggleBtn = document.getElementById('btnConceptKVToggle');
                if (conceptKVToggleBtn) conceptKVToggleBtn.classList.add('active');
            }
        } else if (typeof EDIT_MODE !== 'undefined' && EDIT_MODE) {
            restoreEditState();
        }

        calculateCompletion();

        // ── Reference File Upload on Create Page ─────────────────
        var createRefFileBtn = document.getElementById('createRefFileBtn');
        var createRefFileInput = document.getElementById('createRefFileInput');

        if (createRefFileBtn && createRefFileInput) {
            createRefFileBtn.addEventListener('click', function () {
                if (!this.disabled) createRefFileInput.click();
            });

            createRefFileInput.addEventListener('change', function () {
                var file = createRefFileInput.files[0];
                if (!file) return;

                var projectId = createRefFileBtn.dataset.projectId;
                if (!projectId) return;

                var status = document.getElementById('createRefFileStatus');
                status.textContent = 'Uploading...';

                var formData = new FormData();
                formData.append('file', file);

                fetch('/projects/' + projectId + '/upload-file', {
                    method: 'POST',
                    body: formData
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (!data.success) { status.textContent = 'Error: ' + data.error; return; }
                        status.textContent = 'Uploaded.';
                        setTimeout(function () { status.textContent = ''; }, 3000);
                        createRefFileInput.value = '';

                        var list = document.getElementById('create-reference-files-list');
                        var noFilesMsg = list.querySelector('.no-files-msg');
                        if (noFilesMsg) noFilesMsg.remove();

                        var icons = { jpg: '🖼', jpeg: '🖼', png: '🖼', pdf: '📄', docx: '📝', xlsx: '📊' };
                        var icon = icons[data.file.file_type] || '📎';

                        var item = document.createElement('div');
                        item.className = 'reference-file-item';
                        item.dataset.fileId = data.file.id;
                        item.innerHTML = `
                    <span class="reference-file-icon">${icon}</span>
                    <span class="reference-file-name">${data.file.original_filename}</span>
                    <span class="reference-file-meta">${data.file.uploaded_by}</span>
                    <div class="reference-file-actions">
                        <a href="/projects/files/${data.file.id}/download"
                           class="btn-secondary btn-sm">Download</a>
                        <button class="btn-danger btn-sm reference-file-delete-btn"
                                data-file-id="${data.file.id}">Remove</button>
                    </div>
                `;
                        item.querySelector('.reference-file-delete-btn').addEventListener('click', handleCreateFileDelete);
                        list.appendChild(item);
                    })
                    .catch(function (err) {
                        status.textContent = 'Upload failed.';
                        console.error(err);
                    });
            });

            function handleCreateFileDelete(e) {
                var fileId = this.dataset.fileId;
                var item = this.closest('.reference-file-item');
                if (!confirm('Remove this file?')) return;

                fetch('/projects/files/' + fileId + '/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (!data.success) return;
                        item.remove();
                        var list = document.getElementById('create-reference-files-list');
                        if (list.querySelectorAll('.reference-file-item').length === 0) {
                            var msg = document.createElement('p');
                            msg.className = 'no-files-msg';
                            msg.textContent = 'No reference files uploaded yet.';
                            list.appendChild(msg);
                        }
                    });
            }

            document.querySelectorAll('#create-reference-files-list .reference-file-delete-btn').forEach(function (btn) {
                btn.addEventListener('click', handleCreateFileDelete);
            });
        }

    } // end sectionBasics wrapper

    // ── Post-redirect Toast ──────────────────────────────────────
    var urlParams = new URLSearchParams(window.location.search);
    var toastMsg = urlParams.get('toast');
    if (toastMsg) {
        showToast(decodeURIComponent(toastMsg), 'success');
    }

    // ── Expandable customer rows ──────────────────────────────
    document.querySelectorAll('tr[data-expand]').forEach(function (row) {
        row.addEventListener('click', function (e) {
            if (e.target.closest('a, button, select')) return;
            var expandRow = this.nextElementSibling;
            if (!expandRow || !expandRow.classList.contains('expansion-row')) return;
            expandRow.classList.toggle('hidden');
            var icon = this.querySelector('.chevron-icon');
            if (icon) icon.classList.toggle('rotated');
            var expandRow = this.nextElementSibling;
        });
    });

    // ── Status dropdowns ─────────────────────────────────────
    function updateStatus(select) {
        var url = select.dataset.url;
        var status = select.value;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status })
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) {
                    showToast(data.error, 'error');
                } else {
                    applyStatusClass(select, status);
                    showToast('Status updated', 'success');
                }
            })
            .catch(function () {
                showToast('Something went wrong', 'error');
            });
    }



    function applyStatusClass(select, status) {
        // Full list of status classes — must include every value that appears in any dropdown
        var classes = [
            's-briefed', 's-in_queue', 's-in_progress', 's-submitted',
            's-internal_review', 's-internal_revision', 's-submitted_to_client',
            's-revision_in_queue', 's-revision_in_progress', 's-approved', 's-on_hold'
        ];
        select.classList.remove.apply(select.classList, classes);
        select.classList.add('s-' + status);
    }

    document.querySelectorAll('.status-select').forEach(function (select) {
        applyStatusClass(select, select.value);
    });

    function flagRevision(deliverableId, projectId) {
        var url = '/projects/' + projectId + '/deliverable/' + deliverableId + '/flag-revision';
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) {
                    showToast(data.error, 'error');
                } else {
                    showToast('Deliverable flagged for revision', 'warning');
                    // Swap the flag button for the Flagged badge and update the status dropdown
                    var btn = document.querySelector('[onclick="flagRevision(' + deliverableId + ', ' + projectId + ')"]');
                    if (btn) {
                        var badge = document.createElement('span');
                        badge.className = 'revision-flagged-badge';
                        badge.textContent = '⚑ Flagged';
                        btn.replaceWith(badge);
                    }
                    // Update the status dropdown to revision_in_queue
                    var row = document.querySelector('[data-url*="/deliverable/' + deliverableId + '/set-status"]');
                    if (row) {
                        row.value = 'revision_in_queue';
                        applyStatusClass(row, 'revision_in_queue');
                    }
                }
            })
            .catch(function () { showToast('Something went wrong', 'error'); });
    }

    // ── Client Submission ─────────────────────────────────────────────────────────

    // ── Client Submission Flow ────────────────────────────────────────────────────
    // Pull project ID from the URL — detail page is always at /projects/<id>
    var detailProjectId = parseInt(window.location.pathname.split('/')[2]);

    // ── Step 1: Upload deck ───────────────────────────────────────────────────────
    // The designer clicks "Upload Client Deck" or "Reupload Deck", picks a file,
    // and we POST it to the server. On success the page reloads into State 2
    // (deliverable picker) with the new submission pre-selected.
    var submissionUploadBtn = document.getElementById('submissionUploadBtn');
    var submissionFileInput = document.getElementById('submissionFileInput');
    var submissionUploadStatus = document.getElementById('submissionUploadStatus');

    if (submissionUploadBtn && submissionFileInput) {
        submissionUploadBtn.addEventListener('click', function () {
            submissionFileInput.click();
        });

        submissionFileInput.addEventListener('change', function () {
            var file = submissionFileInput.files[0];
            if (!file) return;

            submissionUploadStatus.textContent = 'Uploading...';

            var formData = new FormData();
            formData.append('file', file);

            fetch('/projects/' + detailProjectId + '/submission/upload', {
                method: 'POST',
                body: formData
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.success) {
                        submissionUploadStatus.textContent = 'Error: ' + data.error;
                        return;
                    }
                    // Reload so the template renders the correct state (State 2: picker)
                    window.location.reload();
                })
                .catch(function () {
                    submissionUploadStatus.textContent = 'Upload failed.';
                });
        });
    }

    // ── Shared deliverable picker builder ────────────────────────────────────────
    // Used by both the submission picker (State 2) and the revision picker (State 5).
    // Renders checkboxes into `containerEl`, defaulting all to checked.
    // For CCM briefs (deliverables have customer_name), groups by customer with
    // per-customer Select/Deselect All buttons rendered inside a bordered box.
    // `globalSelectEl` and `globalDeselectEl` wire up the global controls (optional).
    function buildPickerInto(containerEl, globalSelectEl, globalDeselectEl, filterCustomerIds) {
        if (!containerEl || !window.projectDeliverables) return;

        var deliverables = window.projectDeliverables;

        // If a customer ID filter is provided, restrict to only those customers' deliverables
        if (filterCustomerIds && filterCustomerIds.length > 0) {
            var _idSet = {};
            filterCustomerIds.forEach(function (id) { _idSet[id] = true; });
            deliverables = deliverables.filter(function (d) { return d.customer_id && _idSet[d.customer_id]; });
        }

        // One checkbox row: a <label class="picker-row"> containing a checkbox + name span.
        function makeRow(d) {
            var label = document.createElement('label');
            label.className = 'picker-row';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = d.id;
            cb.checked = true;
            cb.dataset.deliverableId = d.id;
            var span = document.createElement('span');
            span.textContent = d.name;
            label.appendChild(cb);
            label.appendChild(span);
            return label;
        }

        var isCCM = deliverables.some(function (d) { return d.customer_name; });

        if (isCCM) {
            // CCM brief: group deliverables by customer, render one bordered box per customer
            // with per-group Select All / Deselect All buttons above the checkbox rows.
            var groups = {}, order = [];
            deliverables.forEach(function (d) {
                var key = d.customer_id || '__none__';
                if (!groups[key]) {
                    groups[key] = { name: d.customer_name || 'Other', items: [] };
                    order.push(key);
                }
                groups[key].items.push(d);
            });
            order.forEach(function (key) {
                var g = groups[key];
                // Bordered box wrapping one customer's deliverables
                var wrap = document.createElement('div');
                wrap.style.cssText = 'border:1px solid var(--border);border-radius:6px;padding:0.65rem 0.75rem;margin-bottom:0.5rem;';
                // Customer name header
                var header = document.createElement('div');
                header.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:0.06em;color:var(--tangerine);text-transform:uppercase;margin-bottom:0.4rem;';
                header.textContent = g.name;
                wrap.appendChild(header);
                // Per-group Select All / Deselect All
                var actions = document.createElement('div');
                actions.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.4rem;';
                var selAll = document.createElement('button');
                selAll.type = 'button';
                selAll.className = 'btn-secondary btn-sm';
                selAll.textContent = 'Select All';
                var deselAll = document.createElement('button');
                deselAll.type = 'button';
                deselAll.className = 'btn-secondary btn-sm';
                deselAll.textContent = 'Deselect All';
                selAll.addEventListener('click', function () {
                    wrap.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = true; });
                });
                deselAll.addEventListener('click', function () {
                    wrap.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
                });
                actions.appendChild(selAll);
                actions.appendChild(deselAll);
                wrap.appendChild(actions);
                // Deliverable rows
                g.items.forEach(function (d) { wrap.appendChild(makeRow(d)); });
                containerEl.appendChild(wrap);
            });
        } else {
            // Standard brief: flat list with optional global Select / Deselect All controls
            deliverables.forEach(function (d) { containerEl.appendChild(makeRow(d)); });
            if (globalSelectEl) {
                globalSelectEl.addEventListener('click', function () {
                    containerEl.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = true; });
                });
            }
            if (globalDeselectEl) {
                globalDeselectEl.addEventListener('click', function () {
                    containerEl.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
                });
            }
        }
    }

    // ── Step 2: Deliverable picker (submission) ───────────────────────────────────
    // Shown in State 2 (deck uploaded, not yet in review).
    // For CCM briefs this is the concept/KV phase — only Concept and Initial KV
    // campaign assets are selectable. Regular deliverables are handled per-customer
    // during the POSM phase via the channel pickers (ch-picker-list-*).
    // For Standard briefs this renders the flat deliverable list via buildPickerInto.
    (function () {
        var pickerList = document.getElementById('pickerList');
        if (!pickerList) return;

        var selAll = document.getElementById('pickerSelectAll');
        var deselAll = document.getElementById('pickerDeselectAll');

        if (window.projectHasConcept || window.projectHasKV) {
            // CCM concept/KV phase: only show campaign asset checkboxes
            function makeCampaignRow(value, label) {
                var lbl = document.createElement('label');
                lbl.className = 'picker-row picker-row--campaign';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = value;
                cb.checked = true;
                var span = document.createElement('span');
                span.textContent = label;
                lbl.appendChild(cb);
                lbl.appendChild(span);
                return lbl;
            }
            if (window.projectHasConcept && window.projectHasKV) {
                pickerList.appendChild(makeCampaignRow('__concept__', 'Concept & KV'));
            } else {
                if (window.projectHasConcept) pickerList.appendChild(makeCampaignRow('__concept__', 'Concept'));
                if (window.projectHasKV) pickerList.appendChild(makeCampaignRow('__kv__', 'Initial KV'));
            }

            // Wire global Select / Deselect All to the campaign rows
            if (selAll) selAll.addEventListener('click', function () { pickerList.querySelectorAll('input').forEach(function (cb) { cb.checked = true; }); });
            if (deselAll) deselAll.addEventListener('click', function () { pickerList.querySelectorAll('input').forEach(function (cb) { cb.checked = false; }); });
        } else {
            // Standard brief: flat deliverable list (no customer grouping)
            buildPickerInto(pickerList, selAll, deselAll);
        }
    })();

    // ── Step 2 → 3: Submit for Internal Review ───────────────────────────────────
    // Designer confirms the deliverable selection and sends the deck to CS.
    // We collect the checked deliverable IDs and POST them along with the
    // submission ID to /submission/submit-for-review.
    var submissionSubmitForReviewBtn = document.getElementById('submissionSubmitForReviewBtn');
    if (submissionSubmitForReviewBtn) {
        submissionSubmitForReviewBtn.addEventListener('click', function () {
            var submissionId = parseInt(this.dataset.submissionId);
            var pickerList = document.getElementById('pickerList');

            // Collect checked deliverable IDs and concept/KV flags
            var checked = [];
            var includesConcept = false;
            var includesKV = false;
            if (pickerList) {
                pickerList.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
                    if (cb.value === '__concept__') includesConcept = true;
                    else if (cb.value === '__kv__') includesKV = true;
                    else checked.push(parseInt(cb.value));
                });
            }
            // When merged Concept & KV row is checked (value=__concept__) and project has KV, include KV too
            if (includesConcept && window.projectHasKV) includesKV = true;

            if (checked.length === 0 && !includesConcept && !includesKV) {
                showToast('Select at least one item to include.', 'error');
                return;
            }

            submissionSubmitForReviewBtn.disabled = true;
            submissionSubmitForReviewBtn.textContent = 'Submitting...';

            // Collect Gulf POSM region + customer (or flat customer for non-Gulf)
            var posmCountry = null;
            var posmCustomerId = null;
            if (window.posmActive) {
                var posmRegionSel = document.getElementById('posmRegionSelect');
                var posmCustomerSel = document.getElementById('posmCustomerSelect');
                posmCountry = posmRegionSel ? (posmRegionSel.value || null) : null;
                posmCustomerId = posmCustomerSel ? (parseInt(posmCustomerSel.value) || null) : null;
                if (!posmCountry && !posmCustomerId) {
                    showToast('Select a region before submitting POSM.', 'error');
                    return;
                }
            }

            fetch('/projects/' + detailProjectId + '/submission/submit-for-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submission_id: submissionId,
                    deliverable_ids: checked,
                    includes_concept: includesConcept,
                    includes_kv: includesKV,
                    posm_country: posmCountry,
                    posm_customer_id: posmCustomerId
                })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.success) {
                        showToast(data.error || 'Could not submit for review.', 'error');
                        submissionSubmitForReviewBtn.disabled = false;
                        submissionSubmitForReviewBtn.textContent = 'Submit for Internal Review';
                        return;
                    }
                    showToast('Submitted for internal review. CS has been notified.', 'success');
                    // Reload so the template renders State 3 (internal review) with CS buttons
                    window.location.reload();
                })
                .catch(function () {
                    showToast('Something went wrong.', 'error');
                    submissionSubmitForReviewBtn.disabled = false;
                    submissionSubmitForReviewBtn.textContent = 'Submit for Internal Review';
                });
        });
    }

    // ── Step 3a: CS flags the deck ───────────────────────────────────────────────
    // CS clicks "Flag Issue" → flag form slides in → they write a reason →
    // "Send Flag" POSTs to /submission/flag → page reloads into State 4.
    var submissionFlagBtn = document.getElementById('submissionFlagBtn');
    var submissionFlagForm = document.getElementById('submissionFlagForm');
    var submissionFlagCancel = document.getElementById('submissionFlagCancel');

    if (submissionFlagBtn) {
        submissionFlagBtn.addEventListener('click', function () {
            submissionFlagForm.classList.remove('hidden');
            submissionFlagBtn.classList.add('hidden');
        });
    }

    if (submissionFlagCancel) {
        submissionFlagCancel.addEventListener('click', function () {
            submissionFlagForm.classList.add('hidden');
            submissionFlagBtn.classList.remove('hidden');
            document.getElementById('submissionFlagMessage').value = '';
        });
    }

    var submissionFlagConfirm = document.getElementById('submissionFlagConfirm');
    if (submissionFlagConfirm) {
        submissionFlagConfirm.addEventListener('click', function () {
            var message = document.getElementById('submissionFlagMessage').value.trim();
            if (!message) {
                showToast('Please describe the issue before flagging.', 'error');
                return;
            }

            submissionFlagConfirm.disabled = true;
            submissionFlagConfirm.textContent = 'Sending...';

            fetch('/projects/' + detailProjectId + '/submission/flag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.success) {
                        showToast(data.error, 'error');
                        submissionFlagConfirm.disabled = false;
                        submissionFlagConfirm.textContent = 'Send Flag';
                        return;
                    }
                    // Reload so the flagged banner shows and designer sees "Reupload Deck"
                    window.location.reload();
                })
                .catch(function () {
                    showToast('Something went wrong.', 'error');
                    submissionFlagConfirm.disabled = false;
                    submissionFlagConfirm.textContent = 'Send Flag';
                });
        });
    }

    // ── Step 3b: CS submits to client ────────────────────────────────────────────
    // CS clicks "Submit to Client" → all deliverables → submitted_to_client,
    // then optionally opens a mailto to draft the email.
    var submissionSubmitBtn = document.getElementById('submissionSubmitBtn');
    if (submissionSubmitBtn) {
        submissionSubmitBtn.addEventListener('click', function () {
            var projectName = this.dataset.projectName;

            submissionSubmitBtn.disabled = true;
            submissionSubmitBtn.textContent = 'Submitting...';

            fetch('/projects/' + detailProjectId + '/submission/submit-to-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.success) {
                        showToast(data.error, 'error');
                        submissionSubmitBtn.disabled = false;
                        submissionSubmitBtn.textContent = 'Submit to Client';
                        return;
                    }

                    showToast('Project submitted to client.', 'success');

                    // Offer to open Outlook with a pre-filled subject line via custom modal.
                    var emailModal = document.getElementById('email-draft-modal');
                    var emailYes = document.getElementById('emailDraftYes');
                    var emailNo = document.getElementById('emailDraftNo');
                    if (emailModal && emailYes && emailNo) {
                        emailModal.classList.remove('hidden');
                        var subject = encodeURIComponent(data.project_name);
                        var body = encodeURIComponent('Please find attached the latest client deck for ' + data.project_name + '.\n\nBest regards,');
                        var mailto = 'mailto:' + (data.client_email || '') + '?subject=' + subject + '&body=' + body;
                        emailYes.onclick = function () {
                            emailModal.classList.add('hidden');
                            window.open(mailto);
                            window.location.reload();
                        };
                        emailNo.onclick = function () {
                            emailModal.classList.add('hidden');
                            window.location.reload();
                        };
                    } else {
                        window.location.reload();
                    }
                })
                .catch(function () {
                    showToast('Something went wrong.', 'error');
                    submissionSubmitBtn.disabled = false;
                    submissionSubmitBtn.textContent = 'Submit to Client';
                });
        });
    }

    // ── Step 5: CS sends revision request ────────────────────────────────────────
    // Shown in State 5 (submitted_to_client). CS clicks "Send for Revision" →
    // revision form slides in with a free-text field and a deliverable picker.
    // On confirm: POSTs to /send-revision → project → revision_in_queue.
    (function () {
        var sendRevisionBtn = document.getElementById('sendRevisionBtn');
        var sendRevisionForm = document.getElementById('sendRevisionForm');
        var sendRevisionCancel = document.getElementById('sendRevisionCancel');
        var sendRevisionConfirm = document.getElementById('sendRevisionConfirm');
        var revisionPickerList = document.getElementById('revisionPickerList');

        if (!sendRevisionBtn) return; // not in submitted_to_client state

        var pickerBuilt = false; // lazy-build the picker only once

        sendRevisionBtn.addEventListener('click', function () {
            sendRevisionForm.classList.remove('hidden');
            sendRevisionBtn.classList.add('hidden');

            // Build the revision picker the first time the form is opened.
            // C&CM concept/KV phase: only Concept and/or KV can be revised (deliverables
            // are not yet in play — POSM hasn't started). Standard briefs and POSM phase
            // show the full deliverable picker via buildPickerInto.
            if (!pickerBuilt && revisionPickerList) {
                if (!window.posmActive && (window.projectHasConcept || window.projectHasKV)) {
                    function makeRevCampaignRow(value, label) {
                        var lbl = document.createElement('label');
                        lbl.className = 'picker-row picker-row--campaign';
                        var cb = document.createElement('input');
                        cb.type = 'checkbox';
                        cb.value = value;
                        cb.checked = true;
                        var span = document.createElement('span');
                        span.textContent = label;
                        lbl.appendChild(cb);
                        lbl.appendChild(span);
                        return lbl;
                    }
                    if (window.projectHasConcept && window.projectHasKV) {
                        revisionPickerList.appendChild(makeRevCampaignRow('__concept__', 'Concept & KV'));
                    } else {
                        if (window.projectHasConcept) revisionPickerList.appendChild(makeRevCampaignRow('__concept__', 'Concept'));
                        if (window.projectHasKV) revisionPickerList.appendChild(makeRevCampaignRow('__kv__', 'Initial KV'));
                    }
                    var revSelAll = document.getElementById('revisionPickerSelectAll');
                    var revDeselAll = document.getElementById('revisionPickerDeselectAll');
                    if (revSelAll) revSelAll.addEventListener('click', function () { revisionPickerList.querySelectorAll('input').forEach(function (cb) { cb.checked = true; }); });
                    if (revDeselAll) revDeselAll.addEventListener('click', function () { revisionPickerList.querySelectorAll('input').forEach(function (cb) { cb.checked = false; }); });
                } else if (window.projectDeliverables) {
                    buildPickerInto(revisionPickerList,
                        document.getElementById('revisionPickerSelectAll'),
                        document.getElementById('revisionPickerDeselectAll'));
                }
                pickerBuilt = true;
            }
        });

        if (sendRevisionCancel) {
            sendRevisionCancel.addEventListener('click', function () {
                sendRevisionForm.classList.add('hidden');
                sendRevisionBtn.classList.remove('hidden');
                document.getElementById('revisionMessage').value = '';
            });
        }

        if (sendRevisionConfirm) {
            sendRevisionConfirm.addEventListener('click', function () {
                var message = document.getElementById('revisionMessage').value.trim();
                if (!message) {
                    showToast('Please describe what needs to be revised.', 'error');
                    return;
                }

                // Collect checked deliverable IDs and concept/KV flags from the revision picker
                var checked = [];
                var includesConcept = false;
                var includesKV = false;
                if (revisionPickerList) {
                    revisionPickerList.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
                        if (cb.value === '__concept__') includesConcept = true;
                        else if (cb.value === '__kv__') includesKV = true;
                        else checked.push(parseInt(cb.value));
                    });
                }
                // When merged Concept & KV row is checked and project has KV, include KV too
                if (includesConcept && window.projectHasKV) includesKV = true;
                if (checked.length === 0 && !includesConcept && !includesKV) {
                    showToast('Select at least one item to revise.', 'error');
                    return;
                }

                sendRevisionConfirm.disabled = true;
                sendRevisionConfirm.textContent = 'Sending...';

                // Collect Gulf POSM region + customer for revision
                var revPosmCountry = null;
                var revPosmCustomerId = null;
                if (window.posmActive) {
                    var revRegionSel = document.getElementById('revPosmRegionSelect');
                    var revCustomerSel = document.getElementById('revPosmCustomerSelect');
                    revPosmCountry = revRegionSel ? (revRegionSel.value || null) : null;
                    revPosmCustomerId = revCustomerSel ? (parseInt(revCustomerSel.value) || null) : null;
                }

                fetch('/projects/' + detailProjectId + '/submission/send-revision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        deliverable_ids: checked,
                        includes_concept: includesConcept,
                        includes_kv: includesKV,
                        posm_country: revPosmCountry,
                        posm_customer_id: revPosmCustomerId
                    })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (!data.success) {
                            showToast(data.error || 'Could not send revision.', 'error');
                            sendRevisionConfirm.disabled = false;
                            sendRevisionConfirm.textContent = 'Send Revision';
                            return;
                        }
                        showToast('Revision sent. Designer has been notified.', 'success');
                        window.location.reload();
                    })
                    .catch(function () {
                        showToast('Something went wrong.', 'error');
                        sendRevisionConfirm.disabled = false;
                        sendRevisionConfirm.textContent = 'Send Revision';
                    });
            });
        }
    })();

    // ── Step 6: Designer starts the revision ─────────────────────────────────────
    // Shown in State 6 (revision_in_queue). Designer clicks "Start Revision" →
    // POSTs to /start-revision → project + deliverables → revision_in_progress,
    // CS gets notified.
    var startRevisionBtn = document.getElementById('startRevisionBtn');
    if (startRevisionBtn) {
        startRevisionBtn.addEventListener('click', function () {
            startRevisionBtn.disabled = true;
            startRevisionBtn.textContent = 'Starting...';

            fetch('/projects/' + detailProjectId + '/submission/start-revision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.success) {
                        showToast(data.error || 'Could not start revision.', 'error');
                        startRevisionBtn.disabled = false;
                        startRevisionBtn.textContent = 'Start Revision';
                        return;
                    }
                    showToast('Revision started. CS has been notified.', 'success');
                    window.location.reload();
                })
                .catch(function () {
                    showToast('Something went wrong.', 'error');
                    startRevisionBtn.disabled = false;
                    startRevisionBtn.textContent = 'Start Revision';
                });
        });
    }

    // ── Start Project ─────────────────────────────────────────────────
    // Handles the one-time transition from 'briefed' to 'in_progress'.
    // Stores the project ID when the modal opens, clears it on close.

    var _startProjectId = null;

    function openStartProjectModal(projectId) {
        _startProjectId = projectId;
        document.getElementById('start-project-modal').classList.remove('hidden');
    }

    function closeStartProjectModal() {
        document.getElementById('start-project-modal').classList.add('hidden');
        _startProjectId = null;
    }

    var startProjectConfirmBtn = document.getElementById('start-project-confirm');
    if (startProjectConfirmBtn) {
        startProjectConfirmBtn.addEventListener('click', function () {
            if (!_startProjectId) return;
            fetch('/projects/' + _startProjectId + '/start-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) {
                        window.location.reload();
                    } else {
                        alert(data.error || 'Could not start project.');
                        closeStartProjectModal();
                    }
                });
        });
    }

    // ── Lead Designer Self-Assignment ────────────────────────────────────────────

    function assignLeadSelf(team, projectId) {
        fetch('/projects/' + projectId + '/assign-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team: team })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    window.location.reload();
                } else {
                    alert(data.error || 'Could not assign lead.');
                }
            });
    }

    function showTransferForm(teamLower) {
        document.getElementById('transfer-trigger-' + teamLower).classList.add('hidden');
        document.getElementById('transfer-form-' + teamLower).classList.remove('hidden');
    }

    function cancelTransfer(teamLower) {
        document.getElementById('transfer-form-' + teamLower).classList.add('hidden');
        document.getElementById('transfer-trigger-' + teamLower).classList.remove('hidden');
    }

    function confirmTransfer(teamLower, projectId) {
        var select = document.getElementById('transfer-select-' + teamLower);
        var newDesignerId = select ? select.value : '';
        if (!newDesignerId) {
            alert('Please select a designer to transfer to.');
            return;
        }
        fetch('/projects/' + projectId + '/assign-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team: teamLower, new_designer_id: parseInt(newDesignerId) })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    window.location.reload();
                } else {
                    alert(data.error || 'Could not transfer ownership.');
                }
            });
    }

    var _takeoverTeam = null;
    var _takeoverProjectId = null;

    function openTakeoverModal(team, previousLeadName, projectId) {
        _takeoverTeam = team;
        _takeoverProjectId = projectId;
        document.getElementById('lead-takeover-body').textContent =
            'You\'ll replace ' + previousLeadName + ' as the ' + team +
            ' lead on this project. They\'ll be notified.';
        document.getElementById('lead-takeover-modal').classList.remove('hidden');
    }

    function closeTakeoverModal() {
        document.getElementById('lead-takeover-modal').classList.add('hidden');
        _takeoverTeam = null;
        _takeoverProjectId = null;
    }

    var takeoverConfirmBtn = document.getElementById('lead-takeover-confirm');
    if (takeoverConfirmBtn) {
        takeoverConfirmBtn.addEventListener('click', function () {
            if (!_takeoverTeam || !_takeoverProjectId) return;
            fetch('/projects/' + _takeoverProjectId + '/assign-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team: _takeoverTeam })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) {
                        window.location.reload();
                    } else {
                        alert(data.error || 'Could not take over as lead.');
                        closeTakeoverModal();
                    }
                });
        });
    }


    // ── POSM Parallel Channel Submission ─────────────────────────────────────────
    // Handles the pill-tab UI for Gulf C&CM POSM projects.
    // Each channel (UAE-Customer or Country) is its own independent submission pipeline.
    // All interactions use class-based selectors + data-channel-id; no global IDs.

    // Reload the page and restore focus to the given channel pill after load
    function reloadToChannel(channelId) {
        sessionStorage.setItem('posmActiveChannel', channelId);
        window.location.reload();
    }

    // Switch the visible channel section and update pill active state
    function selectPosmChannel(channelId) {
        // Deactivate all pills
        document.querySelectorAll('.posm-channel-pill').forEach(function (btn) {
            btn.classList.remove('posm-channel-pill--active');
        });
        // Activate the clicked pill
        var activePill = document.querySelector('.posm-channel-pill[data-channel-id="' + channelId + '"]');
        if (activePill) activePill.classList.add('posm-channel-pill--active');

        // Hide all channel sections, show the selected one
        document.querySelectorAll('.posm-channel-section').forEach(function (sec) {
            sec.classList.add('hidden');
        });
        var activeSection = document.getElementById('posm-ch-' + channelId);
        if (activeSection) {
            activeSection.classList.remove('hidden');
            // Lazy-build the deliverable picker if state 2 is visible
            var pickerList = document.getElementById('ch-picker-list-' + channelId);
            if (pickerList && pickerList.children.length === 0) {
                var _cIds = (pickerList.dataset.customerIds || '').split(',').filter(Boolean).map(Number);
                buildPickerInto(pickerList, null, null, _cIds);
            }
        }
    }

    // Restore the last-active channel on page load (saved by reloadToChannel before reload)
    (function () {
        var savedId = sessionStorage.getItem('posmActiveChannel');
        if (savedId && document.getElementById('posm-ch-' + savedId)) {
            sessionStorage.removeItem('posmActiveChannel');
            selectPosmChannel(savedId);
        } else {
            // Default: build picker for the first (already-visible) channel
            var firstSection = document.querySelector('.posm-channel-section:not(.hidden)');
            if (!firstSection) return;
            var channelId = firstSection.dataset.channelId;
            var pickerList = document.getElementById('ch-picker-list-' + channelId);
            if (pickerList) {
                var _cIds = (pickerList.dataset.customerIds || '').split(',').filter(Boolean).map(Number);
                buildPickerInto(pickerList, null, null, _cIds);
            }
        }
    })();

    // ── Channel event delegation ──────────────────────────────────────────────────
    // All channel buttons use class names (.ch-upload-btn, .ch-flag-btn, etc.)
    // We delegate from the pills container downward.
    document.addEventListener('click', function (e) {
        // ── Upload button ──────────────────────────────────────────────────────────
        var uploadBtn = e.target.closest('.ch-upload-btn');
        if (uploadBtn) {
            var chId = uploadBtn.dataset.channelId;
            var fileInput = document.getElementById('ch-file-' + chId);
            if (fileInput) fileInput.click();
            return;
        }

        // ── Flag button: show form ─────────────────────────────────────────────────
        var flagBtn = e.target.closest('.ch-flag-btn');
        if (flagBtn) {
            var chId = flagBtn.dataset.channelId;
            var form = document.getElementById('ch-flag-form-' + chId);
            if (form) {
                form.classList.remove('hidden');
                flagBtn.classList.add('hidden');
            }
            return;
        }

        // ── Flag cancel ────────────────────────────────────────────────────────────
        var flagCancel = e.target.closest('.ch-flag-cancel');
        if (flagCancel) {
            var chId = flagCancel.dataset.channelId;
            var form = document.getElementById('ch-flag-form-' + chId);
            if (form) form.classList.add('hidden');
            var msg = document.getElementById('ch-flag-msg-' + chId);
            if (msg) msg.value = '';
            // Re-show the flag button
            var btn = document.querySelector('.ch-flag-btn[data-channel-id="' + chId + '"]');
            if (btn) btn.classList.remove('hidden');
            return;
        }

        // ── Flag confirm ───────────────────────────────────────────────────────────
        var flagConfirm = e.target.closest('.ch-flag-confirm');
        if (flagConfirm) {
            var chId = flagConfirm.dataset.channelId;
            var projectId = flagConfirm.dataset.projectId;
            var msg = (document.getElementById('ch-flag-msg-' + chId) || {}).value || '';
            if (!msg.trim()) { showToast('Please describe the issue before flagging.', 'error'); return; }
            flagConfirm.disabled = true;
            flagConfirm.textContent = 'Sending...';
            fetch('/projects/' + projectId + '/submission/flag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg.trim(), posm_channel_id: parseInt(chId) })
            }).then(function (r) { return r.json(); }).then(function (data) {
                if (!data.success) {
                    showToast(data.error || 'Could not flag submission.', 'error');
                    flagConfirm.disabled = false;
                    flagConfirm.textContent = 'Send Flag';
                    return;
                }
                reloadToChannel(chId);
            }).catch(function () {
                showToast('Something went wrong.', 'error');
                flagConfirm.disabled = false;
                flagConfirm.textContent = 'Send Flag';
            });
            return;
        }

        // ── Submit to Client ───────────────────────────────────────────────────────
        var submitClientBtn = e.target.closest('.ch-submit-client-btn');
        if (submitClientBtn) {
            var chId = submitClientBtn.dataset.channelId;
            var projectId = submitClientBtn.dataset.projectId;
            submitClientBtn.disabled = true;
            submitClientBtn.textContent = 'Submitting...';
            fetch('/projects/' + projectId + '/submission/submit-to-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ posm_channel_id: parseInt(chId) })
            }).then(function (r) { return r.json(); }).then(function (data) {
                if (!data.success) {
                    showToast(data.error || 'Could not submit to client.', 'error');
                    submitClientBtn.disabled = false;
                    submitClientBtn.textContent = 'Submit to Client';
                    return;
                }
                showToast('Submitted to client.', 'success');
                reloadToChannel(chId);
            }).catch(function () {
                showToast('Something went wrong.', 'error');
                submitClientBtn.disabled = false;
                submitClientBtn.textContent = 'Submit to Client';
            });
            return;
        }

        // ── Submit for Internal Review ─────────────────────────────────────────────
        var submitReviewBtn = e.target.closest('.ch-submit-review-btn');
        if (submitReviewBtn) {
            var chId = submitReviewBtn.dataset.channelId;
            var projectId = submitReviewBtn.dataset.projectId;
            var submissionId = parseInt(submitReviewBtn.dataset.submissionId);
            // Collect checked deliverables from this channel's picker
            var pickerList = document.getElementById('ch-picker-list-' + chId);
            var deliverableIds = [];
            if (pickerList) {
                pickerList.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
                    var val = cb.value;
                    if (val !== '__concept__' && val !== '__kv__') deliverableIds.push(parseInt(val));
                });
            }
            if (!deliverableIds.length) {
                showToast('Select at least one deliverable to include.', 'error');
                return;
            }
            submitReviewBtn.disabled = true;
            submitReviewBtn.textContent = 'Submitting...';
            fetch('/projects/' + projectId + '/submission/submit-for-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submission_id: submissionId,
                    deliverable_ids: deliverableIds,
                    posm_channel_id: parseInt(chId)
                })
            }).then(function (r) { return r.json(); }).then(function (data) {
                if (!data.success) {
                    showToast(data.error || 'Could not submit for review.', 'error');
                    submitReviewBtn.disabled = false;
                    submitReviewBtn.textContent = 'Submit for Internal Review';
                    return;
                }
                reloadToChannel(chId);
            }).catch(function () {
                showToast('Something went wrong.', 'error');
                submitReviewBtn.disabled = false;
                submitReviewBtn.textContent = 'Submit for Internal Review';
            });
            return;
        }

        // ── Send Revision button: show form ───────────────────────────────────────
        var sendRevBtn = e.target.closest('.ch-send-revision-btn');
        if (sendRevBtn) {
            var chId = sendRevBtn.dataset.channelId;
            var form = document.getElementById('ch-rev-form-' + chId);
            if (form) {
                form.classList.remove('hidden');
                sendRevBtn.classList.add('hidden');
            }
            return;
        }

        // ── Send Revision cancel ───────────────────────────────────────────────────
        var sendRevCancel = e.target.closest('.ch-send-revision-cancel');
        if (sendRevCancel) {
            var chId = sendRevCancel.dataset.channelId;
            var form = document.getElementById('ch-rev-form-' + chId);
            if (form) form.classList.add('hidden');
            var msg = document.getElementById('ch-rev-msg-' + chId);
            if (msg) msg.value = '';
            var btn = document.querySelector('.ch-send-revision-btn[data-channel-id="' + chId + '"]');
            if (btn) btn.classList.remove('hidden');
            return;
        }

        // ── Send Revision confirm ──────────────────────────────────────────────────
        var sendRevConfirm = e.target.closest('.ch-send-revision-confirm');
        if (sendRevConfirm) {
            var chId = sendRevConfirm.dataset.channelId;
            var projectId = sendRevConfirm.dataset.projectId;
            var msgEl = document.getElementById('ch-rev-msg-' + chId);
            var message = msgEl ? msgEl.value.trim() : '';
            if (!message) { showToast('Please describe what needs to be revised.', 'error'); return; }
            sendRevConfirm.disabled = true;
            sendRevConfirm.textContent = 'Sending...';
            fetch('/projects/' + projectId + '/submission/send-revision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, posm_channel_id: parseInt(chId) })
            }).then(function (r) { return r.json(); }).then(function (data) {
                if (!data.success) {
                    showToast(data.error || 'Could not send revision.', 'error');
                    sendRevConfirm.disabled = false;
                    sendRevConfirm.textContent = 'Send Revision';
                    return;
                }
                showToast('Revision sent. Designer has been notified.', 'success');
                reloadToChannel(chId);
            }).catch(function () {
                showToast('Something went wrong.', 'error');
                sendRevConfirm.disabled = false;
                sendRevConfirm.textContent = 'Send Revision';
            });
            return;
        }

        // ── Start Revision ─────────────────────────────────────────────────────────
        var startRevBtn = e.target.closest('.ch-start-revision-btn');
        if (startRevBtn) {
            var chId = startRevBtn.dataset.channelId;
            var projectId = startRevBtn.dataset.projectId;
            startRevBtn.disabled = true;
            startRevBtn.textContent = 'Starting...';
            fetch('/projects/' + projectId + '/submission/start-revision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ posm_channel_id: parseInt(chId) })
            }).then(function (r) { return r.json(); }).then(function (data) {
                if (!data.success) {
                    showToast(data.error || 'Could not start revision.', 'error');
                    startRevBtn.disabled = false;
                    startRevBtn.textContent = 'Start Revision';
                    return;
                }
                showToast('Revision started. CS has been notified.', 'success');
                reloadToChannel(chId);
            }).catch(function () {
                showToast('Something went wrong.', 'error');
                startRevBtn.disabled = false;
                startRevBtn.textContent = 'Start Revision';
            });
            return;
        }
    });

    // ── Channel file upload ────────────────────────────────────────────────────────
    // Wire up each ch-file-input so that when a file is selected it uploads immediately
    // to /submission/upload with posm_channel_id in the form data.
    document.querySelectorAll('.ch-file-input').forEach(function (fileInput) {
        fileInput.addEventListener('change', function () {
            if (!fileInput.files || !fileInput.files.length) return;
            var chId = fileInput.dataset.channelId;
            var projectId = document.querySelector('.ch-upload-btn[data-channel-id="' + chId + '"]').dataset.projectId;
            var statusEl = document.getElementById('ch-upload-status-' + chId);

            if (statusEl) { statusEl.textContent = 'Uploading...'; }

            var formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('posm_channel_id', chId);

            fetch('/projects/' + projectId + '/submission/upload', {
                method: 'POST',
                body: formData
            }).then(function (r) { return r.json(); }).then(function (data) {
                if (!data.success) {
                    if (statusEl) { statusEl.textContent = data.error || 'Upload failed.'; }
                    showToast(data.error || 'Upload failed.', 'error');
                    return;
                }
                // Reload back to this channel — server will show State 2 (picker)
                reloadToChannel(chId);
            }).catch(function () {
                if (statusEl) { statusEl.textContent = 'Upload failed.'; }
                showToast('Something went wrong during upload.', 'error');
            });

            // Clear the input so the same file can be re-selected if needed
            fileInput.value = '';
        });
    });

    // Admin panel open / close
    var adminTrigger = document.getElementById('admin-panel-trigger');
    var adminPanel = document.getElementById('admin-panel');
    var closeAdminBtn = document.getElementById('close-admin-panel');

    if (adminTrigger) {
        adminTrigger.addEventListener('click', function () {
            adminPanel.classList.toggle('hidden');
        });
    }

    if (closeAdminBtn) {
        closeAdminBtn.addEventListener('click', function () {
            adminPanel.classList.add('hidden');
        });
    }

    // Admin section switching
    // Admin section switching
    document.querySelectorAll('.admin-nav-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.admin-nav-btn').forEach(function (b) {
                b.classList.remove('active');
            });
            document.querySelectorAll('.admin-section').forEach(function (s) {
                s.classList.add('hidden');
            });
            this.classList.add('active');
            var sectionName = this.dataset.section;
            var section = document.getElementById('admin-section-' + sectionName);
            if (section) section.classList.remove('hidden');
            if (sectionName === 'accounts') loadAccountsSection();
            if (sectionName === 'projects') loadProjectToolsSection();
            if (sectionName === 'activity') loadActivitySection();
        });
    });

    // ── Emulation ────────────────────────────────────────

    var emulateSearch = document.getElementById('emulate-search');
    var emulateUserList = document.getElementById('emulate-user-list');
    var exitEmulationBtn = document.getElementById('exit-emulation-btn');
    var allUsers = [];

    // Fetch user list when admin panel opens
    if (adminTrigger) {
        adminTrigger.addEventListener('click', function () {
            if (allUsers.length === 0 && emulateUserList) {
                fetch('/admin/api/users')
                    .then(function (r) { return r.json(); })
                    .then(function (users) {
                        allUsers = users;
                        renderUserList(users);
                    });
            }
        });
    }

    function renderUserList(users) {
        emulateUserList.innerHTML = '';
        if (users.length === 0) {
            emulateUserList.innerHTML = '<p class="no-notifications">No users found</p>';
            return;
        }
        users.forEach(function (user) {
            var row = document.createElement('div');
            row.className = 'emulate-user-row';
            row.innerHTML =
                '<div class="emulate-user-info">' +
                '<span class="emulate-user-name">' + user.name + '</span>' +
                '<span class="emulate-user-role">' + user.role + '</span>' +
                '</div>' +
                '<button type="button" class="emulate-user-btn" data-id="' + user.id + '">Emulate</button>';
            emulateUserList.appendChild(row);
        });

        emulateUserList.querySelectorAll('.emulate-user-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                fetch('/admin/emulate/' + this.dataset.id, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.success) window.location.reload();
                    });
            });
        });
    }

    // Live search filter
    if (emulateSearch) {
        emulateSearch.addEventListener('input', function () {
            var query = this.value.toLowerCase();
            var filtered = allUsers.filter(function (u) {
                return u.name.toLowerCase().includes(query) || u.role.toLowerCase().includes(query);
            });
            renderUserList(filtered);
        });
    }

    // Exit emulation
    if (exitEmulationBtn) {
        exitEmulationBtn.addEventListener('click', function () {
            fetch('/admin/emulate/exit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) window.location.reload();
                });
        });
    }

    // Emulation badge dropdown
    var badgeTrigger = document.getElementById('emulation-badge-trigger');
    var badgeDropdown = document.getElementById('emulation-badge-dropdown');
    var badgeUserSearch = document.getElementById('badge-user-search');
    var badgeUserList = document.getElementById('badge-user-list');
    var badgeUsers = [];

    function renderBadgeUserList(users) {
        badgeUserList.innerHTML = '';
        users.forEach(function (user) {
            var row = document.createElement('div');
            row.className = 'badge-user-row';
            row.innerHTML =
                '<div class="badge-user-info">' +
                '<span class="badge-user-name">' + user.name + '</span>' +
                '<span class="badge-user-role">' + user.role + '</span>' +
                '</div>';
            row.addEventListener('click', function () {
                fetch('/admin/emulate/' + user.id, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.success) window.location.reload();
                    });
            });
            badgeUserList.appendChild(row);
        });
    }

    if (badgeTrigger) {
        badgeTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var isHidden = badgeDropdown.classList.contains('hidden');
            badgeDropdown.classList.toggle('hidden');
            if (isHidden) {
                if (badgeUsers.length === 0) {
                    fetch('/admin/api/users')
                        .then(function (r) { return r.json(); })
                        .then(function (users) {
                            badgeUsers = users;
                            renderBadgeUserList(users);
                            if (badgeUserSearch) badgeUserSearch.focus();
                        });
                } else {
                    renderBadgeUserList(badgeUsers);
                    if (badgeUserSearch) badgeUserSearch.focus();
                }
            }
        });
    }

    if (badgeUserSearch) {
        badgeUserSearch.addEventListener('input', function () {
            var query = this.value.toLowerCase();
            var filtered = badgeUsers.filter(function (u) {
                return u.name.toLowerCase().includes(query) || u.role.toLowerCase().includes(query);
            });
            renderBadgeUserList(filtered);
        });
    }

    document.addEventListener('click', function (e) {
        if (badgeDropdown && !badgeDropdown.classList.contains('hidden')) {
            if (!badgeDropdown.contains(e.target) && e.target !== badgeTrigger) {
                badgeDropdown.classList.add('hidden');
            }
        }
    });

    // ── Accounts ─────────────────────────────────────────

    var accountsUserList = document.getElementById('accounts-user-list');
    var addUserToggle = document.getElementById('add-user-toggle');
    var addUserForm = document.getElementById('add-user-form');
    var addUserCancel = document.getElementById('add-user-cancel');
    var newUserRole = document.getElementById('new-user-role');
    var newUserTeam = document.getElementById('new-user-team');

    function loadAccountsSection() {
        if (!accountsUserList) return;
        fetch('/admin/api/users')
            .then(function (r) { return r.json(); })
            .then(function (users) {
                accountsUserList.innerHTML = '';

                var groups = [
                    { label: 'CS & Admin', filter: function (u) { return u.role === 'cs' || u.role === 'admin'; } },
                    { label: 'Management', filter: function (u) { return u.role === 'management'; } },
                    { label: '2D Team', filter: function (u) { return u.team === '2D'; } },
                    { label: '3D Team', filter: function (u) { return u.team === '3D'; } },
                    { label: 'Technical', filter: function (u) { return u.team === 'Technical'; } }
                ];

                groups.forEach(function (group) {
                    var members = users.filter(group.filter);
                    if (members.length === 0) return;

                    var heading = document.createElement('p');
                    heading.className = 'accounts-group-label';
                    heading.textContent = group.label;
                    accountsUserList.appendChild(heading);

                    members.forEach(function (user) {
                        var row = document.createElement('div');
                        row.className = 'account-user-row';
                        row.dataset.id = user.id;
                        row.innerHTML = renderAccountDisplay(user);
                        accountsUserList.appendChild(row);
                        attachRowActions(row, user);
                    });
                });

                if (accountsUserList.children.length === 0) {
                    accountsUserList.innerHTML = '<p class="no-notifications">No users found</p>';
                }
            });
    }

    function renderAccountDisplay(user) {
        var teamTag = user.team ? '<span class="account-user-team">' + user.team + '</span>' : '';
        return '<div class="account-user-info">' +
            '<span class="account-user-name">' + user.name + '</span>' +
            '<span class="account-user-role">' + user.role + '</span>' +
            teamTag +
            '</div>' +
            '<div class="account-user-actions">' +
            '<button type="button" class="account-edit-btn" data-name="' + user.name + '" data-role="' + user.role + '" data-team="' + (user.team || '') + '">Edit</button>' +
            '<button type="button" class="account-reset-btn" data-name="' + user.name + '">&#8635;</button>' +
            '<button type="button" class="account-delete-btn" data-name="' + user.name + '">&times;</button>' +
            '</div>';
    }

    function renderAccountEdit(user) {
        var roleOptions = ['cs', 'designer', 'team_lead', 'management', 'admin'].map(function (r) {
            return '<option value="' + r + '"' + (user.role === r ? ' selected' : '') + '>' + r + '</option>';
        }).join('');
        var teamOptions = ['2D', '3D', 'Technical'].map(function (t) {
            return '<option value="' + t + '"' + (user.team === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('');
        var teamHidden = (user.role === 'designer' || user.role === 'team_lead') ? '' : ' hidden';
        return '<div class="account-user-edit-form">' +
            '<input type="text" class="form-input edit-name" value="' + user.name + '" placeholder="Full name">' +
            '<input type="email" class="form-input edit-email" value="' + (user.email || '') + '" placeholder="Email">' +
            '<select class="form-input edit-role">' + roleOptions + '</select>' +
            '<select class="form-input edit-team' + teamHidden + '"><option value="">Select team...</option>' + teamOptions + '</select>' +
            '<input type="password" class="form-input edit-password" placeholder="New password (leave blank to keep)">' +
            '<div class="account-edit-actions">' +
            '<button type="button" class="account-save-btn btn-primary">Save</button>' +
            '<button type="button" class="account-cancel-edit-btn">Cancel</button>' +
            '</div>' +
            '</div>';
    }

    function attachRowActions(row, user) {
        var editBtn = row.querySelector('.account-edit-btn');
        var resetBtn = row.querySelector('.account-reset-btn');
        var deleteBtn = row.querySelector('.account-delete-btn');
        var saveBtn = row.querySelector('.account-save-btn');
        var cancelBtn = row.querySelector('.account-cancel-edit-btn');
        var editRole = row.querySelector('.edit-role');

        if (editBtn) {
            editBtn.addEventListener('click', function () {
                row.innerHTML = renderAccountEdit(user);
                attachRowActions(row, user);
            });
        }

        if (editRole) {
            editRole.addEventListener('change', function () {
                var teamField = row.querySelector('.edit-team');
                if (this.value === 'designer' || this.value === 'team_lead') {
                    teamField.classList.remove('hidden');
                } else {
                    teamField.classList.add('hidden');
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var name = row.querySelector('.edit-name').value.trim();
                var email = row.querySelector('.edit-email').value.trim();
                var role = row.querySelector('.edit-role').value;
                var team = row.querySelector('.edit-team').value;
                var password = row.querySelector('.edit-password').value.trim();
                fetch('/admin/api/users/' + user.id, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, email: email, role: role, team: team, password: password })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.success) {
                            row.innerHTML = renderAccountDisplay(data.user);
                            attachRowActions(row, data.user);
                        } else {
                            alert(data.error);
                        }
                    });
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                row.innerHTML = renderAccountDisplay(user);
                attachRowActions(row, user);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                if (!confirm('Reset password for ' + user.name + ' to Vitamin2026!?')) return;
                fetch('/admin/api/users/' + user.id + '/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.success) {
                            resetBtn.textContent = '✓';
                            setTimeout(function () { resetBtn.innerHTML = '&#8635;'; }, 2000);
                        }
                    });
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', function () {
                if (!confirm('Delete ' + user.name + '? This cannot be undone.')) return;
                fetch('/admin/api/users/' + user.id, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.success) {
                            row.remove();
                        } else {
                            alert('Could not delete user: ' + (data.error || 'Unknown error'));
                        }
                    })
                    .catch(function () {
                        alert('Server error while deleting user.');
                    });
            });
        }
    }

    if (addUserToggle) {
        addUserToggle.addEventListener('click', function () {
            addUserForm.classList.toggle('hidden');
        });
    }

    if (addUserCancel) {
        addUserCancel.addEventListener('click', function () {
            addUserForm.classList.add('hidden');
            addUserForm.reset();
            newUserTeam.classList.add('hidden');
        });
    }

    if (newUserRole) {
        newUserRole.addEventListener('change', function () {
            if (this.value === 'designer' || this.value === 'team_lead') {
                newUserTeam.classList.remove('hidden');
            } else {
                newUserTeam.classList.add('hidden');
            }
        });
    }

    if (addUserForm) {
        addUserForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = document.getElementById('new-user-name').value.trim();
            var email = document.getElementById('new-user-email').value.trim();
            var password = document.getElementById('new-user-password').value.trim();
            var role = newUserRole.value;
            var team = newUserTeam.value;
            fetch('/admin/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, email: email, password: password, role: role, team: team })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) {
                        addUserForm.reset();
                        newUserTeam.classList.add('hidden');
                        addUserForm.classList.add('hidden');
                        loadAccountsSection();
                    } else {
                        alert(data.error);
                    }
                });
        });
    }

    // ── Project Tools ─────────────────────────────────────────────────────────

    document.querySelectorAll('.pt-tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.pt-tab-btn').forEach(function (b) { b.classList.remove('active'); });
            document.querySelectorAll('.pt-panel').forEach(function (p) { p.classList.add('hidden'); });
            this.classList.add('active');
            var panel = document.getElementById('pt-panel-' + this.dataset.pt);
            if (panel) panel.classList.remove('hidden');
            loadPTPanel(this.dataset.pt);
        });
    });

    function loadProjectToolsSection() {
        var activeTab = document.querySelector('.pt-tab-btn.active');
        if (activeTab) loadPTPanel(activeTab.dataset.pt);
    }

    function loadPTPanel(name) {
        if (name === 'clients') loadPTClients();
        else if (name === 'customers') loadPTCustomers();
        else if (name === 'projects') loadPTProjects();
        else if (name === 'drafts') loadPTDrafts();
        else if (name === 'deliverables') loadPTDeliverables();
        else if (name === 'design-types') loadPTDesignTypes();
        else if (name === 'design-directions') loadPTDesignDirections();
    }

    // ── Clients ───────────────────────────────────────────────────

    function loadPTClients() {
        fetch('/admin/api/clients')
            .then(function (res) { return res.json(); })
            .then(function (clients) {
                var list = document.getElementById('pt-clients-list');
                if (clients.length === 0) {
                    list.innerHTML = '<p class="empty-state">No clients yet.</p>';
                    return;
                }
                list.innerHTML = clients.map(function (c) {
                    return '<div class="account-user-row" id="pt-client-' + c.id + '">' +
                        '<span class="account-user-name">' + c.name + '</span>' +
                        '<div class="account-user-actions">' +
                        '<button type="button" class="account-delete-btn" data-id="' + c.id + '" data-name="' + c.name + '">&times;</button>' +
                        '</div></div>';
                }).join('');
                list.querySelectorAll('.account-delete-btn').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        if (!confirm('Delete client "' + this.dataset.name + '"? This cannot be undone.')) return;
                        var id = this.dataset.id;
                        fetch('/admin/api/clients/' + id, { method: 'DELETE' })
                            .then(function (res) { return res.json(); })
                            .then(function (data) {
                                if (data.success) { document.getElementById('pt-client-' + id).remove(); }
                                else { alert(data.error || 'Could not delete client.'); }
                            });
                    });
                });
            });
    }

    var ptAddClientToggle = document.getElementById('pt-add-client-toggle');
    var ptAddClientForm = document.getElementById('pt-add-client-form');
    if (ptAddClientToggle) {
        ptAddClientToggle.addEventListener('click', function () {
            ptAddClientForm.classList.toggle('hidden');
        });
    }
    document.getElementById('pt-add-client-cancel').addEventListener('click', function () {
        ptAddClientForm.classList.add('hidden');
        document.getElementById('pt-new-client-name').value = '';
    });
    ptAddClientForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('pt-new-client-name').value.trim();
        if (!name) return;
        fetch('/admin/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.success) {
                    ptAddClientForm.classList.add('hidden');
                    document.getElementById('pt-new-client-name').value = '';
                    loadPTClients();
                } else { alert(data.error || 'Could not create client.'); }
            });
    });

    // ── Customers ─────────────────────────────────────────────────

    function loadPTCustomers() {
        fetch('/admin/api/customers')
            .then(function (res) { return res.json(); })
            .then(function (customers) {
                var list = document.getElementById('pt-customers-list');
                if (customers.length === 0) {
                    list.innerHTML = '<p class="empty-state">No customers yet.</p>';
                    return;
                }
                var grouped = {};
                customers.forEach(function (c) {
                    if (!grouped[c.region]) grouped[c.region] = [];
                    grouped[c.region].push(c);
                });
                var html = '';
                Object.keys(grouped).sort().forEach(function (region) {
                    html += '<div class="accounts-group-label">' + region.charAt(0).toUpperCase() + region.slice(1) + '</div>';
                    grouped[region].forEach(function (c) {
                        html += '<div class="account-user-row" id="pt-customer-' + c.id + '">' +
                            '<span class="account-user-name">' + c.name + '</span>' +
                            '<div class="account-user-actions">' +
                            '<button type="button" class="account-delete-btn" data-id="' + c.id + '" data-name="' + c.name + '">&times;</button>' +
                            '</div></div>';
                    });
                });
                list.innerHTML = html;
                list.querySelectorAll('.account-delete-btn').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        if (!confirm('Delete customer "' + this.dataset.name + '"? This cannot be undone.')) return;
                        var id = this.dataset.id;
                        fetch('/admin/api/customers/' + id, { method: 'DELETE' })
                            .then(function (res) { return res.json(); })
                            .then(function (data) {
                                if (data.success) { document.getElementById('pt-customer-' + id).remove(); }
                                else { alert(data.error || 'Could not delete customer.'); }
                            });
                    });
                });
            });
    }

    var ptAddCustomerToggle = document.getElementById('pt-add-customer-toggle');
    var ptAddCustomerForm = document.getElementById('pt-add-customer-form');
    if (ptAddCustomerToggle) {
        ptAddCustomerToggle.addEventListener('click', function () {
            ptAddCustomerForm.classList.toggle('hidden');
        });
    }
    document.getElementById('pt-add-customer-cancel').addEventListener('click', function () {
        ptAddCustomerForm.classList.add('hidden');
        document.getElementById('pt-new-customer-name').value = '';
        document.getElementById('pt-new-customer-region').value = '';
    });
    ptAddCustomerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('pt-new-customer-name').value.trim();
        var region = document.getElementById('pt-new-customer-region').value;
        if (!name || !region) return;
        fetch('/admin/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, region: region })
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.success) {
                    ptAddCustomerForm.classList.add('hidden');
                    document.getElementById('pt-new-customer-name').value = '';
                    document.getElementById('pt-new-customer-region').value = '';
                    loadPTCustomers();
                } else { alert(data.error || 'Could not create customer.'); }
            });
    });

    // ── Projects ──────────────────────────────────────────────────

    function loadPTProjects() {
        fetch('/admin/api/projects')
            .then(function (res) { return res.json(); })
            .then(function (projects) {
                var list = document.getElementById('pt-projects-list');
                if (projects.length === 0) {
                    list.innerHTML = '<p class="empty-state">No active projects.</p>';
                    return;
                }
                var statusLabel = { briefed: 'Briefed', in_queue: 'In Queue', in_progress: 'In Progress', submitted: 'Submitted', revision_in_queue: 'Revision in Queue', revision_in_progress: 'Revision in Progress', approved: 'Approved', completed: 'Completed' };
                list.innerHTML = projects.map(function (p) {
                    return '<div class="account-user-row" id="pt-project-' + p.id + '">' +
                        '<div class="account-user-info">' +
                        '<span class="account-user-name">' + p.name + '</span>' +
                        '<span class="account-user-role">' + (p.job_number || 'No job #') + ' · ' + p.cs_lead + ' · ' + (statusLabel[p.status] || p.status) + '</span>' +
                        '</div>' +
                        '<div class="account-user-actions">' +
                        '<button type="button" class="account-delete-btn" data-id="' + p.id + '" data-name="' + p.name + '">&times;</button>' +
                        '</div></div>';
                }).join('');
                list.querySelectorAll('.account-delete-btn').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        if (!confirm('Delete project "' + this.dataset.name + '"? This cannot be undone.')) return;
                        var id = this.dataset.id;
                        fetch('/admin/api/projects/' + id, { method: 'DELETE' })
                            .then(function (res) { return res.json(); })
                            .then(function (data) {
                                if (data.success) { document.getElementById('pt-project-' + id).remove(); }
                                else { alert(data.error || 'Could not delete project.'); }
                            });
                    });
                });
            });
    }

    // ── Drafts ────────────────────────────────────────────────────

    function loadPTDrafts() {
        fetch('/admin/api/drafts')
            .then(function (res) { return res.json(); })
            .then(function (drafts) {
                var list = document.getElementById('pt-drafts-list');
                if (drafts.length === 0) {
                    list.innerHTML = '<p class="empty-state">No drafts.</p>';
                    return;
                }
                list.innerHTML = drafts.map(function (d) {
                    return '<div class="account-user-row" id="pt-draft-' + d.id + '">' +
                        '<div class="account-user-info">' +
                        '<span class="account-user-name">' + d.name + '</span>' +
                        '<span class="account-user-role">' + d.cs_lead + '</span>' +
                        '</div>' +
                        '<div class="account-user-actions">' +
                        '<button type="button" class="account-delete-btn" data-id="' + d.id + '" data-name="' + d.name + '">&times;</button>' +
                        '</div></div>';
                }).join('');
                list.querySelectorAll('.account-delete-btn').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        if (!confirm('Delete draft "' + this.dataset.name + '"?')) return;
                        var id = this.dataset.id;
                        fetch('/admin/api/drafts/' + id, { method: 'DELETE' })
                            .then(function (res) { return res.json(); })
                            .then(function (data) {
                                if (data.success) { document.getElementById('pt-draft-' + id).remove(); }
                                else { alert(data.error || 'Could not delete draft.'); }
                            });
                    });
                });
            });
    }

    // ── Deliverable Types ─────────────────────────────────────────
    var ptFormClients = [];
    var ptFormCustomers = [];
    var ptDelFormLoaded = false;

    function loadPTDelFormData(callback) {
        if (ptDelFormLoaded) { callback(); return; }
        Promise.all([
            fetch('/admin/api/clients').then(function (r) { return r.json(); }),
            fetch('/admin/api/customers').then(function (r) { return r.json(); })
        ]).then(function (results) {
            ptFormClients = results[0];
            ptFormCustomers = results[1];
            ptDelFormLoaded = true;
            callback();
        });
    }

    function populatePTDelFormClients() {
        var sel = document.getElementById('pt-new-del-client');
        sel.innerHTML = '<option value="">Select client...</option>' +
            ptFormClients.map(function (c) {
                return '<option value="' + c.id + '">' + c.name + '</option>';
            }).join('');
    }

    function populatePTDelFormCustomers(region) {
        var filtered = region
            ? ptFormCustomers.filter(function (c) { return c.region === region; })
            : ptFormCustomers;
        var sel = document.getElementById('pt-new-del-customer');
        sel.innerHTML = '<option value="">Select customer...</option>' +
            filtered.map(function (c) {
                return '<option value="' + c.id + '">' + c.name + '</option>';
            }).join('');
    }

    var ptAddDelToggle = document.getElementById('pt-add-del-toggle');
    var ptAddDelForm = document.getElementById('pt-add-del-form');

    ptAddDelToggle.addEventListener('click', function () {
        var opening = ptAddDelForm.classList.contains('hidden');
        ptAddDelForm.classList.toggle('hidden');
        if (opening) {
            loadPTDelFormData(function () {
                populatePTDelFormClients();
                populatePTDelFormCustomers('');
            });
        }
    });

    document.getElementById('pt-add-del-cancel').addEventListener('click', function () {
        ptAddDelForm.classList.add('hidden');
        ptAddDelForm.reset();
    });

    document.getElementById('pt-new-del-region').addEventListener('change', function () {
        populatePTDelFormCustomers(this.value);
    });

    ptAddDelForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('pt-new-del-name').value.trim();
        var clientId = document.getElementById('pt-new-del-client').value;
        var customerId = document.getElementById('pt-new-del-customer').value;
        var disciplines = Array.from(
            ptAddDelForm.querySelectorAll('.pt-discipline-checks input:checked')
        ).map(function (cb) { return cb.value; });
        var isCustom = document.getElementById('pt-new-del-custom').checked;
        if (!name || !clientId || !customerId) {
            alert('Name, client, and customer are all required.');
            return;
        }
        fetch('/admin/api/deliverable-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                client_id: clientId,
                customer_id: customerId,
                disciplines: disciplines,
                is_custom: isCustom
            })
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.success) {
                    ptAddDelForm.classList.add('hidden');
                    ptAddDelForm.reset();
                    ptAllDeliverableTypes.push(data.type);
                    ptAllDeliverableTypes.sort(function (a, b) { return a.name.localeCompare(b.name); });
                    populatePTDelClientFilter(ptAllDeliverableTypes);
                    filterPTDeliverables(); // re-apply current filters instead of showing all rows
                } else {
                    alert(data.error || 'Could not create deliverable type.');
                }
            });
    });


    var ptAllDeliverableTypes = [];

    function loadPTDeliverables() {
        fetch('/admin/api/deliverable-types')
            .then(function (res) { return res.json(); })
            .then(function (types) {
                ptAllDeliverableTypes = types;
                populatePTDelClientFilter(types);
                renderPTDeliverableRows(types);
            });
    }

    // ── Design Types ──────────────────────────────────────────────
    function loadPTDesignTypes() {
        fetch('/admin/api/design-types')
            .then(function (r) { return r.json(); })
            .then(function (types) {
                var list = document.getElementById('pt-design-types-list');
                list.innerHTML = types.length === 0 ? '<p class="empty-state">No design types yet.</p>' :
                    types.map(function (t) {
                        return '<div class="account-user-row" id="pt-dt-' + t.id + '">' +
                            '<div class="account-user-info">' +
                            '<span class="account-user-name">' + t.name + '</span>' +
                            '<span class="account-user-role">' + (t.team ? t.team.split(',').join(' + ') : 'No team set') + '</span>' +
                            '</div>' +
                            '<div class="account-user-actions">' +
                            '<button class="account-edit-btn pt-dt-edit" data-id="' + t.id + '" data-name="' + t.name + '" data-team="' + (t.team || '') + '">Edit</button>' +
                            '<button class="account-delete-btn pt-dt-delete" data-id="' + t.id + '" data-name="' + t.name + '">&times;</button>' +
                            '</div></div>';
                    }).join('');
                list.querySelectorAll('.pt-dt-delete').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        if (!confirm('Delete design type "' + this.dataset.name + '"?')) return;
                        var id = this.dataset.id;
                        fetch('/admin/api/design-types/' + id, { method: 'DELETE' })
                            .then(function (r) { return r.json(); })
                            .then(function (d) { if (d.success) { document.getElementById('pt-dt-' + id).remove(); } else { alert(d.error); } });
                    });
                });
                list.querySelectorAll('.pt-dt-edit').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var id = this.dataset.id;
                        var row = document.getElementById('pt-dt-' + id);
                        var currentName = this.dataset.name;
                        var currentTeam = this.dataset.team;
                        var currentTeams = currentTeam ? currentTeam.split(',') : [];
                        row.innerHTML =
                            '<div class="pt-inline-edit">' +
                            '<input type="text" class="form-input pt-edit-name" value="' + currentName + '" style="max-width:180px;">' +
                            '<div class="pt-discipline-checks pt-edit-teams">' +
                            ['2D', '3D', 'Technical'].map(function (t) {
                                return '<label><input type="checkbox" value="' + t + '"' + (currentTeams.indexOf(t) !== -1 ? ' checked' : '') + '> ' + t + '</label>';
                            }).join('') +
                            '</div>' +
                            '<button class="btn-primary pt-dt-save" data-id="' + id + '">Save</button>' +
                            '<button class="account-delete-btn pt-dt-cancel" data-id="' + id + '">Cancel</button>' +
                            '</div>';
                        row.querySelector('.pt-dt-save').addEventListener('click', function () {
                            var newName = row.querySelector('.pt-edit-name').value.trim();
                            var newTeam = Array.from(row.querySelectorAll('.pt-edit-teams input:checked')).map(function (cb) { return cb.value; }).join(',') || null;
                            if (!newName) return;
                            fetch('/admin/api/design-types/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, team: newTeam }) })
                                .then(function (r) { return r.json(); })
                                .then(function () { loadPTDesignTypes(); });
                        });
                        row.querySelector('.pt-dt-cancel').addEventListener('click', function () { loadPTDesignTypes(); });
                    });
                });
            });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var addDtToggle = document.getElementById('pt-add-dt-toggle');
        var addDtForm = document.getElementById('pt-add-dt-form');
        var addDtCancel = document.getElementById('pt-add-dt-cancel');
        if (addDtToggle) {
            addDtToggle.addEventListener('click', function () { addDtForm.classList.toggle('hidden'); });
            addDtCancel.addEventListener('click', function () { addDtForm.classList.add('hidden'); });
            addDtForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var name = document.getElementById('pt-new-dt-name').value.trim();
                var checked = Array.from(document.querySelectorAll('#pt-new-dt-teams input:checked')).map(function (cb) { return cb.value; });
                var team = checked.join(',') || null;
                if (!name) return;
                fetch('/admin/api/design-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, team: team }) })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        if (d.error) { alert(d.error); return; }
                        document.getElementById('pt-new-dt-name').value = '';
                        document.querySelectorAll('#pt-new-dt-teams input').forEach(function (cb) { cb.checked = false; });
                        addDtForm.classList.add('hidden');
                        loadPTDesignTypes();
                    });
            });
        }

        // ── Design Directions ──────────────────────────────────────
        var addDdToggle = document.getElementById('pt-add-dd-toggle');
        var addDdForm = document.getElementById('pt-add-dd-form');
        var addDdCancel = document.getElementById('pt-add-dd-cancel');
        if (addDdToggle) {
            addDdToggle.addEventListener('click', function () { addDdForm.classList.toggle('hidden'); });
            addDdCancel.addEventListener('click', function () { addDdForm.classList.add('hidden'); });
            addDdForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var name = document.getElementById('pt-new-dd-name').value.trim();
                if (!name) return;
                fetch('/admin/api/design-directions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }) })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        if (d.error) { alert(d.error); return; }
                        document.getElementById('pt-new-dd-name').value = '';
                        addDdForm.classList.add('hidden');
                        loadPTDesignDirections();
                    });
            });
        }
    });

    function loadPTDesignDirections() {
        fetch('/admin/api/design-directions')
            .then(function (r) { return r.json(); })
            .then(function (dirs) {
                var list = document.getElementById('pt-design-directions-list');
                list.innerHTML = dirs.length === 0 ? '<p class="empty-state">No design directions yet.</p>' :
                    dirs.map(function (d) {
                        return '<div class="account-user-row" id="pt-dd-' + d.id + '">' +
                            '<div class="account-user-info"><span class="account-user-name">' + d.name + '</span></div>' +
                            '<div class="account-user-actions">' +
                            '<button class="account-edit-btn pt-dd-edit" data-id="' + d.id + '" data-name="' + d.name + '">Edit</button>' +
                            '<button class="account-delete-btn pt-dd-delete" data-id="' + d.id + '" data-name="' + d.name + '">&times;</button>' +
                            '</div></div>';
                    }).join('');
                list.querySelectorAll('.pt-dd-delete').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        if (!confirm('Delete design direction "' + this.dataset.name + '"?')) return;
                        var id = this.dataset.id;
                        fetch('/admin/api/design-directions/' + id, { method: 'DELETE' })
                            .then(function (r) { return r.json(); })
                            .then(function (d) { if (d.success) { document.getElementById('pt-dd-' + id).remove(); } else { alert(d.error); } });
                    });
                });
                list.querySelectorAll('.pt-dd-edit').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var id = this.dataset.id;
                        var row = document.getElementById('pt-dd-' + id);
                        var currentName = this.dataset.name;
                        row.innerHTML =
                            '<div class="pt-inline-edit">' +
                            '<input type="text" class="form-input pt-edit-name" value="' + currentName + '" style="max-width:240px;">' +
                            '<button class="btn-primary pt-dd-save" data-id="' + id + '">Save</button>' +
                            '<button class="account-delete-btn pt-dd-cancel">Cancel</button>' +
                            '</div>';
                        row.querySelector('.pt-dd-save').addEventListener('click', function () {
                            var newName = row.querySelector('.pt-edit-name').value.trim();
                            if (!newName) return;
                            fetch('/admin/api/design-directions/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) })
                                .then(function (r) { return r.json(); })
                                .then(function () { loadPTDesignDirections(); });
                        });
                        row.querySelector('.pt-dd-cancel').addEventListener('click', function () { loadPTDesignDirections(); });
                    });
                });
            });
    }

    function populatePTDelClientFilter(types) {
        var seen = {};
        var clients = [];
        types.forEach(function (t) {
            if (t.client !== '—' && !seen[t.client]) {
                seen[t.client] = true;
                clients.push(t.client);
            }
        });
        clients.sort();
        var sel = document.getElementById('pt-filter-client');
        var prev = sel.value; // Save current selection befoe rebuilding
        sel.innerHTML = '<option value="">All Clients</option>' +
            clients.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
        if (clients.indexOf(prev) !== -1) sel.value = prev; // restore if still valid
    }

    function populatePTDelCustomerFilter(region) {
        var filtered = region
            ? ptAllDeliverableTypes.filter(function (t) { return t.region === region; })
            : ptAllDeliverableTypes;
        var seen = {};
        var customers = [];
        filtered.forEach(function (t) {
            if (t.customer !== '—' && !seen[t.customer]) {
                seen[t.customer] = true;
                customers.push(t.customer);
            }
        });
        customers.sort();
        var sel = document.getElementById('pt-filter-customer');
        var prev = sel.value;
        sel.innerHTML = '<option value="">All Customers</option>' +
            customers.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
        if (customers.indexOf(prev) !== -1) sel.value = prev;
    }

    function filterPTDeliverables() {
        var client = document.getElementById('pt-filter-client').value;
        var region = document.getElementById('pt-filter-region').value;
        var customer = document.getElementById('pt-filter-customer').value;
        var filtered = ptAllDeliverableTypes.filter(function (t) {
            if (client && t.client !== client) return false;
            if (region && t.region !== region) return false;
            if (customer && t.customer !== customer) return false;
            return true;
        });
        renderPTDeliverableRows(filtered);
    }

    document.getElementById('pt-filter-client').addEventListener('change', filterPTDeliverables);
    document.getElementById('pt-filter-region').addEventListener('change', function () {
        populatePTDelCustomerFilter(this.value);
        filterPTDeliverables();
    });
    document.getElementById('pt-filter-customer').addEventListener('change', filterPTDeliverables);

    function renderPTDeliverableRows(types) {
        var list = document.getElementById('pt-deliverables-list');
        if (types.length === 0) {
            list.innerHTML = '<p class="empty-state">No deliverable types match.</p>';
            return;
        }
        list.innerHTML = types.map(function (t) {
            return '<div class="account-user-row" id="pt-del-' + t.id + '">' +
                '<div class="account-user-info">' +
                '<span class="account-user-name">' + t.name + '</span>' +
                '<span class="account-user-role">' + t.client + ' · ' + t.customer + (t.is_custom ? ' · Custom' : '') + '</span>' +
                '</div>' +
                '<div class="account-user-actions">' +
                '<button type="button" class="account-edit-btn" data-id="' + t.id + '">Edit</button>' +
                '<button type="button" class="account-delete-btn" data-id="' + t.id + '" data-name="' + t.name + '">&times;</button>' +
                '</div></div>';
        }).join('');

        list.querySelectorAll('.account-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!confirm('Delete "' + this.dataset.name + '"?')) return;
                var id = this.dataset.id;
                fetch('/admin/api/deliverable-types/' + id, { method: 'DELETE' })
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        if (data.success) {
                            ptAllDeliverableTypes = ptAllDeliverableTypes.filter(function (t) { return String(t.id) !== String(id); });
                            document.getElementById('pt-del-' + id).remove();
                        } else { alert(data.error || 'Could not delete.'); }
                    });
            });
        });

        list.querySelectorAll('.account-edit-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = this.dataset.id;
                var type = ptAllDeliverableTypes.find(function (t) { return String(t.id) === String(id); });
                if (!type) return;
                var row = document.getElementById('pt-del-' + id);
                row.innerHTML =
                    '<div class="account-user-edit-form">' +
                    '<input type="text" class="form-input pt-del-name-input" value="' + type.name + '">' +
                    '<div class="pt-discipline-checks">' +
                    ['2d', '3d', 'technical'].map(function (d) {
                        var checked = type.disciplines.indexOf(d) !== -1 ? 'checked' : '';
                        return '<label><input type="checkbox" value="' + d + '" ' + checked + '> ' + d.toUpperCase() + '</label>';
                    }).join('') +
                    '</div>' +
                    '<div class="account-edit-actions">' +
                    '<button type="button" class="btn-primary pt-del-save-btn">Save</button>' +
                    '<button type="button" class="account-cancel-edit-btn">Cancel</button>' +
                    '</div></div>';
                row.querySelector('.account-cancel-edit-btn').addEventListener('click', function () {
                    renderPTDeliverableRows(ptAllDeliverableTypes);
                });
                row.querySelector('.pt-del-save-btn').addEventListener('click', function () {
                    var name = row.querySelector('.pt-del-name-input').value.trim();
                    var disciplines = Array.from(
                        row.querySelectorAll('.pt-discipline-checks input:checked')
                    ).map(function (cb) { return cb.value; });
                    if (!name) { alert('Name is required.'); return; }
                    fetch('/admin/api/deliverable-types/' + id, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name, disciplines: disciplines })
                    })
                        .then(function (res) { return res.json(); })
                        .then(function (data) {
                            if (data.success) {
                                var idx = ptAllDeliverableTypes.findIndex(function (t) { return String(t.id) === String(id); });
                                if (idx !== -1) {
                                    ptAllDeliverableTypes[idx].name = name;
                                    ptAllDeliverableTypes[idx].disciplines = disciplines;
                                }
                                renderPTDeliverableRows(ptAllDeliverableTypes);
                            } else { alert(data.error || 'Could not save.'); }
                        });
                });
            });
        });
    }

    // ── Activity Log ───────────────────────────────────────────────

    function loadActivitySection() {
        var search = document.getElementById('activity-search').value.trim();
        var from = document.getElementById('activity-from').value;
        var to = document.getElementById('activity-to').value;
        var category = document.getElementById('activity-category').value; // 'all' or a named category

        var params = new URLSearchParams();
        if (search) params.append('search', search);
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        // Only send category param when the user has selected a specific filter —
        // 'all' means no filter and the backend returns everything.
        if (category && category !== 'all') params.append('category', category);

        var url = '/admin/api/activity' + (params.toString() ? '?' + params.toString() : '');

        fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (entries) {
                var list = document.getElementById('activity-log-list');
                if (entries.length === 0) {
                    list.innerHTML = '<p class="empty-state">No activity found.</p>';
                    return;
                }
                list.innerHTML = entries.map(function (e) {
                    return '<div class="activity-entry" id="activity-' + e.id + '">' +
                        '<div class="activity-entry-body">' +
                        '<span class="activity-description">' + e.description + '</span>' +
                        '<span class="activity-meta">' + e.user + ' · ' + e.created_at + '</span>' +
                        '</div>' +
                        '<button type="button" class="account-delete-btn" data-id="' + e.id + '">&times;</button>' +
                        '</div>';
                }).join('');

                list.querySelectorAll('.account-delete-btn').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var id = this.dataset.id;
                        fetch('/admin/api/activity/' + id, { method: 'DELETE' })
                            .then(function (res) { return res.json(); })
                            .then(function (data) {
                                if (data.success) {
                                    document.getElementById('activity-' + id).remove();
                                }
                            });
                    });
                });
            });
    }

    if (document.getElementById('activity-search-btn')) {

        document.getElementById('activity-search-btn').addEventListener('click', function () {
            loadActivitySection();
        });

        document.getElementById('activity-reset-btn').addEventListener('click', function () {
            document.getElementById('activity-search').value = '';
            document.getElementById('activity-from').value = '';
            document.getElementById('activity-to').value = '';
            document.getElementById('activity-category').value = 'all';
            loadActivitySection();
        });

        // Category dropdown — filter immediately on change, no need to click Search
        document.getElementById('activity-category').addEventListener('change', function () {
            loadActivitySection();
        });

        document.getElementById('activity-export-btn').addEventListener('click', function () {
            fetch('/admin/api/activity/export', { method: 'POST' })
                .then(function (res) {
                    if (!res.ok) {
                        return res.json().then(function (d) { alert(d.error || 'Export failed.'); });
                    }
                    var disposition = res.headers.get('Content-Disposition');
                    var filename = 'activity-log.txt';
                    if (disposition) {
                        var match = disposition.match(/filename="(.+)"/);
                        if (match) filename = match[1];
                    }
                    return res.blob().then(function (blob) {
                        var url = URL.createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    });
                });
        });

        document.getElementById('activity-wipe-btn').addEventListener('click', function () {
            if (!confirm('Wipe the entire activity log? This cannot be undone.')) return;
            fetch('/admin/api/activity/clear', { method: 'POST' })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.success) {
                        loadActivitySection();
                    } else {
                        alert('Could not wipe log.');
                    }
                });
        });

    }

    // ── Reference File Uploads ────────────────────────────────────

    // Only run on pages that have the upload button
    var refFileBtn = document.getElementById('refFileBtn');
    var refFileInput = document.getElementById('refFileInput');

    if (refFileBtn && refFileInput) {

        // Clicking the button triggers the hidden file input
        refFileBtn.addEventListener('click', function () {
            refFileInput.click();
        });

        // When a file is selected, upload it immediately via fetch
        refFileInput.addEventListener('change', function () {
            var file = refFileInput.files[0];
            if (!file) return;

            // Get the project ID from a data attribute we'll add to the button
            var projectId = refFileBtn.dataset.projectId;
            var status = document.getElementById('refFileStatus');

            status.textContent = 'Uploading...';

            // Build a FormData object — this is how we send files via fetch
            var formData = new FormData();
            formData.append('file', file);

            fetch('/projects/' + projectId + '/upload-file', {
                method: 'POST',
                body: formData
                // Note: do NOT set Content-Type header — the browser sets it
                // automatically with the correct multipart boundary when using FormData
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.success) {
                        status.textContent = 'Error: ' + data.error;
                        return;
                    }

                    status.textContent = 'Uploaded.';
                    setTimeout(function () { status.textContent = ''; }, 3000);

                    // Reset input so the same file can be re-uploaded if needed
                    refFileInput.value = '';

                    // Build and inject the new file row into the list
                    var list = document.getElementById('reference-files-list');

                    // Remove the "no files" message if present
                    var noFilesMsg = list.querySelector('.no-files-msg');
                    if (noFilesMsg) noFilesMsg.remove();

                    var icons = { jpg: '🖼', jpeg: '🖼', png: '🖼', pdf: '📄', docx: '📝', xlsx: '📊' };
                    var icon = icons[data.file.file_type] || '📎';

                    var item = document.createElement('div');
                    item.className = 'reference-file-item';
                    item.dataset.fileId = data.file.id;
                    item.innerHTML = `
                <span class="reference-file-icon">${icon}</span>
                <span class="reference-file-name">${data.file.original_filename}</span>
                <span class="reference-file-meta">${data.file.uploaded_by}</span>
                <div class="reference-file-actions">
                    <a href="/projects/files/${data.file.id}/download"
                       class="btn-secondary btn-sm">Download</a>
                    <button class="btn-danger btn-sm reference-file-delete-btn"
                            data-file-id="${data.file.id}">Remove</button>
                </div>
            `;

                    // Attach delete handler to the new button
                    item.querySelector('.reference-file-delete-btn').addEventListener('click', handleFileDelete);

                    list.appendChild(item);
                })
                .catch(function (err) {
                    status.textContent = 'Upload failed.';
                    console.error('File upload error:', err);
                });
        });

        // Delete handler — attached to existing buttons on page load and new ones dynamically
        function handleFileDelete(e) {
            var fileId = this.dataset.fileId;
            var item = this.closest('.reference-file-item');

            if (!confirm('Remove this file?')) return;

            fetch('/projects/files/' + fileId + '/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.success) return;
                    item.remove();

                    // Show empty message if no files remain
                    var list = document.getElementById('reference-files-list');
                    if (list.querySelectorAll('.reference-file-item').length === 0) {
                        var msg = document.createElement('p');
                        msg.className = 'no-files-msg';
                        msg.textContent = 'No reference files uploaded yet.';
                        list.appendChild(msg);
                    }
                });
        }

        // Attach delete handler to all existing delete buttons on page load
        document.querySelectorAll('.reference-file-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', handleFileDelete);
        });
    }