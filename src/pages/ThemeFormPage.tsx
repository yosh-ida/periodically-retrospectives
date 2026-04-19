import { useLiveQuery } from "dexie-react-hooks";
import { Alert, Stack } from "@mui/material";

import {
  createNotificationSettingsReference,
  createTheme,
  db,
  updateTheme,
} from "../db.ts";
import type { ThemeInput } from "../domain.ts";
import { navigate } from "../routes.ts";
import { useWorkspaceStore } from "../store.ts";
import { ThemeForm } from "../components/ThemeForm.tsx";
import {
  buildCreateThemeSuccessMessage,
  validateNotificationSetupAssignment,
} from "./themeFormMessages.ts";

const emptyTheme: ThemeInput = {
  issue: "",
  cause: "",
  goal: "",
  notificationSettingsId: null,
};

type ThemeFormPageProps = {
  mode: "create" | "edit";
  themeId?: string;
};

export function ThemeFormPage({ mode, themeId }: ThemeFormPageProps) {
  const { isBusy, setBusy, setStatusMessage } = useWorkspaceStore();
  const data = useLiveQuery(async () => {
    const [notificationSettings, theme] = await Promise.all([
      db.notificationSettings.orderBy("updatedAt").reverse().toArray(),
      themeId ? db.themes.get(themeId) : Promise.resolve(undefined),
    ]);

    return {
      notificationSettings,
      theme,
    };
  }, [themeId]);

  const initialValue =
    mode === "edit" && data?.theme
      ? {
          issue: data.theme.issue,
          cause: data.theme.cause,
          goal: data.theme.goal,
          notificationSettingsId: data.theme.notificationSettingsId,
        }
      : emptyTheme;

  const handleCreateNotificationReference = async () => {
    setBusy(true);
    try {
      const settings = await createNotificationSettingsReference();
      setStatusMessage(`通知設定参照 ${settings.id} を作成しました。`);
      return settings.id;
    } finally {
      setBusy(false);
    }
  };

  const saveTheme = async (
    value: ThemeInput,
    options?: { continueToNotifications?: boolean },
  ) => {
    setBusy(true);

    try {
      if (mode === "create") {
        if (options?.continueToNotifications) {
          validateNotificationSetupAssignment(value.notificationSettingsId);
        }

        const theme = await createTheme(value);
        const continueToNotifications = Boolean(options?.continueToNotifications);

        setStatusMessage(
          buildCreateThemeSuccessMessage(theme.issue, continueToNotifications),
        );

        navigate(
          continueToNotifications
            ? { name: "theme-notifications", themeId: theme.id }
            : { name: "theme-detail", themeId: theme.id },
        );
        return;
      }

      if (!themeId) {
        throw new Error("theme id is required");
      }

      const theme = await updateTheme(themeId, value);
      setStatusMessage(`「${theme.issue}」を更新しました。`);
      navigate({ name: "theme-detail", themeId: theme.id });
    } finally {
      setBusy(false);
    }
  };

  if (mode === "edit" && data && !data.theme) {
    return <Alert severity="error">対象のテーマが見つかりませんでした。</Alert>;
  }

  return (
    <Stack spacing={2}>
      <ThemeForm
        initialValue={initialValue}
        isBusy={isBusy}
        notificationSettings={data?.notificationSettings ?? []}
        onCreateNotificationReference={handleCreateNotificationReference}
        onSubmit={(value) => saveTheme(value)}
        onSubmitAndConfigureNotifications={
          mode === "create"
            ? (value) => saveTheme(value, { continueToNotifications: true })
            : undefined
        }
        submitLabel={mode === "create" ? "作成する" : "更新する"}
      />
    </Stack>
  );
}
