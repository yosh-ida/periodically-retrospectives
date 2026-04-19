export function buildCreateThemeSuccessMessage(
  issue: string,
  continueToNotifications: boolean,
) {
  return continueToNotifications
    ? `「${issue}」を作成しました。続けて通知設定を仕上げます。`
    : `「${issue}」を作成しました。`;
}

export function canContinueToNotificationSetup(notificationSettingsId: string | null | undefined) {
  return typeof notificationSettingsId === "string" && notificationSettingsId.trim().length > 0;
}

export function validateNotificationSetupAssignment(
  notificationSettingsId: string | null | undefined,
) {
  if (!canContinueToNotificationSetup(notificationSettingsId)) {
    throw new Error("notification settings assignment is required");
  }

  return notificationSettingsId;
}
