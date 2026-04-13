import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

type LayoutProps = {
  isAdmin: boolean;
  onLogout: () => void;
};

export function Layout({ isAdmin, onLogout }: LayoutProps) {
  const location = useLocation();
  const isWideEditor = location.pathname.startsWith("/admin/blog/");
  const routeKey = `${location.pathname}${location.search}`;

  return (
    <div className={isWideEditor ? "shell shell-wide" : "shell"}>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">VH</span>
          <div>
            <strong>Vincent Hsia</strong>
            <p>Writing, building, shipping.</p>
          </div>
        </Link>

        <nav className="nav">
          <NavLink to="/">About</NavLink>
          <NavLink to="/blog">Blog</NavLink>
          <NavLink to="/guestbook">Guestbook</NavLink>
          {isAdmin ? (
            <>
              <NavLink to="/admin">Dashboard</NavLink>
              <button className="text-button" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login">Admin</NavLink>
          )}
        </nav>
      </header>

      <main className="page-shell">
        <div key={routeKey} className="route-transition">
          <div className="page route-transition-content">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
