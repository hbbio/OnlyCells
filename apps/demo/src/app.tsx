import { bind, createRouter, type LinkProps, type RouterState } from "@nodiffjs/core";
import { component, controllerCell } from "./cells";
import { AuthPage } from "./pages/AuthPage";
import { CachePage } from "./pages/CachePage";
import { HomePage } from "./pages/HomePage";
import { PostsPage } from "./pages/PostsPage";

const NotFound = component("NotFound", () => {
  return (
    <section class="notice" data-tone="danger">
      <h1>Not found</h1>
      <p>The current route is not registered.</p>
    </section>
  );
});

const RouteError = component("RouteError", () => {
  return (
    <section class="notice" data-tone="danger" role="alert">
      <h1>Route failed</h1>
      <p>The page could not render safely.</p>
    </section>
  );
});

export const routeState = controllerCell<RouterState>("route");
export const router = createRouter(
  [
    { path: "/", title: "NoDiff", component: HomePage },
    { path: "/posts", title: "Posts | NoDiff", component: PostsPage },
    { path: "/auth", title: "Auth | NoDiff", component: AuthPage },
    { path: "/cache", title: "Cache | NoDiff", component: CachePage },
  ],
  {
    mode: "hash",
    cell: routeState,
    fallback: NotFound,
    error: RouteError,
  },
);

const Link = component("Link", (_proxy, props: LinkProps) => router.Link(props));

export const App = component("App", (proxy) => {
  const drawerOpen = proxy.new(false, "drawer open");

  return (
    <div class="app-shell" use={() => router.start()}>
      <input
        id="app-drawer"
        type="checkbox"
        class="sidebar-toggle"
        aria-label="Show navigation"
        aria-controls="app-sidebar"
        use={bind.checked(
          drawerOpen,
          (open) => open,
          (checked) => checked,
        )}
      />
      <header class="mobile-bar">
        <label for="app-drawer" class="menu-toggle">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </label>
        <strong>NoDiff</strong>
      </header>
      <label for="app-drawer" class="sidebar-overlay" aria-hidden="true" />
      <aside class="sidebar" id="app-sidebar">
        <Link class="brand" to="/">
          <span class="brand-mark" aria-hidden="true">
            no
          </span>
          NoDiff
        </Link>
        <nav aria-label="Main navigation">
          <ul class="nav-list">
            <li>
              <Link to="/" exact activeClass="is-active">
                Home
              </Link>
            </li>
            <li>
              <Link to="/posts" activeClass="is-active">
                Posts
              </Link>
            </li>
            <li>
              <Link to="/auth" activeClass="is-active">
                Auth
              </Link>
            </li>
            <li>
              <Link to="/cache" activeClass="is-active">
                Cache
              </Link>
            </li>
          </ul>
        </nav>
        <footer class="sidebar-footer">
          <small>Bun + direct DOM TSX</small>
        </footer>
      </aside>
      <main class="app-main">{router.outlet()}</main>
    </div>
  );
});
