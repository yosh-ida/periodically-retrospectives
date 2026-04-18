import { useLiveQuery } from "dexie-react-hooks";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import {
  ensureThemeNotificationSettings,
  updateNotificationSettingsRecord,
  db,
} from "../db.ts";
import {
  createEntityId,
  type NotificationChannel,
  type NotificationRule,
  type NotificationSettingsInput,
} from "../domain.ts";
import {
  getDetailedBrowserCapabilities,
  registerPeriodicNotificationSync,
  requestNotificationPermission,
  runNotificationCheckNow,
  type BrowserCapabilities,
} from "../features/notifications/runtime.ts";
import { navigate } from "../routes.ts";
import { useWorkspaceStore } from "../store.ts";

type ThemeNotificationsPageProps = {
  themeId: string;
};

const emptyFormState: NotificationSettingsInput = {
  enabled: false,
  channels: {
    checkIn: {
      enabled: false,
      rules: [],
    },
    review: {
      enabled: false,
      rules: [],
    },
  },
  lastCheckedAt: null,
  lastNotifiedSlotId: null,
};

const weekdayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

function formatTimestamp(value: number | null | undefined) {
  if (!value) {
    return "未実行";
  }

  return new Date(value).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toFormState(settings: {
  enabled: boolean;
  channels: NotificationSettingsInput["channels"];
  lastCheckedAt: number | null;
  lastNotifiedSlotId: string | null;
}) {
  return {
    enabled: settings.enabled,
    channels: {
      checkIn: {
        enabled: settings.channels.checkIn.enabled,
        rules: settings.channels.checkIn.rules.map((rule) => ({ ...rule })),
      },
      review: {
        enabled: settings.channels.review.enabled,
        rules: settings.channels.review.rules.map((rule) => ({ ...rule })),
      },
    },
    lastCheckedAt: settings.lastCheckedAt,
    lastNotifiedSlotId: settings.lastNotifiedSlotId,
  } satisfies NotificationSettingsInput;
}

function createDefaultRule(channel: NotificationChannel): NotificationRule {
  if (channel === "check-in") {
    return {
      id: createEntityId("rule"),
      type: "every-n-days",
      intervalDays: 2,
      anchorDate: new Date().toISOString().slice(0, 10),
      times: ["09:00"],
    };
  }

  return {
    id: createEntityId("rule"),
    type: "weekly-days",
    weekdays: [1, 4],
    times: ["20:00"],
  };
}

export function ThemeNotificationsPage({ themeId }: ThemeNotificationsPageProps) {
  const { isBusy, setBusy, setStatusMessage } = useWorkspaceStore();
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  const [formState, setFormState] = useState<NotificationSettingsInput>(emptyFormState);
  const [runSummary, setRunSummary] = useState<string>("");

  const detail = useLiveQuery(async () => {
    const theme = await db.themes.get(themeId);
    if (!theme) {
      return null;
    }

    const settings = theme.notificationSettingsId
      ? await db.notificationSettings.get(theme.notificationSettingsId)
      : undefined;

    return {
      settings,
      theme,
    };
  }, [themeId]);

  useEffect(() => {
    let cancelled = false;

    getDetailedBrowserCapabilities()
      .then((value) => {
        if (!cancelled) {
          setCapabilities(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCapabilities(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (detail?.settings) {
      setFormState(toFormState(detail.settings));
      return;
    }

    if (detail) {
      setFormState(emptyFormState);
    }
  }, [detail]);

  const hasSettings = Boolean(detail?.settings);
  const lastRuntimeSummary = useMemo(() => {
    if (!detail?.settings) {
      return null;
    }

    return {
      lastCheckedAt: formatTimestamp(detail.settings.lastCheckedAt),
      lastNotifiedSlotId: detail.settings.lastNotifiedSlotId ?? "未通知",
    };
  }, [detail]);

  const updateChannel = (
    channel: NotificationChannel,
    updater: (channelState: NotificationSettingsInput["channels"]["checkIn"]) => NotificationSettingsInput["channels"]["checkIn"],
  ) => {
    setFormState((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [channel === "check-in" ? "checkIn" : "review"]: updater(
          current.channels[channel === "check-in" ? "checkIn" : "review"],
        ),
      },
    }));
  };

  const updateRule = (
    channel: NotificationChannel,
    ruleId: string,
    updater: (rule: NotificationRule) => NotificationRule,
  ) => {
    updateChannel(channel, (channelState) => ({
      ...channelState,
      rules: channelState.rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
    }));
  };

  const handlePrepareSettings = async () => {
    setBusy(true);
    try {
      const { settings } = await ensureThemeNotificationSettings(themeId);
      setStatusMessage(`通知設定 ${settings.id} をこのテーマに紐付けました。`);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!detail?.settings) {
      return;
    }

    setBusy(true);
    try {
      await updateNotificationSettingsRecord(detail.settings.id, formState);
      setStatusMessage("通知設定を保存しました。");
    } finally {
      setBusy(false);
    }
  };

  const handlePermissionRequest = async () => {
    setBusy(true);
    try {
      const permission = await requestNotificationPermission();
      setStatusMessage(`通知権限: ${permission}`);
      setCapabilities(await getDetailedBrowserCapabilities());
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterPeriodicSync = async () => {
    setBusy(true);
    try {
      await registerPeriodicNotificationSync();
      setStatusMessage("Periodic Sync を登録しました。");
      setCapabilities(await getDetailedBrowserCapabilities());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Periodic Sync を登録できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const handleRunCheck = async () => {
    setBusy(true);
    try {
      const result = await runNotificationCheckNow();
      const summary =
        result.notifications.length > 0
          ? `通知候補 ${result.notifications.length} 件: ${result.notifications.map((item) => item.slotId).join(", ")}`
          : "現在時刻では通知候補はありませんでした。";
      setRunSummary(summary);
      setStatusMessage(summary);
    } finally {
      setBusy(false);
    }
  };

  if (detail === null) {
    return <Alert severity="error">対象のテーマが見つかりません。</Alert>;
  }

  if (!detail) {
    return <Alert severity="info">通知設定を読み込んでいます。</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">{detail.theme.issue}</Typography>
            <Typography color="text.secondary">
              このテーマ向けの `check-in` / `review` 通知ルールを設定します。
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="text" onClick={() => navigate({ name: "theme-detail", themeId })}>
                詳細へ戻る
              </Button>
              <Button variant="outlined" onClick={() => navigate({ name: "theme-review", themeId })}>
                振り返りを記録
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">ブラウザ状態</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Service Worker: ${capabilities?.serviceWorkerSupported ? "yes" : "no"}`} />
              <Chip label={`Notification: ${capabilities?.notificationSupported ? "yes" : "no"}`} />
              <Chip label={`Periodic Sync: ${capabilities?.periodicSyncSupported ? "yes" : "no"}`} />
              <Chip label={`Permission: ${capabilities?.notificationPermission ?? "unknown"}`} color="secondary" />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="outlined" onClick={handlePermissionRequest} disabled={isBusy}>
                通知権限を確認
              </Button>
              <Button variant="outlined" onClick={handleRegisterPeriodicSync} disabled={isBusy}>
                Periodic Sync を登録
              </Button>
              <Button variant="contained" onClick={handleRunCheck} disabled={isBusy}>
                通知チェックを手動実行
              </Button>
            </Stack>
            {runSummary ? <Alert severity="info">{runSummary}</Alert> : null}
          </Stack>
        </CardContent>
      </Card>

      {!hasSettings ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Alert severity="info">
                まだこのテーマには通知設定が紐付いていません。設定レコードを作ってから編集します。
              </Alert>
              <Button variant="contained" onClick={handlePrepareSettings} disabled={isBusy}>
                通知設定を準備する
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography variant="h6">通知ルール</Typography>
                <Typography color="text.secondary">
                  ルールは `every-n-days` と `weekly-days` を使い分けられます。時刻は `HH:MM` をカンマ区切りで入力します。
                </Typography>
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={formState.enabled}
                    onChange={(_, checked) => setFormState((current) => ({ ...current, enabled: checked }))}
                  />
                }
                label="通知を有効にする"
              />
              <Divider />
              <ChannelEditor
                channel="check-in"
                channelLabel="check-in"
                state={formState.channels.checkIn}
                onAddRule={() =>
                  updateChannel("check-in", (channelState) => ({
                    ...channelState,
                    rules: [...channelState.rules, createDefaultRule("check-in")],
                  }))
                }
                onChangeEnabled={(checked) =>
                  updateChannel("check-in", (channelState) => ({ ...channelState, enabled: checked }))
                }
                onRemoveRule={(ruleId) =>
                  updateChannel("check-in", (channelState) => ({
                    ...channelState,
                    rules: channelState.rules.filter((rule) => rule.id !== ruleId),
                  }))
                }
                onUpdateRule={(ruleId, updater) => updateRule("check-in", ruleId, updater)}
              />
              <Divider />
              <ChannelEditor
                channel="review"
                channelLabel="review"
                state={formState.channels.review}
                onAddRule={() =>
                  updateChannel("review", (channelState) => ({
                    ...channelState,
                    rules: [...channelState.rules, createDefaultRule("review")],
                  }))
                }
                onChangeEnabled={(checked) =>
                  updateChannel("review", (channelState) => ({ ...channelState, enabled: checked }))
                }
                onRemoveRule={(ruleId) =>
                  updateChannel("review", (channelState) => ({
                    ...channelState,
                    rules: channelState.rules.filter((rule) => rule.id !== ruleId),
                  }))
                }
                onUpdateRule={(ruleId, updater) => updateRule("review", ruleId, updater)}
              />
              <Divider />
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1">実行状態</Typography>
                  <Typography color="text.secondary" variant="body2">
                    最終チェック: {lastRuntimeSummary?.lastCheckedAt}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    最終通知スロット: {lastRuntimeSummary?.lastNotifiedSlotId}
                  </Typography>
                </Stack>
              </Paper>
              <Button variant="contained" onClick={handleSave} disabled={isBusy}>
                通知設定を保存
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

type ChannelEditorProps = {
  channel: NotificationChannel;
  channelLabel: string;
  state: NotificationSettingsInput["channels"]["checkIn"];
  onChangeEnabled: (checked: boolean) => void;
  onAddRule: () => void;
  onRemoveRule: (ruleId: string) => void;
  onUpdateRule: (ruleId: string, updater: (rule: NotificationRule) => NotificationRule) => void;
};

function ChannelEditor({
  channel,
  channelLabel,
  state,
  onAddRule,
  onChangeEnabled,
  onRemoveRule,
  onUpdateRule,
}: ChannelEditorProps) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between">
        <FormControlLabel
          control={<Switch checked={state.enabled} onChange={(_, checked) => onChangeEnabled(checked)} />}
          label={`${channelLabel} を有効にする`}
        />
        <Button variant="outlined" onClick={onAddRule}>
          ルールを追加
        </Button>
      </Stack>
      {state.rules.length === 0 ? (
        <Typography color="text.secondary">ルールはまだありません。</Typography>
      ) : (
        state.rules.map((rule) => (
          <Paper key={rule.id} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Select
                  name={`${channelLabel}-${rule.id}-type`}
                  size="small"
                  value={rule.type}
                  onChange={(event) => {
                    const nextType = event.target.value as NotificationRule["type"];
                    onUpdateRule(rule.id, () =>
                      nextType === "every-n-days"
                        ? {
                            id: rule.id,
                            type: "every-n-days",
                            intervalDays: 2,
                            anchorDate: new Date().toISOString().slice(0, 10),
                            times: ["09:00"],
                          }
                        : {
                            id: rule.id,
                            type: "weekly-days",
                            weekdays: [1],
                            times: ["20:00"],
                          },
                    );
                  }}
                >
                  <MenuItem value="every-n-days">every-n-days</MenuItem>
                  <MenuItem value="weekly-days">weekly-days</MenuItem>
                </Select>
                <TextField
                  name={`${channelLabel}-${rule.id}-times`}
                  size="small"
                  fullWidth
                  label="times"
                  value={rule.times.join(", ")}
                  onChange={(event) =>
                    onUpdateRule(rule.id, (current) => ({
                      ...current,
                      times: parseList(event.target.value),
                    }))
                  }
                />
                <Button color="inherit" onClick={() => onRemoveRule(rule.id)}>
                  削除
                </Button>
              </Stack>
              {rule.type === "every-n-days" ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    name={`${channelLabel}-${rule.id}-interval`}
                    size="small"
                    label="intervalDays"
                    type="number"
                    value={rule.intervalDays}
                    onChange={(event) =>
                      onUpdateRule(rule.id, (current) => ({
                        ...(current.type === "every-n-days" ? current : createDefaultRule(channel)),
                        type: "every-n-days",
                        intervalDays: Number(event.target.value) || 1,
                        anchorDate:
                          current.type === "every-n-days"
                            ? current.anchorDate
                            : new Date().toISOString().slice(0, 10),
                      }))
                    }
                  />
                  <TextField
                    name={`${channelLabel}-${rule.id}-anchor`}
                    size="small"
                    label="anchorDate"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={rule.anchorDate}
                    onChange={(event) =>
                      onUpdateRule(rule.id, (current) => ({
                        ...(current.type === "every-n-days" ? current : createDefaultRule(channel)),
                        type: "every-n-days",
                        intervalDays:
                          current.type === "every-n-days" ? current.intervalDays : 2,
                        anchorDate: event.target.value,
                      }))
                    }
                  />
                </Stack>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: {
                      xs: "repeat(2, minmax(0, 1fr))",
                      sm: "repeat(4, minmax(0, 1fr))",
                    },
                  }}
                >
                  {weekdayOptions.map((weekday) => {
                    const checked = rule.weekdays.includes(weekday.value);
                    return (
                      <FormControlLabel
                        key={weekday.value}
                        control={
                          <Switch
                            checked={checked}
                            onChange={(_, nextChecked) =>
                              onUpdateRule(rule.id, (current) => {
                                const weekdays =
                                  current.type === "weekly-days" ? current.weekdays : [];
                                return {
                                  id: current.id,
                                  type: "weekly-days",
                                  weekdays: nextChecked
                                    ? [...weekdays, weekday.value]
                                    : weekdays.filter((value) => value !== weekday.value),
                                  times: current.times,
                                };
                              })
                            }
                          />
                        }
                        label={weekday.label}
                      />
                    );
                  })}
                </Box>
              )}
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
}
