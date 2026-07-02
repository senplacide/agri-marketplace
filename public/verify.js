// public/verify.js

document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const resendBtn = document.getElementById("resend-code-btn");
    const resendTimer = document.getElementById("resend-timer");
    const email = params.get("email");

    document.getElementById("verify-email").value = email || "";

    startResendCountdown();

function startResendCountdown(seconds = 60) {

    resendBtn.disabled = true;
    resendBtn.textContent = "Resend Code";

    let remaining = seconds;

    resendTimer.textContent =
        `You can request another code in ${remaining}s`;

    const interval = setInterval(() => {

        remaining--;

        resendTimer.textContent =
            `You can request another code in ${remaining}s`;

        if (remaining <= 0) {

            clearInterval(interval);

            resendBtn.disabled = false;
            resendBtn.textContent = "Resend Code";

            resendTimer.textContent = "";

        }

    }, 1000);

}
    document
        .getElementById("verify-form")
        .addEventListener("submit", async (e) => {

            e.preventDefault();

            const code = document.getElementById("verify-code").value;
            const status = document.getElementById("verify-status");

            status.textContent = "Verifying...";
            status.style.color = "#007bff";

            try {

                const res = await fetch("/api/auth/verify-email", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email,
                        code
                    })

                });

                const data = await res.json();

                console.log("Verification response:", data);

                if (res.ok) {

                    status.style.color = "green";
                    status.textContent = data.message;

                    localStorage.setItem("token", data.token);

                    setTimeout(() => {

                        window.location.href = "/dashboard";

                    }, 1500);

                } else {

                    status.style.color = "red";
                    status.textContent = data.error || "Verification failed.";

                }

            } catch (err) {

                console.error(err);

                status.style.color = "red";
                status.textContent = "Unable to connect to the server.";

            }

         });

    //
    // RESEND VERIFICATION CODE
    //

    if (resendBtn) {

        resendBtn.addEventListener("click", async () => {

            const status = document.getElementById("verify-status");

            resendBtn.disabled = true;
            resendBtn.textContent = "Sending...";

            try {

                const res = await fetch("/api/auth/resend-code", {

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
                    startResendCountdown();

                } else {

                    status.style.color = "red";
                    status.textContent = data.error;

                }

            } catch (err) {

                status.style.color = "red";
                status.textContent = "Unable to resend verification code.";

            }

        });

    }

});