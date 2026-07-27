(function () {
    'use strict';

    // =====================================
    // STATE
    // =====================================
    var token = localStorage.getItem('token');
    if (!token) { location.href = '/auth'; return; }

    var user = null;
    var avatarFile = null;

    // =====================================
    // DOM REFERENCES
    // =====================================
    var dom = {
        navHamburger: document.getElementById('navHamburger'),
        navCenter: document.getElementById('navCenter'),
        navRight: document.getElementById('navRight'),
        darkModeToggle: document.getElementById('darkModeToggle'),
        logoutBtn: document.getElementById('logoutBtn'),
        navDashboardLink: document.querySelector('.nav-dashboard-link'),

        profileAvatar: document.getElementById('profileAvatar'),
        profileName: document.getElementById('profileName'),
        profileEmail: document.getElementById('profileEmail'),
        profileBadges: document.getElementById('profileBadges'),
        avatarFileInput: document.getElementById('avatarFileInput'),

        infoName: document.getElementById('infoName'),
        infoEmail: document.getElementById('infoEmail'),
        infoPhone: document.getElementById('infoPhone'),
        infoAddress: document.getElementById('infoAddress'),
        infoRole: document.getElementById('infoRole'),
        infoStatus: document.getElementById('infoStatus'),
        infoJoined: document.getElementById('infoJoined'),
        infoLastLogin: document.getElementById('infoLastLogin'),

        editProfileForm: document.getElementById('editProfileForm'),
        editName: document.getElementById('editName'),
        editEmail: document.getElementById('editEmail'),
        editPhone: document.getElementById('editPhone'),
        editAddress: document.getElementById('editAddress'),
        editBio: document.getElementById('editBio'),
        bioCharCount: document.getElementById('bioCharCount'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),

        avatarDropZone: document.getElementById('avatarDropZone'),
        avatarPreviewContainer: document.getElementById('avatarPreviewContainer'),
        avatarPreviewImg: document.getElementById('avatarPreviewImg'),
        avatarPreviewName: document.getElementById('avatarPreviewName'),
        avatarPreviewSize: document.getElementById('avatarPreviewSize'),
        avatarRemoveBtn: document.getElementById('avatarRemoveBtn'),
        avatarUploadActions: document.getElementById('avatarUploadActions'),
        avatarCancelBtn: document.getElementById('avatarCancelBtn'),
        avatarSaveBtn: document.getElementById('avatarSaveBtn'),

        infoLastPasswordChange: document.getElementById('infoLastPasswordChange'),
        infoLastLoginSec: document.getElementById('infoLastLoginSec'),
        infoRoleSec: document.getElementById('infoRoleSec'),
        infoStatusSec: document.getElementById('infoStatusSec'),
        changePasswordBtn: document.getElementById('changePasswordBtn'),

        passwordModal: document.getElementById('passwordModal'),
        passwordModalClose: document.getElementById('passwordModalClose'),
        passwordModalCancel: document.getElementById('passwordModalCancel'),
        passwordModalSave: document.getElementById('passwordModalSave'),
        changePasswordForm: document.getElementById('changePasswordForm'),
        currentPassword: document.getElementById('currentPassword'),
        newPassword: document.getElementById('newPassword'),
        confirmPassword: document.getElementById('confirmPassword'),
        passwordStrength: document.getElementById('passwordStrength'),
        str1: document.getElementById('str1'),
        str2: document.getElementById('str2'),
        str3: document.getElementById('str3'),
        str4: document.getElementById('str4'),
        reqLength: document.getElementById('reqLength'),
        reqUpper: document.getElementById('reqUpper'),
        reqLower: document.getElementById('reqLower'),
        reqNumber: document.getElementById('reqNumber'),
        reqSpecial: document.getElementById('reqSpecial'),

        businessCard: document.getElementById('businessCard'),
        businessForm: document.getElementById('businessForm'),
        editBusinessName: document.getElementById('editBusinessName'),
        editCountry: document.getElementById('editCountry'),
        editCity: document.getElementById('editCity'),
        editPayoutMethod: document.getElementById('editPayoutMethod'),
        editBankName: document.getElementById('editBankName'),
        editBankAccountName: document.getElementById('editBankAccountName'),
        editBankAccountNumber: document.getElementById('editBankAccountNumber'),
        editMomoNumber: document.getElementById('editMomoNumber'),
        bankFields: document.getElementById('bankFields'),
        momoFields: document.getElementById('momoFields'),
        cancelBusinessBtn: document.getElementById('cancelBusinessBtn'),
        saveBusinessBtn: document.getElementById('saveBusinessBtn')
    };

    // =====================================
    // TOAST
    // =====================================
    function showToast(message, type) {
        type = type || 'info';
        var icons = { success: '\u2713', error: '\u2717', warning: '\u26A0', info: 'i' };
        var container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'i') + '</span><span>' + escapeHtml(message) + '</span>';
        container.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('toast-hide');
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        }, 3500);
    }

    function escapeHtml(text) {
        var d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    // =====================================
    // PAYOUT METHOD TOGGLE
    // =====================================
    function togglePayoutFields() {
        var val = dom.editPayoutMethod ? dom.editPayoutMethod.value : 'none';
        if (dom.bankFields) dom.bankFields.style.display = (val === 'bank_transfer') ? '' : 'none';
        if (dom.momoFields) dom.momoFields.style.display = (val === 'mobile_money') ? '' : 'none';
    }

    if (dom.editPayoutMethod) {
        dom.editPayoutMethod.addEventListener('change', togglePayoutFields);
    }

    if (dom.cancelBusinessBtn) {
        dom.cancelBusinessBtn.addEventListener('click', function () {
            if (user) renderBusinessCard(user);
        });
    }

    // =====================================
    // UTILS
    // =====================================
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return 'Never';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Never';
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var hours = d.getHours();
        var mins = d.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        mins = mins < 10 ? '0' + mins : mins;
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' at ' + hours + ':' + mins + ' ' + ampm;
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // =====================================
    // HAMBURGER
    // =====================================
    if (dom.navHamburger && dom.navCenter && dom.navRight) {
        dom.navHamburger.addEventListener('click', function () {
            dom.navCenter.classList.toggle('open');
            dom.navRight.classList.toggle('open');
            var icon = dom.navHamburger.querySelector('i');
            icon.className = dom.navCenter.classList.contains('open') ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
        });
    }

    // =====================================
    // DARK MODE
    // =====================================
    function initDarkMode() {
        var saved = localStorage.getItem('darkMode');
        if (saved === 'true') {
            document.body.classList.add('dark-mode');
            if (dom.darkModeToggle) dom.darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    }

    if (dom.darkModeToggle) {
        dom.darkModeToggle.addEventListener('click', function () {
            document.body.classList.toggle('dark-mode');
            var isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            dom.darkModeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        });
    }

    // =====================================
    // LOGOUT
    // =====================================
    function handleLogout() {
        localStorage.removeItem('token');
        window.location.href = '/auth';
    }

    if (dom.logoutBtn) {
        dom.logoutBtn.addEventListener('click', handleLogout);
    }

    // =====================================
    // ROLE GUARD & NAV SETUP
    // =====================================
    async function initAuth() {
        try {
            var res = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            var json = await res.json();
            user = json.user || json;

            // Set dashboard link based on role
            if (dom.navDashboardLink) {
                if (user.role === 'admin') {
                    dom.navDashboardLink.href = '/admin.html';
                } else if (user.role === 'buyer') {
                    dom.navDashboardLink.href = '/buyer-dashboard';
                } else {
                    dom.navDashboardLink.href = '/dashboard';
                }
            }

            return user;
        } catch (e) {
            localStorage.removeItem('token');
            location.href = '/auth';
            return null;
        }
    }

    // =====================================
    // LOAD PROFILE
    // =====================================
    async function loadProfile() {
        try {
            var res = await fetch('/api/auth/profile', { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.status === 401) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            if (!res.ok) throw new Error('Failed to load profile');
            var data = await res.json();
            user = data.user;
            renderProfile(user);
        } catch (err) {
            console.error('Profile load error:', err);
            showToast('Failed to load profile data.', 'error');
        }
    }

    function renderProfile(u) {
        // Avatar
        if (u.avatar) {
            dom.profileAvatar.innerHTML = '<img src="' + escapeHtml(u.avatar) + '" alt="Avatar">';
        } else {
            dom.profileAvatar.innerHTML = '<div class="profile-avatar-placeholder"><i class="fa-solid fa-user"></i></div>';
        }

        // Header info
        dom.profileName.textContent = u.name || 'User';
        dom.profileEmail.textContent = u.email || '';

        // Badges
        var badgesHtml = '';
        badgesHtml += '<span class="profile-badge badge-role"><i class="fa-solid fa-' + (u.role === 'admin' ? 'shield-halved' : u.role === 'buyer' ? 'cart-shopping' : 'seedling') + '"></i> ' + capitalize(u.role) + '</span>';
        badgesHtml += '<span class="profile-badge ' + (u.isSuspended ? 'badge-suspended' : 'badge-active') + '"><i class="fa-solid fa-circle"></i> ' + (u.isSuspended ? 'Suspended' : 'Active') + '</span>';
        badgesHtml += '<span class="profile-badge ' + (u.isVerified ? 'badge-verified' : 'badge-unverified') + '"><i class="fa-solid fa-' + (u.isVerified ? 'check' : 'clock') + '"></i> ' + (u.isVerified ? 'Verified' : 'Unverified') + '</span>';
        dom.profileBadges.innerHTML = badgesHtml;

        // Personal info
        dom.infoName.textContent = u.name || '-';
        dom.infoEmail.textContent = u.email || '-';
        dom.infoPhone.textContent = u.phone || 'Not set';
        dom.infoAddress.textContent = u.address || 'Not set';
        dom.infoRole.textContent = capitalize(u.role);
        dom.infoStatus.innerHTML = u.isSuspended
            ? '<span style="color:#f87171;">Suspended</span>'
            : '<span style="color:#4ade80;">Active</span>';
        dom.infoJoined.textContent = formatDate(u.createdAt);
        dom.infoLastLogin.textContent = formatDateTime(u.lastLogin);

        // Security info
        dom.infoLastPasswordChange.textContent = u.lastPasswordChange ? formatDate(u.lastPasswordChange) : 'Never changed';
        dom.infoLastLoginSec.textContent = formatDateTime(u.lastLogin);
        dom.infoRoleSec.textContent = capitalize(u.role);
        dom.infoStatusSec.innerHTML = u.isSuspended
            ? '<span style="color:#f87171;">Suspended</span>'
            : '<span style="color:#4ade80;">Active</span>';

        // Edit form
        dom.editName.value = u.name || '';
        dom.editEmail.value = u.email || '';
        dom.editPhone.value = u.phone || '';
        dom.editAddress.value = u.address || '';
        dom.editBio.value = u.bio || '';
        dom.bioCharCount.textContent = (u.bio || '').length;

        // Business / Payout card (farmers only)
        renderBusinessCard(u);
    }

    // =====================================
    // RENDER BUSINESS / PAYOUT CARD
    // =====================================
    function renderBusinessCard(u) {
        if (!dom.businessCard) return;
        var isFarmer = u && u.role === 'farmer';
        dom.businessCard.style.display = isFarmer ? '' : 'none';
        if (!isFarmer) return;

        dom.editBusinessName.value = u.businessName || '';
        dom.editCountry.value = u.country || '';
        dom.editCity.value = u.city || '';
        dom.editPayoutMethod.value = u.preferredPayoutMethod || 'none';
        dom.editBankName.value = u.bankName || '';
        dom.editBankAccountName.value = u.bankAccountName || '';
        dom.editBankAccountNumber.value = u.bankAccountNumber || '';
        dom.editMomoNumber.value = u.momoNumber || '';
        togglePayoutFields();
    }

    // =====================================
    // EDIT PROFILE
    // =====================================
    if (dom.editBio) {
        dom.editBio.addEventListener('input', function () {
            dom.bioCharCount.textContent = this.value.length;
        });
    }

    if (dom.cancelEditBtn) {
        dom.cancelEditBtn.addEventListener('click', function () {
            if (user) renderProfile(user);
        });
    }

    if (dom.editProfileForm) {
        dom.editProfileForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            var name = dom.editName.value.trim();
            if (!name || name.length < 2) {
                showToast('Name must be at least 2 characters long.', 'error');
                return;
            }

            if (name.length > 50) {
                showToast('Name must be 50 characters or less.', 'error');
                return;
            }

            var phone = dom.editPhone.value.trim();
            if (phone && !/^[0-9+\s\-()]{7,20}$/.test(phone)) {
                showToast('Please provide a valid phone number.', 'error');
                return;
            }

            var address = dom.editAddress.value.trim();
            if (address && address.length > 200) {
                showToast('Address must be 200 characters or less.', 'error');
                return;
            }

            var bio = dom.editBio.value.trim();
            if (bio && bio.length > 500) {
                showToast('Bio must be 500 characters or less.', 'error');
                return;
            }

            dom.saveProfileBtn.disabled = true;
            dom.saveProfileBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                var res = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ name: name, phone: phone, address: address, bio: bio })
                });

                var data = await res.json();

                if (!res.ok) {
                    showToast(data.error || data.message || 'Failed to update profile.', 'error');
                    return;
                }

                user = data.user;
                renderProfile(user);
                showToast('Profile updated successfully!', 'success');
            } catch (err) {
                console.error('Profile update error:', err);
                showToast('Failed to update profile. Please try again.', 'error');
            } finally {
                dom.saveProfileBtn.disabled = false;
                dom.saveProfileBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
            }
        });
    }

    // =====================================
    // BUSINESS / PAYOUT FORM SUBMIT
    // =====================================
    if (dom.businessForm) {
        dom.businessForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            var businessName = dom.editBusinessName.value.trim();
            var country = dom.editCountry.value.trim();
            var city = dom.editCity.value.trim();
            var payoutMethod = dom.editPayoutMethod.value;
            var bankName = dom.editBankName.value.trim();
            var bankAccountName = dom.editBankAccountName.value.trim();
            var bankAccountNumber = dom.editBankAccountNumber.value.trim();
            var momoNumber = dom.editMomoNumber.value.trim();

            if (payoutMethod === 'bank_transfer') {
                if (!bankName || !bankAccountNumber || !bankAccountName) {
                    showToast('Please fill in all bank details.', 'error');
                    return;
                }
            }
            if (payoutMethod === 'mobile_money') {
                if (!momoNumber) {
                    showToast('Please enter your Mobile Money number.', 'error');
                    return;
                }
            }

            dom.saveBusinessBtn.disabled = true;
            dom.saveBusinessBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                var body = {
                    businessName: businessName,
                    country: country,
                    city: city,
                    preferredPayoutMethod: payoutMethod,
                    bankName: bankName,
                    bankAccountName: bankAccountName,
                    bankAccountNumber: bankAccountNumber,
                    momoNumber: momoNumber
                };

                var res = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(body)
                });

                var data = await res.json();

                if (!res.ok) {
                    showToast(data.error || data.message || 'Failed to update payout details.', 'error');
                    return;
                }

                user = data.user;
                renderProfile(user);
                showToast('Payout details saved!', 'success');
            } catch (err) {
                console.error('Business update error:', err);
                showToast('Failed to save payout details.', 'error');
            } finally {
                dom.saveBusinessBtn.disabled = false;
                dom.saveBusinessBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Payout Details';
            }
        });
    }

    // =====================================
    // AVATAR UPLOAD
    // =====================================
    if (dom.avatarFileInput) {
        dom.avatarFileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                handleAvatarFile(this.files[0]);
            }
        });
    }

    if (dom.avatarDropZone) {
        dom.avatarDropZone.addEventListener('click', function () {
            dom.avatarFileInput.click();
        });

        dom.avatarDropZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('dragover');
        });

        dom.avatarDropZone.addEventListener('dragleave', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
        });

        dom.avatarDropZone.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleAvatarFile(e.dataTransfer.files[0]);
            }
        });
    }

    function handleAvatarFile(file) {
        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.indexOf(file.type) === -1) {
            showToast('Only JPG, PNG, and WEBP images are allowed.', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be 5MB or less.', 'error');
            return;
        }

        avatarFile = file;

        var reader = new FileReader();
        reader.onload = function (e) {
            dom.avatarPreviewImg.src = e.target.result;
            dom.avatarPreviewName.textContent = file.name;
            dom.avatarPreviewSize.textContent = formatFileSize(file.size);
            dom.avatarPreviewContainer.classList.add('visible');
            dom.avatarUploadActions.style.display = 'flex';
            dom.avatarDropZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    if (dom.avatarRemoveBtn) {
        dom.avatarRemoveBtn.addEventListener('click', function () {
            resetAvatarUpload();
        });
    }

    if (dom.avatarCancelBtn) {
        dom.avatarCancelBtn.addEventListener('click', function () {
            resetAvatarUpload();
        });
    }

    function resetAvatarUpload() {
        avatarFile = null;
        dom.avatarFileInput.value = '';
        dom.avatarPreviewContainer.classList.remove('visible');
        dom.avatarUploadActions.style.display = 'none';
        dom.avatarDropZone.style.display = '';
    }

    if (dom.avatarSaveBtn) {
        dom.avatarSaveBtn.addEventListener('click', async function () {
            if (!avatarFile) {
                showToast('Please select an image first.', 'warning');
                return;
            }

            dom.avatarSaveBtn.disabled = true;
            dom.avatarSaveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

            try {
                var formData = new FormData();
                formData.append('avatar', avatarFile);

                var res = await fetch('/api/auth/avatar', {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });

                var data = await res.json();

                if (!res.ok) {
                    showToast(data.error || data.message || 'Failed to upload avatar.', 'error');
                    return;
                }

                if (user) user.avatar = data.avatar;

                dom.profileAvatar.innerHTML = '<img src="' + escapeHtml(data.avatar) + '" alt="Avatar">';
                resetAvatarUpload();
                showToast('Avatar updated successfully!', 'success');
            } catch (err) {
                console.error('Avatar upload error:', err);
                showToast('Failed to upload avatar. Please try again.', 'error');
            } finally {
                dom.avatarSaveBtn.disabled = false;
                dom.avatarSaveBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload Avatar';
            }
        });
    }

    // =====================================
    // CHANGE PASSWORD MODAL
    // =====================================
    if (dom.changePasswordBtn) {
        dom.changePasswordBtn.addEventListener('click', function () {
            dom.passwordModal.classList.add('active');
            dom.currentPassword.value = '';
            dom.newPassword.value = '';
            dom.confirmPassword.value = '';
            updatePasswordStrength('');
        });
    }

    function closePasswordModal() {
        dom.passwordModal.classList.remove('active');
        dom.currentPassword.value = '';
        dom.newPassword.value = '';
        dom.confirmPassword.value = '';
        updatePasswordStrength('');
    }

    if (dom.passwordModalClose) dom.passwordModalClose.addEventListener('click', closePasswordModal);
    if (dom.passwordModalCancel) dom.passwordModalCancel.addEventListener('click', closePasswordModal);

    dom.passwordModal.addEventListener('click', function (e) {
        if (e.target === dom.passwordModal) closePasswordModal();
    });

    // Password strength
    if (dom.newPassword) {
        dom.newPassword.addEventListener('input', function () {
            updatePasswordStrength(this.value);
        });
    }

    function updatePasswordStrength(password) {
        var checks = {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };

        var score = 0;
        if (checks.length) score++;
        if (checks.upper) score++;
        if (checks.lower) score++;
        if (checks.number) score++;
        if (checks.special) score++;

        var strengthLevel = 0;
        if (score >= 5) strengthLevel = 4;
        else if (score >= 4) strengthLevel = 3;
        else if (score >= 3) strengthLevel = 2;
        else if (score >= 1) strengthLevel = 1;

        var bars = [dom.str1, dom.str2, dom.str3, dom.str4];
        var classes = ['', 'weak', 'fair', 'good', 'strong'];

        bars.forEach(function (bar, i) {
            bar.className = 'strength-bar';
            if (i < strengthLevel) {
                bar.classList.add(classes[strengthLevel]);
            }
        });

        updateReq(dom.reqLength, checks.length);
        updateReq(dom.reqUpper, checks.upper);
        updateReq(dom.reqLower, checks.lower);
        updateReq(dom.reqNumber, checks.number);
        updateReq(dom.reqSpecial, checks.special);
    }

    function updateReq(el, met) {
        if (!el) return;
        if (met) {
            el.classList.add('met');
            el.querySelector('i').className = 'fa-solid fa-check-circle';
        } else {
            el.classList.remove('met');
            el.querySelector('i').className = 'fa-solid fa-circle';
        }
    }

    // Save password
    if (dom.passwordModalSave) {
        dom.passwordModalSave.addEventListener('click', async function () {
            var currentPw = dom.currentPassword.value;
            var newPw = dom.newPassword.value;
            var confirmPw = dom.confirmPassword.value;

            if (!currentPw) {
                showToast('Current password is required.', 'error');
                return;
            }

            if (!newPw) {
                showToast('New password is required.', 'error');
                return;
            }

            if (newPw.length < 8) {
                showToast('New password must be at least 8 characters.', 'error');
                return;
            }

            if (!/[A-Z]/.test(newPw)) {
                showToast('Password must contain an uppercase letter.', 'error');
                return;
            }

            if (!/[a-z]/.test(newPw)) {
                showToast('Password must contain a lowercase letter.', 'error');
                return;
            }

            if (!/[0-9]/.test(newPw)) {
                showToast('Password must contain a number.', 'error');
                return;
            }

            if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPw)) {
                showToast('Password must contain a special character.', 'error');
                return;
            }

            if (newPw === currentPw) {
                showToast('New password must be different from current.', 'error');
                return;
            }

            if (newPw !== confirmPw) {
                showToast('Passwords do not match.', 'error');
                return;
            }

            dom.passwordModalSave.disabled = true;
            dom.passwordModalSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

            try {
                var res = await fetch('/api/auth/change-password', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        currentPassword: currentPw,
                        newPassword: newPw,
                        confirmPassword: confirmPw
                    })
                });

                var data = await res.json();

                if (!res.ok) {
                    showToast(data.error || data.message || 'Failed to change password.', 'error');
                    return;
                }

                closePasswordModal();
                showToast('Password changed successfully! You will be logged out.', 'success');

                setTimeout(function () {
                    localStorage.removeItem('token');
                    window.location.href = '/auth';
                }, 2000);
            } catch (err) {
                console.error('Password change error:', err);
                showToast('Failed to change password. Please try again.', 'error');
            } finally {
                dom.passwordModalSave.disabled = false;
                dom.passwordModalSave.innerHTML = '<i class="fa-solid fa-check"></i> Update Password';
            }
        });
    }

    // =====================================
    // INIT
    // =====================================
    initDarkMode();

    (async function () {
        var u = await initAuth();
        if (u) {
            await loadProfile();
        }
    })();
})();
