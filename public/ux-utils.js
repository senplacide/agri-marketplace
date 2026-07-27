/* ux-utils.js - Shared UX utilities for AgriConnect */

var UX = (function () {
    'use strict';

    /* ===========================
       TOAST NOTIFICATIONS
       =========================== */
    var _toastContainer = null;

    function getToastContainer() {
        if (_toastContainer && _toastContainer.parentNode) return _toastContainer;
        _toastContainer = document.createElement('div');
        _toastContainer.className = 'ux-toast-container';
        _toastContainer.setAttribute('aria-live', 'polite');
        _toastContainer.setAttribute('role', 'status');
        document.body.appendChild(_toastContainer);
        return _toastContainer;
    }

    function toast(message, type) {
        type = type || 'info';
        var icons = { success: '\u2713', error: '\u2717', warning: '\u26A0', info: 'i' };
        var container = getToastContainer();
        var t = document.createElement('div');
        t.className = 'ux-toast ux-toast-' + type;
        t.setAttribute('role', 'alert');
        t.innerHTML = '<span class="ux-toast-icon">' + (icons[type] || 'i') + '</span><span>' + escapeHtml(message) + '</span>';
        container.appendChild(t);
        setTimeout(function () {
            t.classList.add('ux-toast-hide');
            setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
        }, 4000);
    }

    /* ===========================
       BUTTON LOADING
       =========================== */
    function btnLoading(btn, loadingText) {
        if (!btn) return function () {};
        var original = btn.innerHTML;
        var wasDisabled = btn.disabled;
        btn.disabled = true;
        btn.classList.add('btn-loading');
        btn.innerHTML = '<span class="ux-spinner"></span> ' + (loadingText || 'Processing...');
        return function restore() {
            btn.disabled = wasDisabled;
            btn.classList.remove('btn-loading');
            btn.innerHTML = original;
        };
    }

    /* ===========================
       PAGE LOADING INDICATOR
       =========================== */
    function pageLoading(container, message) {
        if (!container) return;
        container.innerHTML = '<div class="ux-page-loading"><div class="ux-spinner ux-spinner-page"></div><p>' + (message || 'Loading...') + '</p></div>';
    }

    /* ===========================
       EMPTY STATE
       =========================== */
    function emptyState(container, opts) {
        if (!container) return;
        opts = opts || {};
        var iconHtml = opts.icon
            ? '<div class="ux-empty-icon"><i class="fa-solid ' + opts.icon + '"></i></div>'
            : opts.emoji
            ? '<div class="ux-empty-icon"><span class="ux-empty-emoji">' + opts.emoji + '</span></div>'
            : '<div class="ux-empty-icon"><i class="fa-solid fa-inbox"></i></div>';
        var btnHtml = opts.btnText
            ? '<a href="' + (opts.btnHref || '#') + '" class="ux-empty-btn">' + (opts.btnIcon ? '<i class="fa-solid ' + opts.btnIcon + '"></i> ' : '') + escapeHtml(opts.btnText) + '</a>'
            : '';
        container.innerHTML = '<div class="ux-empty">' + iconHtml + '<h3>' + escapeHtml(opts.title || 'No data found') + '</h3><p>' + escapeHtml(opts.message || 'There is nothing to display here yet.') + '</p>' + btnHtml + '</div>';
    }

    /* ===========================
       FORM VALIDATION
       =========================== */
    function validateField(input, rules) {
        var val = input.value.trim();
        var group = input.closest('.public-form-group, .form-group');
        var existingError = group ? group.querySelector('.ux-error-msg') : null;
        if (existingError) existingError.remove();
        if (group) {
            group.classList.remove('ux-field-error', 'ux-field-success');
        }

        var error = null;
        if (rules.required && !val) {
            error = rules.requiredMsg || 'This field is required';
        } else if (rules.minLength && val.length < rules.minLength) {
            error = 'Must be at least ' + rules.minLength + ' characters';
        } else if (rules.maxLength && val.length > rules.maxLength) {
            error = 'Must be no more than ' + rules.maxLength + ' characters';
        } else if (rules.pattern && val && !rules.pattern.test(val)) {
            error = rules.patternMsg || 'Invalid format';
        } else if (rules.email && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            error = 'Please enter a valid email address';
        } else if (rules.min !== undefined && val && Number(val) < rules.min) {
            error = 'Minimum value is ' + rules.min;
        }

        if (error) {
            if (group) {
                group.classList.add('ux-field-error');
                var errEl = document.createElement('span');
                errEl.className = 'ux-error-msg';
                errEl.textContent = error;
                errEl.setAttribute('role', 'alert');
                input.setAttribute('aria-invalid', 'true');
                group.appendChild(errEl);
            }
            return error;
        } else {
            if (group && val) group.classList.add('ux-field-success');
            input.removeAttribute('aria-invalid');
            return null;
        }
    }

    function validateForm(form, fieldRules) {
        var firstError = null;
        for (var field in fieldRules) {
            var input = form.querySelector('[name="' + field + '"], #' + field);
            if (!input) continue;
            var err = validateField(input, fieldRules[field]);
            if (err && !firstError) {
                firstError = input;
            }
        }
        if (firstError) {
            firstError.focus();
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return !firstError;
    }

    /* ===========================
       ACCESSIBILITY HELPERS
       =========================== */
    function addAriaLabels() {
        document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])').forEach(function (btn) {
            var text = btn.textContent.trim();
            if (!text && btn.querySelector('i')) {
                var icon = btn.querySelector('i');
                var cls = icon.className;
                if (cls.includes('fa-bars')) btn.setAttribute('aria-label', 'Toggle menu');
                else if (cls.includes('fa-moon') || cls.includes('fa-sun')) btn.setAttribute('aria-label', 'Toggle dark mode');
                else if (cls.includes('fa-cart')) btn.setAttribute('aria-label', 'Shopping cart');
                else if (cls.includes('fa-bell')) btn.setAttribute('aria-label', 'Notifications');
                else if (cls.includes('fa-xmark') || cls.includes('fa-times')) btn.setAttribute('aria-label', 'Close');
                else if (cls.includes('fa-chevron-down')) btn.setAttribute('aria-label', 'Toggle dropdown');
                else if (cls.includes('fa-search')) btn.setAttribute('aria-label', 'Search');
                else btn.setAttribute('aria-label', 'Button');
            }
        });
    }

    function addMainLandmark() {
        if (!document.querySelector('main')) {
            var container = document.querySelector('.container, .od-container, .fo-container, .content, [class*="container"]');
            if (container) {
                container.setAttribute('role', 'main');
                container.setAttribute('aria-label', 'Main content');
            }
        }
    }

    function initSkipLink() {
        if (document.querySelector('.ux-skip-link')) return;
        var main = document.querySelector('[role="main"], main');
        if (!main) return;
        var skip = document.createElement('a');
        skip.href = '#';
        skip.className = 'ux-skip-link';
        skip.textContent = 'Skip to main content';
        skip.addEventListener('click', function (e) {
            e.preventDefault();
            main.setAttribute('tabindex', '-1');
            main.focus();
        });
        document.body.insertBefore(skip, document.body.firstChild);
    }

    /* ===========================
       KEYBOARD NAVIGATION
       =========================== */
    function initKeyboardNav() {
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                var modals = document.querySelectorAll('.modal.active, .pd-modal-overlay.active, .fo-confirm-overlay.active, .cart-drawer-overlay.active');
                modals.forEach(function (m) {
                    var closeBtn = m.querySelector('.modal-close, .pd-modal-close, .fo-confirm-btn-cancel, .cart-drawer-close');
                    if (closeBtn) closeBtn.click();
                });
            }
        });
    }

    /* ===========================
       UTILITY: escapeHtml
       =========================== */
    function escapeHtml(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ===========================
       INIT
       =========================== */
    function init() {
        addAriaLabels();
        addMainLandmark();
        initSkipLink();
        initKeyboardNav();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        toast: toast,
        btnLoading: btnLoading,
        pageLoading: pageLoading,
        emptyState: emptyState,
        validateField: validateField,
        validateForm: validateForm,
        escapeHtml: escapeHtml,
        addAriaLabels: addAriaLabels
    };
})();
