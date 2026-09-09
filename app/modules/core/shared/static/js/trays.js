// Global trays — the dock launchers, the shared panel shell, and the
// unread-bubble hook B2/B3 feed. Lives outside #main-content, so this binds
// once per session and SPA page swaps never touch it.
(function () {
    var STORAGE_KEY = 'helix.openTray';

    var dock = document.getElementById('tray-dock');
    var panel = document.getElementById('tray-panel');
    if (!dock || !panel) return;

    var titleEl = document.getElementById('tray-panel-title');
    var actionsEl = document.getElementById('tray-panel-actions');
    var bodyEl = document.getElementById('tray-panel-body');
    var closeBtn = document.getElementById('tray-panel-close');

    var launchers = {};
    dock.querySelectorAll('.tray-launcher').forEach(function (btn) {
        launchers[btn.dataset.tray] = btn;
    });

    var openTray = null;
    // name -> { onOpen, onClose, onSignal } — filled by each tray's own script.
    var registry = {};

    function remember(name) {
        try {
            if (name) localStorage.setItem(STORAGE_KEY, name);
            else localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            // Private mode or blocked storage — the dock still works, it just forgets.
        }
    }

    function close() {
        if (!openTray) return;
        var previous = openTray;
        openTray = null;
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
        launchers[previous].classList.remove('is-open');
        launchers[previous].setAttribute('aria-expanded', 'false');
        remember(null);
        var entry = registry[previous];
        if (entry && entry.onClose) entry.onClose(bodyEl, actionsEl);
    }

    function open(name) {
        var btn = launchers[name];
        if (!btn) return;
        if (openTray === name) { close(); return; }
        if (openTray) close();

        openTray = name;
        // The launcher's own icon doubles as the panel's, so there is one copy of it.
        var icon = btn.querySelector('svg');
        titleEl.innerHTML = '';
        if (icon) titleEl.appendChild(icon.cloneNode(true));
        titleEl.appendChild(document.createTextNode(btn.dataset.title || name));

        // The shell hands each tray a clean body and header slot on every open.
        actionsEl.innerHTML = '';
        bodyEl.innerHTML = '';

        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        remember(name);

        var entry = registry[name];
        if (entry && entry.onOpen) entry.onOpen(bodyEl, actionsEl);
    }

    // The public hook B2/B3 use. 0 or less hides the bubble entirely.
    function setUnread(name, count) {
        var btn = launchers[name];
        if (!btn) return;
        var bubble = btn.querySelector('.tray-launcher__bubble');
        if (!bubble) return;
        var n = parseInt(count, 10) || 0;
        bubble.textContent = n > 99 ? '99+' : String(n);
        bubble.hidden = n <= 0;
    }

    function register(name, options) {
        registry[name] = options || {};
    }

    Object.keys(launchers).forEach(function (name) {
        launchers[name].addEventListener('click', function () { open(name); });
    });
    closeBtn.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && openTray) close();
    });

    // The per-user live stream notifications.js already holds. Each tray
    // refetches its own count from here; B1 ships no counts of its own.
    document.addEventListener('helix:user-stream', function () {
        Object.keys(registry).forEach(function (name) {
            var entry = registry[name];
            if (entry && entry.onSignal) entry.onSignal();
        });
    });

    window.HelixTrays = {
        open: open,
        close: close,
        setUnread: setUnread,
        register: register,
        isOpen: function (name) { return name ? openTray === name : openTray !== null; },
        body: function () { return bodyEl; }
    };

    // Keep the dock clear of the page footer as it scrolls into view. Drives
    // one variable the panel and both toast stacks follow.
    var footer = document.querySelector('.footer');
    var BASE_OFFSET = 20;
    var offsetQueued = false;

    function applyDockOffset() {
        offsetQueued = false;
        var offset = BASE_OFFSET;
        if (footer) {
            var visible = window.innerHeight - footer.getBoundingClientRect().top;
            if (visible > 0) offset = BASE_OFFSET + visible;
        }
        document.documentElement.style.setProperty('--tray-dock-bottom', offset + 'px');
    }

    function queueDockOffset() {
        if (offsetQueued) return;
        offsetQueued = true;
        window.requestAnimationFrame(applyDockOffset);
    }

    window.addEventListener('scroll', queueDockOffset, { passive: true });
    window.addEventListener('resize', queueDockOffset);
    // Page swaps change the document height without a scroll event.
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(queueDockOffset).observe(document.body);
    }
    applyDockOffset();

    // Reopen whatever was open before a full page load.
    try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved && launchers[saved]) open(saved);
    } catch (e) {
        // Storage unavailable — start closed.
    }
})();
