import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const mainSource = readFileSync(path.join(workspaceRoot, "src/main.tsx"), "utf8");
const runtimeSource = readFileSync(
  path.join(workspaceRoot, "src/features/notifications/runtime.ts"),
  "utf8",
);
const serviceWorkerSource = readFileSync(
  path.join(workspaceRoot, "public/service-worker.js"),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(path.join(workspaceRoot, "public/manifest.webmanifest"), "utf8"),
) as {
  start_url: string;
  scope: string;
  icons: Array<{ src: string; sizes?: string; type?: string }>;
};

run("service worker registration reads Vite BASE_URL for subpath deploys", () => {
  assert.match(mainSource, /import\.meta\.env\.BASE_URL/);
});

run("service worker avoids root-relative navigation targets", () => {
  assert.match(serviceWorkerSource, /registration\.scope/);
  assert.doesNotMatch(serviceWorkerSource, /data:\s*\{\s*url:\s*[\s\S]*\?\s*`?\/themes\//);
});

run("manual notification display avoids root-relative route strings", () => {
  assert.doesNotMatch(runtimeSource, /data:\s*\{\s*url:\s*[\s\S]*\?\s*`?\/themes\//);
});

run("manifest keeps start_url and scope relative to the published subpath", () => {
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
});

run("manifest includes installable PNG icons for Android Chrome", () => {
  assert.ok(
    manifest.icons.some(
      (icon) =>
        icon.src === "./icon-192.png" &&
        icon.sizes === "192x192" &&
        icon.type === "image/png",
    ),
  );
  assert.ok(
    manifest.icons.some(
      (icon) =>
        icon.src === "./icon-512.png" &&
        icon.sizes === "512x512" &&
        icon.type === "image/png",
    ),
  );
  assert.equal(existsSync(path.join(workspaceRoot, "public/icon-192.png")), true);
  assert.equal(existsSync(path.join(workspaceRoot, "public/icon-512.png")), true);
});
