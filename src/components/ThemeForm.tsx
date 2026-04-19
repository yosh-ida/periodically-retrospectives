import {
  Alert,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import type { NotificationSettings, ThemeInput } from "../domain.ts";
import { canContinueToNotificationSetup } from "../pages/themeFormMessages.ts";

type ThemeFormProps = {
  initialValue: ThemeInput;
  isBusy: boolean;
  notificationSettings: NotificationSettings[];
  onCreateNotificationReference: () => Promise<string>;
  onSubmit: (value: ThemeInput) => Promise<void>;
  onSubmitAndConfigureNotifications?: (value: ThemeInput) => Promise<void>;
  submitLabel: string;
};

export function ThemeForm({
  initialValue,
  isBusy,
  notificationSettings,
  onCreateNotificationReference,
  onSubmit,
  onSubmitAndConfigureNotifications,
  submitLabel,
}: ThemeFormProps) {
  const [value, setValue] = useState(initialValue);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const canContinue = canContinueToNotificationSetup(value.notificationSettingsId);

  const handleChange = (field: keyof ThemeInput, fieldValue: string | null) => {
    setValue((current) => ({
      ...current,
      [field]: fieldValue,
    }));
  };

  const handleError = (error: unknown, fallback: string) => {
    setErrorMessage(error instanceof Error ? error.message : fallback);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      await onSubmit(value);
    } catch (error) {
      handleError(error, "保存に失敗しました。");
    }
  };

  const handleSubmitAndConfigureNotifications = async () => {
    if (!onSubmitAndConfigureNotifications) {
      return;
    }

    setErrorMessage("");

    try {
      await onSubmitAndConfigureNotifications(value);
    } catch (error) {
      handleError(error, "保存に失敗しました。");
    }
  };

  const handleCreateReference = async () => {
    setErrorMessage("");

    try {
      const notificationSettingsId = await onCreateNotificationReference();
      setValue((current) => ({
        ...current,
        notificationSettingsId,
      }));
    } catch (error) {
      handleError(error, "通知設定参照の作成に失敗しました。");
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          <Stack spacing={1}>
            <Typography variant="h5">テーマの整理</Typography>
            <Typography color="text.secondary">
              課題、原因、目指したいゴールをまとめます。通知設定画面へ進むには、
              先に通知設定参照を割り当ててから保存します。
            </Typography>
          </Stack>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          <TextField
            label="課題"
            value={value.issue}
            onChange={(event) => handleChange("issue", event.target.value)}
            required
            minRows={2}
            multiline
          />
          <TextField
            label="原因"
            value={value.cause}
            onChange={(event) => handleChange("cause", event.target.value)}
            required
            minRows={3}
            multiline
          />
          <TextField
            label="目指したいゴール"
            value={value.goal}
            onChange={(event) => handleChange("goal", event.target.value)}
            required
            minRows={3}
            multiline
          />

          <Stack spacing={1.5}>
            <TextField
              select
              label="通知設定参照"
              value={value.notificationSettingsId ?? ""}
              onChange={(event) =>
                handleChange("notificationSettingsId", event.target.value || null)
              }
              helperText="既存の通知設定を関連づけるか、下のボタンで新しく参照を作成できます。"
            >
              <MenuItem value="">関連づけない</MenuItem>
              {notificationSettings.map((settings) => (
                <MenuItem key={settings.id} value={settings.id}>
                  {settings.id} {settings.enabled ? "(enabled)" : "(disabled)"}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={handleCreateReference} disabled={isBusy}>
              新しい通知設定参照を作成
            </Button>
            {onSubmitAndConfigureNotifications ? (
              <Alert severity={canContinue ? "info" : "warning"}>
                {canContinue
                  ? "通知設定参照が割り当てられているので、そのまま通知設定画面へ進めます。"
                  : "通知設定画面へ進むには、先に通知設定参照を割り当ててください。"}
              </Alert>
            ) : null}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button type="submit" variant="contained" disabled={isBusy}>
              {submitLabel}
            </Button>
            {onSubmitAndConfigureNotifications ? (
              <Button
                type="button"
                variant="outlined"
                disabled={isBusy || !canContinue}
                onClick={() => void handleSubmitAndConfigureNotifications()}
              >
                作成して通知設定へ進む
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
