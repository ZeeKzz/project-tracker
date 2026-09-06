// Live refresh for the CS Dashboard. polling.js opens the /sse/dashboard
// doorbell when this page is showing and calls window.helixRefreshCSDashboard()
// on each ping — this file owns the "how": re-fetch the panels fragment and
// swap it in. IIFE with no DOMContentLoaded so it re-runs on SPA nav; the
// global is reassigned (never accumulated) and re-resolves its mount each call.
(function () {
    var PANELS_URL = '/client-servicing/dashboard-panels';

    window.helixRefreshCSDashboard = function () {
        fetch(PANELS_URL, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(function (r) { return r.ok ? r.text() : null; })
            .then(function (html) {
                if (html === null) return;
                var mount = document.getElementById('cs-dash-panels');
                if (mount) mount.innerHTML = html;
            })
            .catch(function () { /* network blip — skip; the next ping retries */ });
    };
})();
