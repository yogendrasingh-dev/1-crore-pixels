import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-tagline">1 crore people. ₹1 each. One big dream.</p>
        <nav className="site-footer-nav">
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <p className="site-footer-disclaimer">Not an investment. Not a guaranteed-return scheme.</p>
      </div>
    </footer>
  );
}
