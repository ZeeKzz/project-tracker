/* ── Blog JS ─────────────────────────────────────────────── */

// ── Post list: load post on click / hash on load ──────────
(function () {
    var contentArea = document.getElementById('blog-content-area');
    if (!contentArea) return; // not on blog index page

    function loadPost(postId, updateHash) {
        if (updateHash !== false) {
            window.location.hash = 'post-' + postId;
        }

        // Mark active in list
        document.querySelectorAll('.blog-post-item').forEach(function (el) {
            el.classList.toggle('active', el.dataset.postId === String(postId));
        });

        contentArea.innerHTML = '<div class="blog-placeholder"><p style="color:#bbb;font-size:0.9rem;">Loading...</p></div>';

        fetch('/blog/post/' + postId, { headers: { 'X-Nav-Request': '0' } })
            .then(function (r) { return r.text(); })
            .then(function (html) {
                contentArea.innerHTML = html;
                initPostContent(postId);
            })
            .catch(function () {
                contentArea.innerHTML = '<div class="blog-placeholder"><p style="color:var(--rose);">Failed to load post.</p></div>';
            });
    }

    // Click on post list item
    document.getElementById('blog-post-list').addEventListener('click', function (e) {
        var item = e.target.closest('.blog-post-item');
        if (!item) return;
        e.preventDefault();
        loadPost(item.dataset.postId);
    });

    // Load from hash on page load
    var hash = window.location.hash;
    if (hash && hash.startsWith('#post-')) {
        loadPost(hash.replace('#post-', ''));
    }
}());

// ── Post content: scrollspy, comments, admin buttons ─────
function initPostContent(postId) {

    // Scrollspy
    var scrollArea = document.getElementById('blog-scroll-area');
    var navItems = document.querySelectorAll('.blog-nav-item');
    var sections = document.querySelectorAll('.blog-section');

    if (scrollArea && sections.length) {
        function getActive() {
            var containerTop = scrollArea.getBoundingClientRect().top;
            var active = sections[0];
            sections.forEach(function (s) {
                if (s.getBoundingClientRect().top - containerTop <= 60) active = s;
            });
            return active.id;
        }

        function updateNav() {
            var id = getActive();
            navItems.forEach(function (item) {
                item.classList.toggle('active', item.dataset.target === id);
            });
        }

        scrollArea.addEventListener('scroll', updateNav);
        updateNav();

        navItems.forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.preventDefault();
                var target = document.getElementById(item.dataset.target);
                if (target) {
                    var containerTop = scrollArea.getBoundingClientRect().top;
                    var targetTop = target.getBoundingClientRect().top - containerTop;
                    scrollArea.scrollBy({ top: targetTop - 24, behavior: 'smooth' });
                }
            });
        });
    }

    // Publish toggle
    var publishBtn = document.querySelector('.blog-publish-btn');
    if (publishBtn) {
        publishBtn.addEventListener('click', function () {
            fetch('/blog/posts/' + postId + '/publish', { method: 'POST' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) {
                        publishBtn.textContent = data.is_published ? 'Unpublish' : 'Publish';
                        publishBtn.dataset.published = data.is_published;
                    }
                });
        });
    }

    // Delete post
    var deletePostBtn = document.querySelector('.blog-delete-post-btn');
    if (deletePostBtn) {
        deletePostBtn.addEventListener('click', function () {
            if (!confirm('Delete this post? This cannot be undone.')) return;
            fetch('/blog/posts/' + postId, { method: 'DELETE' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) window.location.href = '/blog';
                });
        });
    }

    // Delete comment
    document.getElementById('blog-comments').addEventListener('click', function (e) {
        var btn = e.target.closest('.blog-comment-delete');
        if (!btn) return;
        if (!confirm('Delete this comment?')) return;
        var commentId = btn.dataset.commentId;
        fetch('/blog/comments/' + commentId, { method: 'DELETE' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    document.getElementById('comment-' + commentId).remove();
                }
            });
    });

    // Post comment
    var commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var body = commentForm.querySelector('textarea[name="body"]');
            var btn = commentForm.querySelector('button[type="submit"]');
            var formData = new FormData();
            formData.append('body', body.value.trim());

            btn.disabled = true;
            btn.textContent = 'Posting...';

            fetch('/blog/post/' + postId + '/comments', {
                method: 'POST',
                body: formData
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) {
                        var c = data.comment;
                        var noComments = document.querySelector('.blog-no-comments');
                        if (noComments) noComments.remove();

                        var div = document.createElement('div');
                        div.className = 'blog-comment';
                        div.id = 'comment-' + c.id;
                        div.innerHTML =
                            '<div class="blog-comment-meta">' +
                            '<strong>' + c.author + '</strong>' +
                            '<span>' + c.created_at + '</span>' +
                            '</div>' +
                            '<p class="blog-comment-body">' + c.body + '</p>';
                        document.getElementById('comments-list').appendChild(div);
                        body.value = '';
                    }
                    btn.disabled = false;
                    btn.textContent = 'Post Comment';
                })
                .catch(function () {
                    btn.disabled = false;
                    btn.textContent = 'Post Comment';
                });
        });
    }
}

// ── Editor ───────────────────────────────────────────────
(function () {
    var sectionsContainer = document.getElementById('sections-container');
    if (!sectionsContainer) return; // not on editor page

    var sections = [];

    // Parse existing post data if editing
    try {
        var raw = typeof EDIT_POST_DATA === 'string' ? JSON.parse(EDIT_POST_DATA) : EDIT_POST_DATA;
        sections = Array.isArray(raw) ? raw : [];
    } catch (e) { sections = []; }

    // ── Render ──────────────────────────────────────────
    function render() {
        sectionsContainer.innerHTML = '';
        sections.forEach(function (section, si) {
            var div = document.createElement('div');
            div.className = 'blog-editor-section';
            div.dataset.index = si;

            var blocksHtml = section.blocks.map(function (block, bi) {
                return renderBlock(block, si, bi);
            }).join('');

            div.innerHTML =
                '<div class="blog-editor-section-header">' +
                '<span class="blog-editor-section-num">' + section.number + '</span>' +
                '<input type="text" value="' + escAttr(section.title) + '" ' +
                'placeholder="Section title" data-si="' + si + '" class="section-title-input">' +
                '<button class="blog-block-btn blog-block-btn--danger section-delete-btn" data-si="' + si + '">✕</button>' +
                '</div>' +
                '<div class="blog-editor-section-body" id="section-body-' + si + '">' +
                blocksHtml +
                '</div>' +
                '<div class="blog-section-actions">' +
                '<button class="blog-block-btn add-block-btn" data-si="' + si + '">+ Add Block</button>' +
                (si > 0 ? '<button class="blog-block-btn section-up-btn" data-si="' + si + '">↑ Move Up</button>' : '') +
                (si < sections.length - 1 ? '<button class="blog-block-btn section-down-btn" data-si="' + si + '">↓ Move Down</button>' : '') +
                '</div>';

            sectionsContainer.appendChild(div);
        });
    }

    function renderBlock(block, si, bi) {
        var label = { body: 'Paragraph', callout: 'Callout', 'callout-pine': 'Callout (green)', h3: 'Sub-heading', list: 'List' }[block.type] || block.type;
        var inputHtml = '';

        if (block.type === 'list') {
            inputHtml = '<textarea rows="4" data-si="' + si + '" data-bi="' + bi + '" ' +
                'class="block-input" placeholder="One item per line">' +
                escText((block.items || []).join('\n')) + '</textarea>';
        } else {
            inputHtml = '<textarea rows="3" data-si="' + si + '" data-bi="' + bi + '" ' +
                'class="block-input" placeholder="' + label + '...">' +
                escText(block.text || '') + '</textarea>';
        }

        return '<div class="blog-editor-block" data-si="' + si + '" data-bi="' + bi + '">' +
            '<div class="blog-editor-block-type">' + label + '</div>' +
            inputHtml +
            '<div class="blog-editor-block-actions">' +
            (bi > 0 ? '<button class="blog-block-btn block-up-btn" data-si="' + si + '" data-bi="' + bi + '">↑</button>' : '') +
            (bi < sections[si].blocks.length - 1 ? '<button class="blog-block-btn block-down-btn" data-si="' + si + '" data-bi="' + bi + '">↓</button>' : '') +
            '<button class="blog-block-btn blog-block-btn--danger block-delete-btn" data-si="' + si + '" data-bi="' + bi + '">Remove</button>' +
            '</div>' +
            '</div>';
    }

    // ── Block type picker ────────────────────────────────
    var menu = document.getElementById('block-type-menu');
    var activeSi = null;

    sectionsContainer.addEventListener('click', function (e) {
        // Add block
        var addBtn = e.target.closest('.add-block-btn');
        if (addBtn) {
            activeSi = parseInt(addBtn.dataset.si);
            var rect = addBtn.getBoundingClientRect();
            menu.style.top = (rect.bottom + 6) + 'px';
            menu.style.left = rect.left + 'px';
            menu.style.display = 'flex';
            return;
        }

        // Delete section
        var delSec = e.target.closest('.section-delete-btn');
        if (delSec) {
            if (!confirm('Remove this section?')) return;
            sections.splice(parseInt(delSec.dataset.si), 1);
            renumber();
            render();
            return;
        }

        // Move section up
        var upSec = e.target.closest('.section-up-btn');
        if (upSec) {
            var i = parseInt(upSec.dataset.si);
            var tmp = sections[i]; sections[i] = sections[i - 1]; sections[i - 1] = tmp;
            render(); return;
        }

        // Move section down
        var downSec = e.target.closest('.section-down-btn');
        if (downSec) {
            var i = parseInt(downSec.dataset.si);
            var tmp = sections[i]; sections[i] = sections[i + 1]; sections[i + 1] = tmp;
            render(); return;
        }

        // Delete block
        var delBlock = e.target.closest('.block-delete-btn');
        if (delBlock) {
            var si = parseInt(delBlock.dataset.si), bi = parseInt(delBlock.dataset.bi);
            sections[si].blocks.splice(bi, 1);
            render(); return;
        }

        // Move block up
        var upBlock = e.target.closest('.block-up-btn');
        if (upBlock) {
            var si = parseInt(upBlock.dataset.si), bi = parseInt(upBlock.dataset.bi);
            var tmp = sections[si].blocks[bi]; sections[si].blocks[bi] = sections[si].blocks[bi - 1]; sections[si].blocks[bi - 1] = tmp;
            render(); return;
        }

        // Move block down
        var downBlock = e.target.closest('.block-down-btn');
        if (downBlock) {
            var si = parseInt(downBlock.dataset.si), bi = parseInt(downBlock.dataset.bi);
            var tmp = sections[si].blocks[bi]; sections[si].blocks[bi] = sections[si].blocks[bi + 1]; sections[si].blocks[bi + 1] = tmp;
            render(); return;
        }
    });

    // Block type menu selection
    menu.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn || activeSi === null) return;
        var type = btn.dataset.type;
        var block = type === 'list'
            ? { type: 'list', items: [] }
            : { type: type.replace('-pine', ''), text: '', color: type === 'callout-pine' ? 'pine' : undefined };
        if (type === 'callout-pine') block.type = 'callout';
        sections[activeSi].blocks.push(block);
        menu.style.display = 'none';
        activeSi = null;
        render();
    });

    document.addEventListener('click', function (e) {
        if (!menu.contains(e.target) && !e.target.closest('.add-block-btn')) {
            menu.style.display = 'none';
        }
    });

    // ── Section title edits (live sync) ─────────────────
    sectionsContainer.addEventListener('input', function (e) {
        if (e.target.classList.contains('section-title-input')) {
            var si = parseInt(e.target.dataset.si);
            sections[si].title = e.target.value;
            sections[si].anchor = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }
        if (e.target.classList.contains('block-input')) {
            var si = parseInt(e.target.dataset.si), bi = parseInt(e.target.dataset.bi);
            if (sections[si].blocks[bi].type === 'list') {
                sections[si].blocks[bi].items = e.target.value.split('\n').filter(function (l) { return l.trim(); });
            } else {
                sections[si].blocks[bi].text = e.target.value;
            }
        }
    });

    // ── Add section ──────────────────────────────────────
    document.getElementById('add-section-btn').addEventListener('click', function () {
        sections.push({ anchor: 'section-' + (sections.length + 1), number: '', title: '', blocks: [] });
        renumber();
        render();
        sectionsContainer.lastElementChild.querySelector('.section-title-input').focus();
    });

    function renumber() {
        sections.forEach(function (s, i) {
            s.number = String(i + 1).padStart(2, '0');
        });
    }

    // ── Collect & save ───────────────────────────────────
    function collectData() {
        return {
            title: document.getElementById('post-title').value.trim(),
            version_tag: document.getElementById('post-version-tag').value.trim(),
            sections: sections
        };
    }

    function save(andPublish) {
        var data = collectData();
        if (!data.title) { alert('Please add a post title.'); return; }

        var isEdit = typeof EDIT_POST_ID === 'number';
        var url = isEdit ? '/blog/posts/' + EDIT_POST_ID : '/blog/posts';
        var method = isEdit ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.success) { alert('Save failed.'); return; }
                var postId = isEdit ? EDIT_POST_ID : res.post_id;
                if (andPublish) {
                    fetch('/blog/posts/' + postId + '/publish', { method: 'POST' })
                        .then(function () { window.location.href = '/blog#post-' + postId; });
                } else {
                    window.location.href = '/blog#post-' + postId;
                }
            });
    }

    document.getElementById('save-draft-btn').addEventListener('click', function () { save(false); });
    document.getElementById('save-publish-btn').addEventListener('click', function () { save(true); });

    // ── Helpers ──────────────────────────────────────────
    function escAttr(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    function escText(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }

    // Initial render
    renumber();
    render();
}());

