/*
 * STELLARS Academic Portal
 * Phase 1 UI scaffold.
 *
 * Firebase Authentication is intentionally not connected yet.
 * The login identifier, account provisioning flow, user schema,
 * and Firestore Security Rules must be finalized before enabling
 * real sign-in.
 */

const loginForm = document.getElementById("academicLoginForm");
const usernameInput = document.getElementById("academicUsername");
const passwordInput = document.getElementById("academicPassword");
const togglePasswordButton = document.getElementById("togglePassword");
const formMessage = document.getElementById("academicFormMessage");

if (togglePasswordButton && passwordInput) {
    togglePasswordButton.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";

        const icon = togglePasswordButton.querySelector("i");
        if (icon) {
            icon.className = isPassword ? "bx bx-hide" : "bx bx-show";
        }

        togglePasswordButton.setAttribute(
            "aria-label",
            isPassword ? "Hide password" : "Show password"
        );
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const username = usernameInput?.value.trim();
        const password = passwordInput?.value;

        if (!username || !password) {
            formMessage.textContent = "Please enter both your username and password.";
            return;
        }

        formMessage.textContent =
            "The portal is being configured. Account sign-in will be enabled after the secure account setup is complete.";
    });
}
