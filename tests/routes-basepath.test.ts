import assert from "node:assert/strict";

import { buildPath, parseRoute, type AppRoute } from "../src/routes.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("parseRoute understands GitHub Pages base paths", () => {
  const basePath = "/periodically-retrospectives/";
  const cases: Array<[string, AppRoute]> = [
    ["/periodically-retrospectives/", { name: "dashboard" }],
    ["/periodically-retrospectives/themes/new", { name: "theme-new" }],
    ["/periodically-retrospectives/themes/theme-1", { name: "theme-detail", themeId: "theme-1" }],
    [
      "/periodically-retrospectives/themes/theme-1/edit",
      { name: "theme-edit", themeId: "theme-1" },
    ],
  ];

  for (const [pathname, expected] of cases) {
    assert.deepEqual(parseRoute(pathname, basePath), expected);
  }
});

run("buildPath prefixes GitHub Pages base paths when requested", () => {
  const basePath = "/periodically-retrospectives/";

  assert.equal(buildPath({ name: "dashboard" }, basePath), "/periodically-retrospectives/");
  assert.equal(
    buildPath({ name: "theme-detail", themeId: "theme-42" }, basePath),
    "/periodically-retrospectives/themes/theme-42",
  );
});

run("parseRoute treats index.html entrypoints as the dashboard", () => {
  assert.deepEqual(parseRoute("/index.html", "/"), { name: "dashboard" });
  assert.deepEqual(parseRoute("/periodically-retrospectives/index.html", "/periodically-retrospectives/"), {
    name: "dashboard",
  });
});
