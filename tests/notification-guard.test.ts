import assert from "node:assert/strict";

import {
  canContinueToNotificationSetup,
  validateNotificationSetupAssignment,
} from "../src/pages/themeFormMessages.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("canContinueToNotificationSetup returns false without an assigned notification settings id", () => {
  assert.equal(canContinueToNotificationSetup(null), false);
  assert.equal(canContinueToNotificationSetup(""), false);
  assert.equal(canContinueToNotificationSetup("notification-settings-1"), true);
});

run("validateNotificationSetupAssignment throws when notification settings are not assigned", () => {
  assert.throws(
    () => validateNotificationSetupAssignment(null),
    /notification settings assignment is required/,
  );
});
