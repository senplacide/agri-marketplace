document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("forgot-password-form");
    const status = document.getElementById("forgot-status");

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document
            .getElementById("reset-email")
            .value
            .trim();

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

                setTimeout(() => {

                    window.location.href =
                        `/reset-password.html?email=${encodeURIComponent(email)}`;

                }, 1500);

            } else {

                status.style.color = "red";
                status.textContent =
                    data.error || "Unable to send reset code.";

            }

        } catch (err) {

            console.error(err);

            status.style.color = "red";
            status.textContent =
                "Unable to connect to the server.";

        }

    });

});