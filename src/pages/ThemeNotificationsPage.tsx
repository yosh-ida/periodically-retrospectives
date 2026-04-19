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
  db,
  ensureThemeNotificationSettings,
  updateNotificationSettingsRecord,
} from "../db.ts";
import {
  createEntityId,
  type NotificationChannel,
  type NotificationRule,
  type NotificationSettingsInput,
} from "../domain.ts";
import {
  getPwaOnboardingMessage,
  getPwaRuntimeState,
  promptPwaInstall,
  registerPeriodicNotificationSync,
  registerPwaLifecycleListeners,
  requestNotificationPermission,
  runNotificationCheckNow,
  subscribeToPwaRuntimeState,
  type PwaRuntimeState,
} from "../features/notifications/runtime.ts";
import { describeNotificationRule } from "../features/notifications/ui.ts";
import { validateNotificationSetupAssignment } from "./themeFormMessages.ts";
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

function getLocalDateInputValue(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestamp(value: number | null | undefined) {
  if (!value) {
    return "まだ実行されていません";
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
      anchorDate: getLocalDateInputValue(),
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

function capabilityLabel(value: boolean | undefined) {
  return value ? "対応" : "未対応";
}

export function ThemeNotificationsPage({ themeId }: ThemeNotificationsPageProps) {
  const { isBusy, setBusy, setStatusMessage } = useWorkspaceStore();
  const [pwaState, setPwaState] = useState<PwaRuntimeState | null>(null);
  const [formState, setFormState] = useState<NotificationSettingsInput>(emptyFormState);
  const [runSummary, setRunSummary] = useState("");

  const detail = useLiveQuery(async () => {
    const theme = await db.themes.get(themeId);
    if (!theme) {
      return null;
    }

    try {
      validateNotificationSetupAssignment(theme.notificationSettingsId);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error("notification settings assignment is required"),
        theme,
      };
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

    const refresh = async () => {
      try {
        const nextState = await getPwaRuntimeState();
        if (!cancelled) {
          setPwaState(nextState);
        }
      } catch {
        if (!cancelled) {
          setPwaState(null);
        }
      }
    };

    registerPwaLifecycleListeners();
    void refresh();

    const unsubscribe = subscribeToPwaRuntimeState(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      unsubscribe();
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
  const onboardingMessage = pwaState ? getPwaOnboardingMessage(pwaState) : null;

  const runtimeSummary = useMemo(() => {
    if (!detail?.settings) {
      return null;
    }

    return {
      lastCheckedAt: formatTimestamp(detail.settings.lastCheckedAt),
      lastNotifiedSlotId: detail.settings.lastNotifiedSlotId ?? "まだ通知はありません",
    };
  }, [detail]);

  const refreshPwaState = async () => {
    try {
      setPwaState(await getPwaRuntimeState());
    } catch {
      setPwaState(null);
    }
  };

  const updateChannel = (
    channel: NotificationChannel,
    updater: (
      channelState: NotificationSettingsInput["channels"]["checkIn"],
    ) => NotificationSettingsInput["channels"]["checkIn"],
  ) => {
    const key = channel === "check-in" ? "checkIn" : "review";
    setFormState((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [key]: updater(current.channels[key]),
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
      setStatusMessage(`通知設定 ${settings.id} をこのテーマに関連づけました。`);
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
      await refreshPwaState();
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterPeriodicSync = async () => {
    setBusy(true);
    try {
      await registerPeriodicNotificationSync();
      setStatusMessage("periodic sync を登録しました。");
      await refreshPwaState();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "periodic sync の登録に失敗しました。",
      );
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
          ? `通知対象: ${result.notifications.map((item) => item.slotId).join(", ")}`
          : "現在通知対象のスロットはありません。";
      setRunSummary(summary);
      setStatusMessage(summary);
      await refreshPwaState();
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async () => {
    setBusy(true);
    try {
      const outcome = await promptPwaInstall();
      const message =
        outcome === "accepted"
          ? "PWA のインストールが受け付けられました。"
          : outcome === "dismissed"
            ? "PWA のインストールは見送られました。"
            : "PWA をこの環境ではインストールできません。";
      setStatusMessage(message);
      await refreshPwaState();
    } finally {
      setBusy(false);
    }
  };

  if (detail === null) {
    return <Alert severity="error">対象のテーマが見つかりませんでした。</Alert>;
  }

  if (!detail) {
    return <Alert severity="info">通知設定ページを読み込み中です。</Alert>;
  }

  if ("error" in detail && detail.error) {
    return <Alert severity="error">{detail.error.message}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">{detail.theme.issue}</Typography>
            <Typography color="text.secondary">
              このテーマに対する `check-in` / `review` 通知をまとめて調整します。
              設定を保存すると、PWA 側の確認導線から同じルールを使えるようになります。
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="text" onClick={() => navigate({ name: "theme-detail", themeId })}>
                詳細を見る
              </Button>
              <Button variant="outlined" onClick={() => navigate({ name: "theme-review", themeId })}>
                レビュー記録へ
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {onboardingMessage ? (
        <Alert severity={onboardingMessage.severity}>
          <strong>{onboardingMessage.title}</strong> {onboardingMessage.body}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            lg: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">PWA 状態</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`インストール: ${pwaState?.installStateLabel ?? "unknown"}`} color="secondary" />
                <Chip label={`表示モード: ${pwaState?.isStandalone ? "standalone" : "browser"}`} />
                <Chip label={`Service Worker: ${pwaState?.serviceWorkerStateLabel ?? "unknown"}`} />
                <Chip label={`Periodic Sync: ${pwaState?.periodicSyncStateLabel ?? "unknown"}`} />
              </Stack>
              <Typography color="text.secondary" variant="body2">
                Product ready では、インストール状態、通知許可、Periodic Sync の登録状況を
                ここで順番に確認できるようにしています。
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="contained"
                  onClick={handleInstall}
                  disabled={isBusy || !pwaState?.canInstall}
                >
                  PWA をインストール
                </Button>
                <Button variant="text" onClick={() => void refreshPwaState()} disabled={isBusy}>
                  状態を更新
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">ブラウザ対応と確認操作</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Service Worker: ${capabilityLabel(pwaState?.serviceWorkerSupported)}`} />
                <Chip label={`Notification: ${capabilityLabel(pwaState?.notificationSupported)}`} />
                <Chip label={`Periodic Sync: ${capabilityLabel(pwaState?.periodicSyncSupported)}`} />
                <Chip label={`通知権限: ${pwaState?.notificationPermission ?? "unknown"}`} color="secondary" />
              </Stack>
              <Typography color="text.secondary" variant="body2">
                右の操作は、権限付与、Periodic Sync 登録、即時実行の順で使う想定です。
                console error が出ないかも最終確認で見ます。
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="outlined" onClick={handlePermissionRequest} disabled={isBusy}>
                  通知権限をリクエスト
                </Button>
                <Button variant="outlined" onClick={handleRegisterPeriodicSync} disabled={isBusy}>
                  Periodic Sync を登録
                </Button>
                <Button variant="contained" onClick={handleRunCheck} disabled={isBusy}>
                  今すぐ通知判定を実行
                </Button>
              </Stack>
              {runSummary ? <Alert severity="info">{runSummary}</Alert> : null}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {!hasSettings ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Alert severity="info">
                このテーマにはまだ通知設定参照がありません。先に関連づけを作成すると、
                下の画面でそのまま頻度と曜日を設定できます。
              </Alert>
              <Button variant="contained" onClick={handlePrepareSettings} disabled={isBusy}>
                通知設定を作成して関連づける
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
                  `every-n-days` は基準日からの間隔、`weekly-days` は曜日固定で動きます。
                  時刻は `HH:MM` 形式でカンマ区切り入力です。
                </Typography>
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={formState.enabled}
                    onChange={(_, checked) =>
                      setFormState((current) => ({ ...current, enabled: checked }))
                    }
                  />
                }
                label="このテーマ全体で通知を有効にする"
              />

              <Divider />

              <ChannelEditor
                channel="check-in"
                channelLabel="check-in"
                description="日々の軽い振り返り用です。まずは 1 日 1 回の単純な時刻から始めると安定します。"
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
                description="週次や定期レビュー向けです。曜日ベースで固定したい時はこちらが向いています。"
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
                  <Typography variant="subtitle1">実行メモ</Typography>
                  <Typography color="text.secondary" variant="body2">
                    最終判定時刻: {runtimeSummary?.lastCheckedAt}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    最後に通知したスロット: {runtimeSummary?.lastNotifiedSlotId}
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
  description: string;
  state: NotificationSettingsInput["channels"]["checkIn"];
  onChangeEnabled: (checked: boolean) => void;
  onAddRule: () => void;
  onRemoveRule: (ruleId: string) => void;
  onUpdateRule: (ruleId: string, updater: (rule: NotificationRule) => NotificationRule) => void;
};

function ChannelEditor({
  channel,
  channelLabel,
  description,
  state,
  onAddRule,
  onChangeEnabled,
  onRemoveRule,
  onUpdateRule,
}: ChannelEditorProps) {
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6">{channelLabel}</Typography>
        <Typography color="text.secondary" variant="body2">
          {description}
        </Typography>
      </Stack>

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
        <Alert severity="info">
          まだルールがありません。最小構成なら 1 つだけ追加して保存すれば十分です。
        </Alert>
      ) : (
        state.rules.map((rule) => (
          <Paper key={rule.id} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                justifyContent="space-between"
              >
                <Typography variant="subtitle2">{describeNotificationRule(rule)}</Typography>
                <Button color="inherit" onClick={() => onRemoveRule(rule.id)}>
                  削除
                </Button>
              </Stack>

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
                            anchorDate: getLocalDateInputValue(),
                            times: ["09:00"],
                          }
                        : {
                            id: rule.id,
                            type: "weekly-days",
                            weekdays: [1, 4],
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
                  label="時刻"
                  placeholder="09:00, 18:30"
                  helperText="HH:MM 形式で入力し、複数ある場合はカンマ区切りにします。"
                  value={rule.times.join(", ")}
                  onChange={(event) =>
                    onUpdateRule(rule.id, (current) => ({
                      ...current,
                      times: parseList(event.target.value),
                    }))
                  }
                />
              </Stack>

              {rule.type === "every-n-days" ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    name={`${channelLabel}-${rule.id}-interval`}
                    size="small"
                    label="間隔日数"
                    type="number"
                    helperText="1 以上の整数です。"
                    value={rule.intervalDays}
                    onChange={(event) =>
                      onUpdateRule(rule.id, (current) => ({
                        ...(current.type === "every-n-days" ? current : createDefaultRule(channel)),
                        type: "every-n-days",
                        intervalDays: Number(event.target.value) || 1,
                        anchorDate:
                          current.type === "every-n-days"
                            ? current.anchorDate
                            : getLocalDateInputValue(),
                      }))
                    }
                  />
                  <TextField
                    name={`${channelLabel}-${rule.id}-anchor`}
                    size="small"
                    label="基準日"
                    type="date"
                    helperText="この日から n 日ごとの計算を始めます。"
                    InputLabelProps={{ shrink: true }}
                    value={rule.anchorDate}
                    onChange={(event) =>
                      onUpdateRule(rule.id, (current) => ({
                        ...(current.type === "every-n-days" ? current : createDefaultRule(channel)),
                        type: "every-n-days",
                        intervalDays: current.type === "every-n-days" ? current.intervalDays : 2,
                        anchorDate: event.target.value,
                      }))
                    }
                  />
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  <Typography color="text.secondary" variant="body2">
                    曜日を選ぶと、選択した曜日の時刻に通知対象になります。
                  </Typography>
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
                                      ? [...new Set([...weekdays, weekday.value])].sort()
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
                </Stack>
              )}
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
}
