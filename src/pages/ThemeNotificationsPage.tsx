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
  getPwaRuntimeState,
  promptPwaInstall,
  registerPeriodicNotificationSync,
  registerPwaLifecycleListeners,
  requestNotificationPermission,
  runNotificationCheckNow,
  subscribeToPwaRuntimeState,
  type PwaRuntimeState,
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
    return "Not checked yet";
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
  const [pwaState, setPwaState] = useState<PwaRuntimeState | null>(null);
  const [formState, setFormState] = useState<NotificationSettingsInput>(emptyFormState);
  const [runSummary, setRunSummary] = useState("");

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
  const runtimeSummary = useMemo(() => {
    if (!detail?.settings) {
      return null;
    }

    return {
      lastCheckedAt: formatTimestamp(detail.settings.lastCheckedAt),
      lastNotifiedSlotId: detail.settings.lastNotifiedSlotId ?? "No notification yet",
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
      setStatusMessage(`Prepared notification settings ${settings.id}.`);
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
      setStatusMessage("Saved notification settings.");
    } finally {
      setBusy(false);
    }
  };

  const handlePermissionRequest = async () => {
    setBusy(true);
    try {
      const permission = await requestNotificationPermission();
      setStatusMessage(`Notification permission: ${permission}`);
      await refreshPwaState();
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterPeriodicSync = async () => {
    setBusy(true);
    try {
      await registerPeriodicNotificationSync();
      setStatusMessage("Registered periodic sync.");
      await refreshPwaState();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to register periodic sync.",
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
          ? `Notifications: ${result.notifications.map((item) => item.slotId).join(", ")}`
          : "No notifications are due right now.";
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
          ? "PWA install prompt accepted."
          : outcome === "dismissed"
            ? "PWA install prompt dismissed."
            : "PWA install prompt is not available.";
      setStatusMessage(message);
      await refreshPwaState();
    } finally {
      setBusy(false);
    }
  };

  if (detail === null) {
    return <Alert severity="error">Theme not found.</Alert>;
  }

  if (!detail) {
    return <Alert severity="info">Loading notification settings...</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">{detail.theme.issue}</Typography>
            <Typography color="text.secondary">
              Configure independent `check-in` and `review` rules for this theme.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="text" onClick={() => navigate({ name: "theme-detail", themeId })}>
                Open detail
              </Button>
              <Button variant="outlined" onClick={() => navigate({ name: "theme-review", themeId })}>
                Open review editor
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">PWA status</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Install: ${pwaState?.installStateLabel ?? "unknown"}`} color="secondary" />
              <Chip label={`Display: ${pwaState?.isStandalone ? "standalone" : "browser"}`} />
              <Chip label={`SW control: ${pwaState?.serviceWorkerStateLabel ?? "unknown"}`} />
              <Chip label={`Periodic tag: ${pwaState?.periodicSyncStateLabel ?? "unknown"}`} />
            </Stack>
            <Typography color="text.secondary" variant="body2">
              This section reflects the installed-PWA flow: install prompt availability,
              standalone mode, Service Worker control, and the
              `reflection-notification-check` tag.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={handleInstall}
                disabled={isBusy || !pwaState?.canInstall}
              >
                Install app
              </Button>
              <Button variant="text" onClick={() => void refreshPwaState()} disabled={isBusy}>
                Refresh status
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Browser capabilities</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Service Worker: ${pwaState?.serviceWorkerSupported ? "yes" : "no"}`} />
              <Chip label={`Notification: ${pwaState?.notificationSupported ? "yes" : "no"}`} />
              <Chip label={`Periodic Sync: ${pwaState?.periodicSyncSupported ? "yes" : "no"}`} />
              <Chip label={`Permission: ${pwaState?.notificationPermission ?? "unknown"}`} color="secondary" />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="outlined" onClick={handlePermissionRequest} disabled={isBusy}>
                Request notification permission
              </Button>
              <Button variant="outlined" onClick={handleRegisterPeriodicSync} disabled={isBusy}>
                Register periodic sync
              </Button>
              <Button variant="contained" onClick={handleRunCheck} disabled={isBusy}>
                Run notification check
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
                This theme does not have a notification settings record yet. Create one
                before editing rules.
              </Alert>
              <Button variant="contained" onClick={handlePrepareSettings} disabled={isBusy}>
                Prepare notification settings
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography variant="h6">Notification rules</Typography>
                <Typography color="text.secondary">
                  Use `every-n-days` and `weekly-days`. Enter multiple times as comma
                  separated `HH:MM`.
                </Typography>
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={formState.enabled}
                    onChange={(_, checked) => setFormState((current) => ({ ...current, enabled: checked }))}
                  />
                }
                label="Enable notifications for this theme"
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
                  <Typography variant="subtitle1">Runtime summary</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Last checked: {runtimeSummary?.lastCheckedAt}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Last notified slot: {runtimeSummary?.lastNotifiedSlotId}
                  </Typography>
                </Stack>
              </Paper>
              <Button variant="contained" onClick={handleSave} disabled={isBusy}>
                Save notification settings
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
          label={`Enable ${channelLabel}`}
        />
        <Button variant="outlined" onClick={onAddRule}>
          Add rule
        </Button>
      </Stack>
      {state.rules.length === 0 ? (
        <Typography color="text.secondary">No rules yet.</Typography>
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
                  Remove
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
                        intervalDays: current.type === "every-n-days" ? current.intervalDays : 2,
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
