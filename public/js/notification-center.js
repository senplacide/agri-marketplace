/* ═══════════════════════════════════════════════════════════════
   AgriConnect Notification Center
   Shared module for Buyer, Farmer, and Admin dashboards.
   Fetches from /api/notifications backend, with localStorage fallback.
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var STORAGE_KEY = 'agri_notifications';
    var API_BASE = '/api/notifications';
    var POLL_INTERVAL = 30000;
    var pollTimer = null;

    /* ── Notification type → icon + label mapping ── */
    var TYPE_MAP = {
        buyer: {
            order_submitted:     { icon: 'fa-solid fa-receipt',            color: '#1976d2' },
            order_accepted:      { icon: 'fa-solid fa-circle-check',       color: '#2e7d32' },
            order_rejected:      { icon: 'fa-solid fa-circle-xmark',       color: '#e53e3e' },
            payment_received:    { icon: 'fa-solid fa-credit-card',        color: '#1976d2' },
            order_completed:     { icon: 'fa-solid fa-circle-check',       color: '#2e7d32' },
            order_delivered:     { icon: 'fa-solid fa-truck-fast',         color: '#16a34a' }
        },
        farmer: {
            new_order:         { icon: 'fa-solid fa-cart-plus',           color: '#2e7d32' },
            new_order_received: { icon: 'fa-solid fa-cart-plus',          color: '#2e7d32' },
            product_approved:   { icon: 'fa-solid fa-circle-check',        color: '#2e7d32' },
            product_rejected:  { icon: 'fa-solid fa-circle-xmark',         color: '#e53e3e' },
            low_stock:         { icon: 'fa-solid fa-triangle-exclamation', color: '#e67e22' },
            out_of_stock:      { icon: 'fa-solid fa-circle-xmark',         color: '#d32f2f' }
        },
        admin: {
            new_user_registered:   { icon: 'fa-solid fa-user-plus',        color: '#2e7d32' },
            new_product_submitted: { icon: 'fa-solid fa-box-open',         color: '#1976d2' },
            new_order_created:     { icon: 'fa-solid fa-receipt',          color: '#2e7d32' }
        }
    };

    /* ── Helpers ── */
    function getNotifications() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) { return []; }
    }

    function saveNotifications(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function getToken() {
        return localStorage.getItem('token');
    }

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function timeAgo(ts) {
        var diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60)   return 'Just now';
        if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        var d = new Date(ts);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function escHtml(str) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(str || ''));
        return d.innerHTML;
    }

    /* ── Detect current role from page ── */
    function detectRole() {
        if (document.getElementById('adminNav') || document.querySelector('nav.admin-nav')) return 'admin';
        if (document.getElementById('farmerNav') || document.querySelector('nav.farmer-nav')) return 'farmer';
        if (document.getElementById('buyerNav') || document.querySelector('nav.buyer-nav')) return 'buyer';
        return 'buyer';
    }

    /* ── Green variable per dashboard ── */
    function greenVar(role) {
        if (role === 'admin') return 'var(--admin-green, #2e7d32)';
        if (role === 'farmer') return 'var(--fd-green, #2e7d32)';
        return 'var(--bd-green, #2e7d32)';
    }

    function greenDarkVar(role) {
        if (role === 'admin') return 'var(--admin-green-dark, #1b5e20)';
        if (role === 'farmer') return 'var(--fd-green-dark, #1b5e20)';
        return 'var(--bd-green-dark, #1b5e20)';
    }

    /* ═══════════════════════════════════════════
       BACKEND API
       ═══════════════════════════════════════════ */
    async function fetchFromBackend() {
        var token = getToken();
        if (!token) return null;
        try {
            var res = await fetch(API_BASE, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return null;
            var json = await res.json();
            if (!json.success || !Array.isArray(json.data)) return null;
            return json;
        } catch (e) {
            return null;
        }
    }

    async function markReadBackend(id) {
        var token = getToken();
        if (!token) return;
        try {
            await fetch(API_BASE + '/' + id + '/read', {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        } catch (e) { /* ignore */ }
    }

    async function markAllReadBackend() {
        var token = getToken();
        if (!token) return;
        try {
            await fetch(API_BASE + '/read-all', {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        } catch (e) { /* ignore */ }
    }

    async function syncFromBackend() {
        var result = await fetchFromBackend();
        if (!result) return;

        var role = detectRole();
        var backendNotifs = result.data.map(function (n) {
            return {
                id: n._id,
                role: role,
                type: n.type,
                title: n.title,
                description: n.message,
                timestamp: new Date(n.createdAt).getTime(),
                read: n.read,
                _fromBackend: true
            };
        });

        var local = getNotifications().filter(function (n) { return !n._fromBackend; });
        var merged = backendNotifs.concat(local);
        merged.sort(function (a, b) { return b.timestamp - a.timestamp; });

        saveNotifications(merged);
        updateBadge(role);
        renderList(merged, role);
    }

    /* ═══════════════════════════════════════════
       INJECT STYLES
       ═══════════════════════════════════════════ */
    function injectStyles(role) {
        if (document.getElementById('nc-styles')) return;

        var gv = greenVar(role);
        var style = document.createElement('style');
        style.id = 'nc-styles';
        style.textContent = [
            /* ── Bell button ── */
            '.nc-bell-btn{background:rgba(255,255,255,.12);color:white;border:1.5px solid rgba(255,255,255,.25);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;transition:all .2s ease;position:relative;flex-shrink:0;outline:none}',
            '.nc-bell-btn:hover{background:rgba(255,255,255,.25);transform:translateY(-1px)}',
            '.nc-bell-btn .nc-badge{position:absolute;top:-5px;right:-5px;background:#e53e3e;color:white;font-size:.62rem;font-weight:700;min-width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid ' + gv + ';line-height:1;pointer-events:none;transition:transform .2s ease}',
            '.nc-bell-btn .nc-badge.nc-bump{animation:ncBump .3s ease}',
            '@keyframes ncBump{0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}}',
            '.nc-bell-btn .nc-badge:empty,.nc-bell-btn .nc-badge[data-count="0"]{display:none}',

            /* ── Panel overlay ── */
            '.nc-overlay{position:fixed;inset:0;z-index:10002;opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease}',
            '.nc-overlay.nc-open{opacity:1;visibility:visible}',

            /* ── Panel ── */
            '.nc-panel{position:fixed;top:0;right:0;width:400px;max-width:100vw;height:100vh;background:var(--bd-surface, var(--fd-surface, var(--admin-surface, #fff)));box-shadow:-4px 0 24px rgba(0,0,0,.12);z-index:10003;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1)}',
            '.nc-overlay.nc-open .nc-panel{transform:translateX(0)}',

            /* ── Panel header ── */
            '.nc-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--bd-border, var(--fd-border, var(--admin-border, #e2e8f0)));flex-shrink:0}',
            '.nc-header-left{display:flex;align-items:center;gap:10px}',
            '.nc-header-left i{color:' + gv + ';font-size:1.15rem}',
            '.nc-header-left h3{margin:0;font-size:1.05rem;font-weight:700;color:var(--bd-text, var(--fd-text, var(--admin-text, #1a202c)))}',
            '.nc-header-actions{display:flex;gap:8px}',
            '.nc-header-actions button{background:none;border:none;color:' + gv + ';font-size:.78rem;font-weight:600;cursor:pointer;padding:6px 10px;border-radius:8px;transition:all .2s ease}',
            '.nc-header-actions button:hover{background:' + gv + ';color:white}',
            '.nc-header-actions button:disabled{opacity:.4;cursor:default;background:none;color:' + gv + '}',
            '.nc-close-btn{background:none;border:none;font-size:1.3rem;color:var(--bd-text-muted, var(--fd-text-muted, var(--admin-text-muted, #64748b)));cursor:pointer;padding:4px 8px;border-radius:8px;transition:all .2s ease;line-height:1}',
            '.nc-close-btn:hover{background:rgba(0,0,0,.06);color:var(--bd-text, var(--fd-text, var(--admin-text, #1a202c)))}',

            /* ── Notification list ── */
            '.nc-list{flex:1;overflow-y:auto;padding:4px 0}',
            '.nc-list::-webkit-scrollbar{width:5px}',
            '.nc-list::-webkit-scrollbar-track{background:transparent}',
            '.nc-list::-webkit-scrollbar-thumb{background:' + gv + ';border-radius:10px}',

            /* ── Single notification ── */
            '.nc-item{display:flex;align-items:flex-start;gap:12px;padding:14px 20px;border-bottom:1px solid var(--bd-border, var(--fd-border, var(--admin-border, #e2e8f0)));cursor:pointer;transition:background .2s ease;border-left:3px solid transparent;position:relative}',
            '.nc-item:hover{background:var(--bd-bg, var(--fd-bg, var(--admin-bg, #f0f2f5)))}',
            '.nc-item.nc-unread{background:rgba(46,125,50,.04);border-left-color:' + gv + ';font-weight:600}',
            '.nc-item.nc-unread:hover{background:rgba(46,125,50,.08)}',
            '.nc-item-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0;margin-top:2px}',
            '.nc-item-body{flex:1;min-width:0}',
            '.nc-item-title{margin:0 0 3px;font-size:.88rem;font-weight:600;color:var(--bd-text, var(--fd-text, var(--admin-text, #1a202c)))}',
            '.nc-item.nc-unread .nc-item-title{font-weight:700}',
            '.nc-item-desc{margin:0 0 5px;font-size:.78rem;color:var(--bd-text-muted, var(--fd-text-muted, var(--admin-text-muted, #64748b)));line-height:1.4}',
            '.nc-item-time{font-size:.68rem;color:var(--bd-text-muted, var(--fd-text-muted, var(--admin-text-muted, #94a3b8)))}',
            '.nc-item-dot{width:8px;height:8px;border-radius:50%;background:' + gv + ';flex-shrink:0;margin-top:8px;transition:opacity .2s ease}',
            '.nc-item.nc-read .nc-item-dot{opacity:0}',

            /* ── Empty state ── */
            '.nc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 20px;text-align:center;color:var(--bd-text-muted, var(--fd-text-muted, var(--admin-text-muted, #64748b)))}',
            '.nc-empty i{font-size:3rem;margin-bottom:16px;opacity:.3;color:' + gv + '}',
            '.nc-empty p{margin:0;font-size:.95rem;font-weight:500}',

            /* ── Responsive: tablet ── */
            '@media(max-width:1024px){.nc-panel{width:360px}}',

            /* ── Responsive: mobile ── */
            '@media(max-width:767px){',
            '  .nc-panel{width:100vw}',
            '  .nc-bell-btn{width:100%;height:42px;border-radius:10px;justify-content:flex-start;padding:0 12px;gap:8px;font-size:.88rem}',
            '}'

        ].join('\n');
        document.head.appendChild(style);
    }

    /* ═══════════════════════════════════════════
       BUILD NOTIFICATION HTML
       ═══════════════════════════════════════════ */
    function buildBell() {
        var btn = document.createElement('button');
        btn.className = 'nc-bell-btn';
        btn.id = 'ncBellBtn';
        btn.setAttribute('aria-label', 'Notifications');
        btn.setAttribute('title', 'Notifications');
        btn.innerHTML = '<i class="fa-solid fa-bell"></i><span class="nc-badge" id="ncBadge"></span>';
        return btn;
    }

    function buildPanel() {
        var overlay = document.createElement('div');
        overlay.className = 'nc-overlay';
        overlay.id = 'ncOverlay';
        overlay.innerHTML =
            '<div class="nc-panel" id="ncPanel">' +
                '<div class="nc-header">' +
                    '<div class="nc-header-left">' +
                        '<i class="fa-solid fa-bell"></i>' +
                        '<h3>Notifications</h3>' +
                    '</div>' +
                    '<div class="nc-header-actions">' +
                        '<button id="ncMarkAllBtn" title="Mark all as read">Mark all read</button>' +
                        '<button class="nc-close-btn" id="ncCloseBtn" aria-label="Close notifications">&times;</button>' +
                    '</div>' +
                '</div>' +
                '<div class="nc-list" id="ncList"></div>' +
            '</div>';
        return overlay;
    }

    function renderList(list, role) {
        var container = document.getElementById('ncList');
        if (!container) return;

        var filtered = list.filter(function (n) { return n.role === role; });
        filtered.sort(function (a, b) { return b.timestamp - a.timestamp; });

        if (filtered.length === 0) {
            container.innerHTML =
                '<div class="nc-empty">' +
                    '<i class="fa-solid fa-bell-slash"></i>' +
                    '<p>No notifications yet.</p>' +
                '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            var n = filtered[i];
            var meta = (TYPE_MAP[role] && TYPE_MAP[role][n.type]) || { icon: 'fa-solid fa-bell', color: '#64748b' };
            var readClass = n.read ? 'nc-read' : 'nc-unread';
            html +=
                '<div class="nc-item ' + readClass + '" data-id="' + n.id + '" role="button" tabindex="0">' +
                    '<div class="nc-item-icon" style="background:' + meta.color + '15;color:' + meta.color + '">' +
                        '<i class="' + meta.icon + '"></i>' +
                    '</div>' +
                    '<div class="nc-item-body">' +
                        '<p class="nc-item-title">' + escHtml(n.title) + '</p>' +
                        '<p class="nc-item-desc">' + escHtml(n.description) + '</p>' +
                        '<span class="nc-item-time">' + timeAgo(n.timestamp) + '</span>' +
                    '</div>' +
                    '<div class="nc-item-dot"></div>' +
                '</div>';
        }
        container.innerHTML = html;
    }

    function updateBadge(role) {
        var list = getNotifications();
        var unread = list.filter(function (n) { return n.role === role && !n.read; }).length;
        var badge = document.getElementById('ncBadge');
        if (!badge) return;
        badge.textContent = unread > 0 ? (unread > 99 ? '99+' : unread) : '';
        badge.setAttribute('data-count', unread);
        badge.classList.remove('nc-bump');
        void badge.offsetWidth;
        badge.classList.add('nc-bump');
    }

    /* ═══════════════════════════════════════════
       PUBLIC API (for other scripts / future backend)
       ═══════════════════════════════════════════ */
    window.AgriNotifications = {
        add: function (opts) {
            var n = {
                id: uid(),
                role: opts.role || 'buyer',
                type: opts.type || 'order_accepted',
                title: opts.title || 'Notification',
                description: opts.description || '',
                timestamp: opts.timestamp || Date.now(),
                read: false
            };
            var list = getNotifications();
            list.push(n);
            saveNotifications(list);
            updateBadge(n.role);
        },
        getUnreadCount: function (role) {
            return getNotifications().filter(function (n) { return n.role === role && !n.read; }).length;
        },
        markRead: function (id) {
            var list = getNotifications();
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === id) { list[i].read = true; break; }
            }
            saveNotifications(list);
            if (list[i] && list[i]._fromBackend) {
                markReadBackend(id);
            }
        },
        markAllRead: function (role) {
            var list = getNotifications();
            for (var i = 0; i < list.length; i++) {
                if (list[i].role === role) list[i].read = true;
            }
            saveNotifications(list);
            markAllReadBackend();
        },
        clear: function (role) {
            var list = getNotifications().filter(function (n) { return n.role !== role; });
            saveNotifications(list);
        },
        getAll: function (role) {
            return getNotifications().filter(function (n) { return n.role === role; });
        },
        refresh: function () {
            syncFromBackend();
        }
    };

    /* ═══════════════════════════════════════════
       INIT
       ═══════════════════════════════════════════ */
    function init() {
        var role = detectRole();
        injectStyles(role);

        /* Find insertion point */
        var navRight = document.getElementById('navRight');
        var headerActions = document.querySelector('.header-actions');
        var insertTarget = navRight || headerActions;
        if (!insertTarget) return;

        var bell = buildBell();
        var overlay = buildPanel();

        /* Insert bell before profile dropdown, dark mode toggle, or logout */
        var profileDD = insertTarget.querySelector('#profileDropdown');
        var darkBtn = insertTarget.querySelector('#darkModeToggle');
        var logoutBtn = insertTarget.querySelector('#logoutBtn');
        if (profileDD) {
            insertTarget.insertBefore(bell, profileDD);
        } else if (darkBtn) {
            insertTarget.insertBefore(bell, darkBtn);
        } else if (logoutBtn) {
            insertTarget.insertBefore(bell, logoutBtn);
        } else {
            insertTarget.appendChild(bell);
        }

        document.body.appendChild(overlay);

        /* Sync from backend on init */
        syncFromBackend().then(function () {
            updateBadge(role);
            renderList(getNotifications(), role);
        });

        /* ── Polling for updates ── */
        pollTimer = setInterval(function () {
            syncFromBackend();
        }, POLL_INTERVAL);

        /* ── Event: open panel ── */
        bell.addEventListener('click', function (e) {
            e.stopPropagation();
            overlay.classList.add('nc-open');
            syncFromBackend().then(function () {
                renderList(getNotifications(), role);
                updateBadge(role);
            });
        });

        /* ── Event: close panel ── */
        var closeBtn = document.getElementById('ncCloseBtn');
        function closePanel() { overlay.classList.remove('nc-open'); }
        closeBtn.addEventListener('click', closePanel);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closePanel();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('nc-open')) closePanel();
        });

        /* ── Event: mark single as read ── */
        var listEl = document.getElementById('ncList');
        listEl.addEventListener('click', function (e) {
            var item = e.target.closest('.nc-item');
            if (!item) return;
            var id = item.getAttribute('data-id');
            window.AgriNotifications.markRead(id);
            renderList(getNotifications(), role);
            updateBadge(role);
        });
        listEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                var item = e.target.closest('.nc-item');
                if (!item) return;
                e.preventDefault();
                var id = item.getAttribute('data-id');
                window.AgriNotifications.markRead(id);
                renderList(getNotifications(), role);
                updateBadge(role);
            }
        });

        /* ── Event: mark all as read ── */
        var markAllBtn = document.getElementById('ncMarkAllBtn');
        markAllBtn.addEventListener('click', function () {
            window.AgriNotifications.markAllRead(role);
            renderList(getNotifications(), role);
            updateBadge(role);
        });

        /* ── Update mark-all button disabled state ── */
        function updateMarkAllBtn() {
            var unread = window.AgriNotifications.getUnreadCount(role);
            markAllBtn.disabled = unread === 0;
        }
        updateMarkAllBtn();
        var observer = new MutationObserver(updateMarkAllBtn);
        observer.observe(listEl, { childList: true });
    }

    /* Start when DOM is ready */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
