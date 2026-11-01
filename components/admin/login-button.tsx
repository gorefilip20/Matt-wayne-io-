"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

export function LoginButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="button button-primary login-button"
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        const origin = window.location.origin;
        window.location.assign(`/api/auth/login?origin=${encodeURIComponent(origin)}`);
      }}
    >
      {busy ? "Redirecting to Manus…" : "Continue with Manus"}
      {!busy ? <ArrowUpRight aria-hidden="true" size={17} /> : null}
    </button>
  );
}
