import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const routesSource = readFileSync(
  path.resolve(import.meta.dirname, "../src/routes.ts"),
  "utf8",
);

run("routes reads Vite BASE_URL through the direct import.meta.env access Vite can replace", () => {
  assert.match(routesSource, /import\.meta\.env\.BASE_URL/);
  assert.doesNotMatch(routesSource, /meta\.env\?\.BASE_URL/);
});
