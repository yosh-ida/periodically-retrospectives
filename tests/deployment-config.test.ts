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

run("Vite base path matches the GitHub Pages repository path", () => {
  assert.equal(viteConfig.base, "/periodically-retrospectives/");
});
