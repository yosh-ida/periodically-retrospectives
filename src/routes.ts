export type AppRoute =
  | { name: "dashboard" }
  | { name: "theme-new" }
  | { name: "theme-detail"; themeId: string }
  | { name: "theme-edit"; themeId: string }
  | { name: "theme-review"; themeId: string }
  | { name: "theme-notifications"; themeId: string }
  | { name: "not-found" };

type Listener = () => void;

const listeners = new Set<Listener>();
let cachedPathname = "";
let cachedRoute: AppRoute = { name: "dashboard" };

function normalizeBasePath(basePath: string) {
  if (!basePath || basePath === "/") {
    return "/";
  }

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function getConfiguredBasePath() {
  try {
    return normalizeBasePath(import.meta.env.BASE_URL);
  } catch {
    return "/";
  }
}

function normalizePathname(pathname: string) {
  if (pathname === "/index.html") {
    return "/";
  }

  if (pathname.endsWith("/index.html")) {
    return pathname.slice(0, -"/index.html".length) || "/";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname || "/";
}

function stripBasePath(pathname: string, basePath: string) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedBasePath = normalizeBasePath(basePath);

  if (normalizedBasePath === "/") {
    return normalizedPathname;
  }

  const normalizedBaseWithoutTrailingSlash = normalizedBasePath.slice(0, -1);
  if (normalizedPathname === normalizedBaseWithoutTrailingSlash) {
    return "/";
  }

  if (normalizedPathname.startsWith(normalizedBasePath)) {
    const strippedPath = normalizedPathname.slice(normalizedBasePath.length - 1);
    return normalizePathname(strippedPath);
  }

  return normalizedPathname;
}

function joinBasePath(pathname: string, basePath: string) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedBasePath = normalizeBasePath(basePath);

  if (normalizedBasePath === "/") {
    return normalizedPathname;
  }

  if (normalizedPathname === "/") {
    return normalizedBasePath;
  }

  return `${normalizedBasePath}${normalizedPathname.slice(1)}`;
}

export function parseRoute(pathname: string, basePath = getConfiguredBasePath()): AppRoute {
  const normalizedPathname = stripBasePath(pathname, basePath);

  if (normalizedPathname === "/") {
    return { name: "dashboard" };
  }

  if (normalizedPathname === "/themes/new") {
    return { name: "theme-new" };
  }

  const editMatch = normalizedPathname.match(/^\/themes\/([^/]+)\/edit$/);
  if (editMatch) {
    return { name: "theme-edit", themeId: decodeURIComponent(editMatch[1]) };
  }

  const reviewMatch = normalizedPathname.match(/^\/themes\/([^/]+)\/review$/);
  if (reviewMatch) {
    return { name: "theme-review", themeId: decodeURIComponent(reviewMatch[1]) };
  }

  const notificationsMatch = normalizedPathname.match(/^\/themes\/([^/]+)\/notifications$/);
  if (notificationsMatch) {
    return {
      name: "theme-notifications",
      themeId: decodeURIComponent(notificationsMatch[1]),
    };
  }

  const detailMatch = normalizedPathname.match(/^\/themes\/([^/]+)$/);
  if (detailMatch) {
    return { name: "theme-detail", themeId: decodeURIComponent(detailMatch[1]) };
  }

  return { name: "not-found" };
}

export function getRouteSnapshot(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname !== cachedPathname) {
    cachedPathname = normalizedPathname;
    cachedRoute = parseRoute(normalizedPathname);
  }

  return cachedRoute;
}

export function buildPath(
  route: Exclude<AppRoute, { name: "not-found" }>,
  basePath = getConfiguredBasePath(),
) {
  let routePath = "/";

  switch (route.name) {
    case "dashboard":
      routePath = "/";
      break;
    case "theme-new":
      routePath = "/themes/new";
      break;
    case "theme-detail":
      routePath = `/themes/${encodeURIComponent(route.themeId)}`;
      break;
    case "theme-edit":
      routePath = `/themes/${encodeURIComponent(route.themeId)}/edit`;
      break;
    case "theme-review":
      routePath = `/themes/${encodeURIComponent(route.themeId)}/review`;
      break;
    case "theme-notifications":
      routePath = `/themes/${encodeURIComponent(route.themeId)}/notifications`;
      break;
  }

  return joinBasePath(routePath, basePath);
}

export function formatRouteTitle(route: AppRoute) {
  switch (route.name) {
    case "dashboard":
      return "ダッシュボード";
    case "theme-new":
      return "新しいテーマ";
    case "theme-detail":
      return "テーマ詳細";
    case "theme-edit":
      return "テーマを編集";
    case "theme-review":
      return "振り返りを記録";
    case "theme-notifications":
      return "通知設定";
    case "not-found":
      return "ページが見つかりません";
  }
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function navigate(route: Exclude<AppRoute, { name: "not-found" }>) {
  const nextPath = buildPath(route);
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, "", nextPath);
    emitChange();
  }
}

export function replaceRoute(route: Exclude<AppRoute, { name: "not-found" }>) {
  const nextPath = buildPath(route);
  window.history.replaceState({}, "", nextPath);
  emitChange();
}

export function getCurrentRoute() {
  return getRouteSnapshot(window.location.pathname);
}

export function subscribeToRouteChanges(listener: Listener) {
  listeners.add(listener);

  const handlePopState = () => listener();
  window.addEventListener("popstate", handlePopState);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", handlePopState);
  };
}
