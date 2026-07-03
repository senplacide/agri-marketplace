document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");

    document.getElementById("reset-email").value = email || "";

    document
        .getElementById("reset-form")
        .addEventListener("submit", async (e) => {

            e.preventDefault();

            const code = document.getElementById("reset-code").value;
            const password = document.getElementById("reset-password").value;

            const status = document.getElementById("reset-status");

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

                    setTimeout(() => {

                        window.location.href = "/auth";

                    }, 1500);

                } else {

                    status.style.color = "red";
                    status.textContent =
                        data.error || "Password reset failed.";

                }

            } catch (err) {

                console.error(err);

                status.style.color = "red";
                status.textContent =
                    "Unable to connect to the server.";

            }

        });

});