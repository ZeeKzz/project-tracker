/* Jump to one project's row and flash it.

   The Dashboard's Urgent Actions link here with ?project=<id> — a missing
   value goes to the Table, a stuck invoice to Invoicing. Both tables carry
   data-project-id on their rows, so one file serves both.

   IIFE + direct init: the tag sits in the page's content block, so an SPA
   swap re-runs it and the link works whether the page was navigated to or
   loaded outright. */
(function () {
    var id = new URLSearchParams(window.location.search).get('project');
    if (!id) return;

    var SELECTOR = 'tr[data-project-id="' + id + '"]';
    var attempts = 0;

    /* The nearest ancestor that actually scrolls. Both tables sit in their
       own scroll box (.cs-table-scroll, .cs-inv-tablewrap), and scrolling it
       directly is exact — scrollIntoView also walks the page and can land
       short while the box is still being sized. */
    function scroller(el) {
        var node = el.parentElement;
        while (node && node !== document.body) {
            var overflowY = window.getComputedStyle(node).overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    function focus(row) {
        var box = scroller(row);
        if (box) {
            // Centre the row in the box without touching the horizontal
            // scroll — the finance table is usually scrolled sideways.
            var top = row.offsetTop - box.offsetTop - (box.clientHeight / 2) + (row.offsetHeight / 2);
            box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        } else {
            row.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        }
        row.classList.add('cs-focus-flash');
        setTimeout(function () { row.classList.remove('cs-focus-flash'); }, 2400);
    }

    /* The row may not be in the DOM yet on a full page load, and the box it
       lives in may not have its height until layout settles. Look a few
       times over a second, then give up quietly — the project simply may not
       be on this page (closed, cancelled, or filtered out). */
    function attempt() {
        var row = document.querySelector(SELECTOR);
        if (row) {
            requestAnimationFrame(function () { focus(row); });
            return;
        }
        if (++attempts < 12) { setTimeout(attempt, 100); }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attempt);
    } else {
        attempt();
    }
})();
