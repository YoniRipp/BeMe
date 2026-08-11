import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Leaf } from 'lucide-react';

const links = [
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-[12px] transition-shadow duration-300 ${
        scrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span
                className="text-base font-bold tracking-tight text-foreground"
              >
                TrackVibe
              </span>
              <p
                className="text-[10px] font-medium uppercase leading-none tracking-widest text-muted-foreground"
              >
                Life Balance
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              Get started free
            </Link>
          </div>

          <button
            className="p-2 text-primary md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-b border-border bg-background transition-all duration-300 md:hidden ${
          mobileOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0 border-b-0'
        }`}
      >
        <div className="space-y-3 px-6 py-4">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="block w-full py-2 text-left text-sm font-medium text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <div className="space-y-2 border-t border-border pt-3">
            <Link
              to="/login"
              className="block w-full py-2 text-center text-sm font-medium text-muted-foreground"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="block w-full rounded-lg bg-primary py-2 text-center text-sm font-semibold text-primary-foreground"
            >
              Get started free
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
