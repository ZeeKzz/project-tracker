// main.js - Vitamin Helix
console.log("Vitamin Helix loaded.");

// Clickable row logic
document.querySelectorAll('.clickable').forEach(row => {
    row.addEventListener('click', function () {
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

// Archive a notification
document.querySelectorAll('.notification-archive-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var notificationId = this.dataset.id;
        var item = this.closest('.notification-item');

        fetch('/notifications/' + notificationId + '/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.success) return;

                // Update badge count
                var badge = document.querySelector('.bell-badge');
                if (badge && item.classList.contains('unread')) {
                    var count = parseInt(badge.textContent) - 1;
                    if (count <= 0) {
                        badge.remove();
                    } else {
                        badge.textContent = count;
                    }
                }

                // Remove from active list
                item.remove();

                // Show empty state if nothing left
                var activeList = document.getElementById('active-notifications');
                if (activeList && activeList.querySelectorAll('.notification-item').length === 0) {
                    var empty = document.createElement('p');
                    empty.className = 'no-notifications';
                    empty.textContent = 'No notifications';
                    activeList.appendChild(empty);
                }
            });
    });
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


// Team lead dashboard toggle - team view vs personal view
const btnTeamView = document.getElementById('btn-team-view');
const btnPersonalView = document.getElementById('btn-personal-view');
const teamView = document.getElementById('team-view');
const personalView = document.getElementById('personal-view');

if (btnTeamView && btnPersonalView && teamView && personalView) {
    btnTeamView.addEventListener('click', function () {
        teamView.classList.remove('hidden');
        personalView.classList.add('hidden');
        btnTeamView.classList.add('active');
        btnPersonalView.classList.remove('active');
    });

    btnPersonalView.addEventListener('click', function () {
        personalView.classList.remove('hidden');
        teamView.classList.add('hidden');
        btnPersonalView.classList.add('active');
        btnTeamView.classList.remove('active');
    });
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

// CS dashboard toggle - my projects vs all projects
const btnMyProjects = document.getElementById('btn-my-projects');
const btnAllProjects = document.getElementById('btn-all-projects');
const myProjectsView = document.getElementById('my-projects-view');
const allProjectsView = document.getElementById('all-projects-view');

if (btnMyProjects && btnAllProjects && myProjectsView && allProjectsView) {
    btnMyProjects.addEventListener('click', function () {
        myProjectsView.classList.remove('hidden');
        allProjectsView.classList.add('hidden');
        btnMyProjects.classList.add('active');
        btnAllProjects.classList.remove('active');
    });

    btnAllProjects.addEventListener('click', function () {
        allProjectsView.classList.remove('hidden');
        myProjectsView.classList.add('hidden');
        btnAllProjects.classList.add('active');
        btnMyProjects.classList.remove('active');
    });
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
                            }, 620);
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
            var ccmChecks = [
                function () { return document.getElementById('urgency').value !== ''; },
                function () { return document.querySelector('.region-btn[data-region].active') !== null; },
                function () { return document.querySelectorAll('.customer-pill.selected').length > 0; },
                function () { return document.getElementById('campaign_notes').value.trim() !== ''; },
                function () { return document.querySelectorAll('.deliverable-row').length > 0; },
            ];
            var ccmWeight = 75 / ccmChecks.length;
            ccmChecks.forEach(function (check) {
                if (check()) score += ccmWeight;
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
        document.getElementById('sectionConcept').classList.toggle('hidden', !isCCM);
        document.getElementById('sectionCCM').classList.toggle('hidden', !isCCM);
        document.getElementById('sectionDeliverables').classList.toggle('hidden', true);

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
                campaign_notes: document.getElementById('campaign_notes').value,
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
            document.getElementById('campaign_notes').value = state.campaign_notes || '';

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

        block.innerHTML =
            '<h4 class="deliverables-customer-heading">' + customerName + '</h4>' +
            '<div class="deliverables-customer-dates">' +
            '<div class="customer-date-field">' +
            '<label class="customer-date-label">Design Deadline</label>' +
            '<input type="date" class="form-input" id="design_deadline_' + customerId + '">' +
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
        var installVal = document.getElementById('installation_date_' + firstId).value;

        for (var i = 1; i < blocks.length; i++) {
            var cid = blocks[i].dataset.customerId;
            var ddEl = document.getElementById('design_deadline_' + cid);
            var instEl = document.getElementById('installation_date_' + cid);
            if (ddEl) ddEl.value = designVal;
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

        var hasKvEl = document.getElementById('has_kv');
        var hasKv = hasKvEl ? hasKvEl.value === 'true' : false;

        var customerDates = {};
        document.querySelectorAll('.deliverables-customer-block').forEach(function (block) {
            var cid = block.dataset.customerId;
            var ddEl = document.getElementById('design_deadline_' + cid);
            var instEl = document.getElementById('installation_date_' + cid);
            customerDates[cid] = {
                design_deadline: ddEl ? ddEl.value || null : null,
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
            has_kv: hasKv,
            kv_requirements: document.getElementById('kv_requirements') ? document.getElementById('kv_requirements').value.trim() || null : null,
            kv_deadline: document.getElementById('kv_deadline') ? document.getElementById('kv_deadline').value || null : null,
            kv_options_required: document.getElementById('kv_options_required') ? parseInt(document.getElementById('kv_options_required').value) || null : null,
            customer_dates: customerDates,
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
                    var now = new Date();
                    var hh = now.getHours().toString().padStart(2, '0');
                    var mm = now.getMinutes().toString().padStart(2, '0');
                    statusEl.textContent = 'Saved ' + hh + ':' + mm;
                }
            })
            .catch(function () {
                statusEl.textContent = 'Save failed';
            });
    }

    function scheduleAutosave() {
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

    var btnKVToggle = document.getElementById('btnKVToggle');
    if (btnKVToggle) {
        btnKVToggle.addEventListener('click', function () {
            var kvBlock = document.getElementById('kvBlock');
            var hasKvInput = document.getElementById('has_kv');
            var isOpen = !kvBlock.classList.contains('hidden');

            kvBlock.classList.toggle('hidden', isOpen);
            hasKvInput.value = isOpen ? 'false' : 'true';
            btnKVToggle.textContent = isOpen ? '+ Include Initial KV' : '− Remove KV';
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

    var campaignNotes = document.getElementById('campaign_notes');
    if (campaignNotes) {
        campaignNotes.addEventListener('keyup', function () {
            calculateCompletion();
            scheduleAutosave();
        });
    }

    var btnReviewSubmit = document.getElementById('btnReviewSubmit');
    if (btnReviewSubmit) {
        btnReviewSubmit.addEventListener('click', function () {
            if (currentCompletion < 100) {
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
                    window.location.href = data.redirect_url + '?toast=Project+submitted+successfully';
                })
                .catch(function () {
                    showToast('Something went wrong. Please try again.', 'error');
                    btnSubmitBrief.disabled = false;
                    btnSubmitBrief.textContent = 'Submit Brief';
                });
        });
    }

    // ── Initialise ───────────────────────────────────────────
    setupAddClient();

    var urlParams = new URLSearchParams(window.location.search);
    var draftIdParam = urlParams.get('draft_id');
    if (draftIdParam) {
        currentDraftId = parseInt(draftIdParam);
        var briefTypeEl = document.getElementById('brief_type');
        if (briefTypeEl && briefTypeEl.value) {
            switchBriefType(briefTypeEl.value);
        }
    }

    calculateCompletion();

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
        if (e.target.closest('a, button')) return;
        var expandRow = this.nextElementSibling;
        if (!expandRow || !expandRow.classList.contains('expansion-row')) return;
        expandRow.classList.toggle('hidden');
        var icon = this.querySelector('.chevron-icon');
        if (icon) icon.classList.toggle('rotated');
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
    var roleOptions = ['cs', 'designer', 'team_lead', 'admin'].map(function (r) {
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
                    if (data.success) row.remove();
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
            list.innerHTML = projects.map(function (p) {
                return '<div class="account-user-row" id="pt-project-' + p.id + '">' +
                    '<div class="account-user-info">' +
                    '<span class="account-user-name">' + p.name + '</span>' +
                    '<span class="account-user-role">' + (p.job_number || 'No job #') + ' · ' + p.cs_lead + '</span>' +
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
                renderPTDeliverableRows(ptAllDeliverableTypes);
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
    sel.innerHTML = '<option value="">All Clients</option>' +
        clients.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
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

    var params = new URLSearchParams();
    if (search) params.append('search', search);
    if (from) params.append('from', from);
    if (to) params.append('to', to);

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

document.getElementById('activity-search-btn').addEventListener('click', function () {
    loadActivitySection();
});

document.getElementById('activity-reset-btn').addEventListener('click', function () {
    document.getElementById('activity-search').value = '';
    document.getElementById('activity-from').value = '';
    document.getElementById('activity-to').value = '';
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