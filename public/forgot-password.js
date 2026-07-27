document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("forgot-password-form");
    const status = document.getElementById("forgot-status");
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (!form) return;

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document.getElementById("reset-email").value.trim();

        if (typeof UX !== 'undefined') {
            var valid = UX.validateForm(form, {
                'reset-email': { required: true, email: true, requiredMsg: 'Please enter your email address' }
            });
            if (!valid) return;
        }

        var restore = null;
        if (typeof UX !== 'undefined' && submitBtn) {
            restore = UX.btnLoading(submitBtn, 'Sending reset code...');
        }
        status.style.color = "#007bff";
        status.textContent = "Sending reset code...";

        try {

            const res = await fetch("/api/auth/forgot-password", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email
                })

            });

            const data = await res.json();

            if (res.ok) {

                status.style.color = "green";
                status.textContent = data.message;

                if (typeof UX !== 'undefined') {
                    UX.toast(data.message || 'Reset code sent!', 'success');
                }

                setTimeout(() => {

                    window.location.href =
                        `/reset-password.html?email=${encodeURIComponent(email)}`;

                }, 1500);

            } else {

                status.style.color = "red";
                status.textContent =
                    data.error || "Unable to send reset code.";

                if (typeof UX !== 'undefined') {
                    UX.toast(data.error || 'Unable to send reset code.', 'error');
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
