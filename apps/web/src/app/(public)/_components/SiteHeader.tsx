"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/pixel-wall", label: "Pixel Wall" },
  { href: "/contributors", label: "Contributors" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/progress", label: "Progress" },
  { href: "/story", label: "Story" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? " site-header-scrolled" : ""}`}>
      <div className="site-header-inner">
        <Link href="/" className="site-logo">
          <span className="site-logo-mark" aria-hidden="true" />
          1 Crore Pixels
        </Link>
        <nav className="site-nav">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="site-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <Link href="/contribute" className="cta-button cta-button-small">
          Claim a Pixel
        </Link>
      </div>
    </header>
  );
}
