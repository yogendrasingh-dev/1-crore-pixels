"use client";

import { useState } from "react";

// Placeholder inbox — replace with the real support address before launch.
const SUPPORT_EMAIL = "support@1crorepixels.com";

export function ContactForm() {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

  const body = [name ? `From: ${name}` : null, "", query].filter((line) => line !== null).join("\n");
  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("1 Crore Pixels — Query")}&body=${encodeURIComponent(body)}`;

  return (
    <form className="flow-step" onSubmit={(event) => event.preventDefault()}>
      <label className="field-label" htmlFor="contact-name">
        Your Name (optional)
      </label>
      <input
        id="contact-name"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Rahul"
      />
      <label className="field-label" htmlFor="contact-query">
        Your Query
      </label>
      <textarea
        id="contact-query"
        rows={5}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="What would you like to ask us?"
      />
      <a
        href={mailtoHref}
        className={`cta-button${query.trim() ? "" : " cta-button-disabled"}`}
        aria-disabled={!query.trim()}
        onClick={(event) => {
          if (!query.trim()) event.preventDefault();
        }}
      >
        Send via Email
      </a>
      <p className="contact-form-note">
        This opens your email app with your query pre-filled — nothing is stored on our servers.
      </p>
    </form>
  );
}
