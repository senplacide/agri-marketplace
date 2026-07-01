// public/verify.js

document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");

    document.getElementById("verify-email").value = email || "";

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

});