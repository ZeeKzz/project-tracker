// Client Servicing — SPA-ifies the module's OWN internal navigation.
//
// The global SPA nav (sidebar.js) only intercepts links carrying the
// `sidebar-item--nav` class (the main left sidebar). The CS module's own
// secondary sidebar (_sidebar.html — Dashboard / Table / Invoicing / Calendar)
// uses plain `.cs-nav-item` <a href> tags outside that system, so clicking
// between sections used to trigger a full page reload. This routes them
// through the same window.navigateTo() the rest of the app uses, with a
// full-reload fallback so navigation never breaks even if this loads before
// sidebar.js defines navigateTo. Same pattern as digital_innovation_nav.js.
//
// Document-level delegated listener, guarded so re-executing on every SPA
// swap (execScripts re-runs this script tag) never stacks a second listener.
// Included on all four CS screens.
(function () {
    if (window._csNavDispatcherWired) return;
    window._csNavDispatcherWired = true;

    document.addEventListener('click', function (e) {
        var item = e.target.closest('.cs-nav-item');
        if (!item) return;
        var url = item.getAttribute('href');
        if (!url) return;
        e.preventDefault();
        if (window.navigateTo) {
            window.navigateTo(url);
        } else {
            window.location.href = url;
        }
    });
})();
