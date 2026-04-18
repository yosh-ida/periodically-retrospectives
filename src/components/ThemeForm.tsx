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

type ThemeFormProps = {
  initialValue: ThemeInput;
  isBusy: boolean;
  notificationSettings: NotificationSettings[];
  onCreateNotificationReference: () => Promise<string>;
  onSubmit: (value: ThemeInput) => Promise<void>;
  submitLabel: string;
};

export function ThemeForm({
  initialValue,
  isBusy,
  notificationSettings,
  onCreateNotificationReference,
  onSubmit,
  submitLabel,
}: ThemeFormProps) {
  const [value, setValue] = useState(initialValue);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (field: keyof ThemeInput, fieldValue: string | null) => {
    setValue((current) => ({
      ...current,
      [field]: fieldValue,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      await onSubmit(value);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存に失敗しました。");
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
      setErrorMessage(
        error instanceof Error ? error.message : "通知設定参照の作成に失敗しました。",
      );
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          <Stack spacing={1}>
            <Typography variant="h5">反省点の内容</Typography>
            <Typography color="text.secondary">
              通知ルールそのものはまだ Phase 4 以降で実装します。ここでは既存の通知設定への参照だけを紐づけます。
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
            label="達成したいゴール"
            value={value.goal}
            onChange={(event) => handleChange("goal", event.target.value)}
            required
            minRows={3}
            multiline
          />

          <Stack spacing={1.5}>
            <TextField
              select
              label="通知設定への参照"
              value={value.notificationSettingsId ?? ""}
              onChange={(event) =>
                handleChange("notificationSettingsId", event.target.value || null)
              }
            >
              <MenuItem value="">関連づけなし</MenuItem>
              {notificationSettings.map((settings) => (
                <MenuItem key={settings.id} value={settings.id}>
                  {settings.id} {settings.enabled ? "(enabled)" : "(disabled)"}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={handleCreateReference} disabled={isBusy}>
              無効な通知設定参照を新規作成
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button type="submit" variant="contained" disabled={isBusy}>
              {submitLabel}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
