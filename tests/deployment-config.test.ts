import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import viteConfig from "../vite.config.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const workspaceRoot = path.resolve(import.meta.dirname, "..");

run("deploy script publishes the Vite dist directory", () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(workspaceRoot, "package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
  };

  assert.equal(packageJson.scripts?.deploy, "gh-pages -d dist");
});

run("predeploy builds with the GitHub Pages base path only for deployment", () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(workspaceRoot, "package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
  };

  assert.match(
    packageJson.scripts?.predeploy ?? "",
    /vite\.js build --base=\/periodically-retrospectives\//,
  );
});

run("default Vite config keeps the root base path outside gh-pages deploys", () => {
  assert.equal(viteConfig.base, undefined);
});
