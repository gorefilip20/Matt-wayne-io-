(() => {
  const form = document.getElementById("mw-newsletter-form");
  const status = document.getElementById("mw-newsletter-status");
  if (!form || !status) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const consent = form.querySelector('input[name="consent"]');
    const button = form.querySelector('button[type="submit"]');
    status.dataset.state = "";
    if (!email || !consent || !consent.checked) {
      status.textContent = "Enter your email and check the consent box to join.";
      status.dataset.state = "error";
      return;
    }

    button.disabled = true;
    status.textContent = "Adding you to the list…";
    try {
      const response = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true, company: String(data.get("company") || "") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Please try again in a moment.");
      form.reset();
      status.textContent = "You’re on the list. Keep an eye on your inbox.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Please try again in a moment.";
      status.dataset.state = "error";
    } finally {
      button.disabled = false;
    }
  });
})();
