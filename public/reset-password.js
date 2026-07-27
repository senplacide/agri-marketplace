document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");

    document.getElementById("reset-email").value = email || "";

    const form = document.getElementById("reset-form");
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (!form) return;

    form.addEventListener("submit", async (e) => {

            e.preventDefault();

            const code = document.getElementById("reset-code").value;
            const password = document.getElementById("reset-password").value;

            if (typeof UX !== 'undefined') {
                var valid = UX.validateForm(form, {
                    'reset-code': { required: true, pattern: /^[0-9]{6}$/, patternMsg: 'Please enter a valid 6-digit code', requiredMsg: 'Please enter the reset code' },
                    'reset-password': { required: true, minLength: 6, requiredMsg: 'Please enter a new password' }
                });
                if (!valid) return;
            }

            const status = document.getElementById("reset-status");

            var restore = null;
            if (typeof UX !== 'undefined' && submitBtn) {
                restore = UX.btnLoading(submitBtn, 'Resetting password...');
            }
            status.style.color = "#007bff";
            status.textContent = "Resetting password...";

            try {

                const res = await fetch("/api/auth/reset-password", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email,
                        code,
                        password
                    })

                });

                const data = await res.json();

                if (res.ok) {

                    status.style.color = "green";
                    status.textContent = data.message;

                    if (typeof UX !== 'undefined') {
                        UX.toast(data.message || 'Password reset successful!', 'success');
                    }

                    setTimeout(() => {

                        window.location.href = "/auth";

                    }, 1500);

                } else {

                    status.style.color = "red";
                    status.textContent =
                        data.error || "Password reset failed.";

                    if (typeof UX !== 'undefined') {
                        UX.toast(data.error || 'Password reset failed.', 'error');
                    }

                }

            } catch (err) {

                console.error(err);

                status.style.color = "red";
                status.textContent =
                    "Unable to connect to the server.";

                if (typeof UX !== 'undefined') {
                    UX.toast('Unable to connect to the server.', 'error');
                }

            } finally {
                if (restore) restore();
            }

        });

});
