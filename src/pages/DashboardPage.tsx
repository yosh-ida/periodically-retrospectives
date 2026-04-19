import { useLiveQuery } from "dexie-react-hooks";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import {
  archiveTheme,
  createNotificationSettingsReference,
  db,
  seedPhase1DemoData,
} from "../db.ts";
import { navigate } from "../routes.ts";
import { useWorkspaceStore } from "../store.ts";
import { ThemeCard } from "../components/ThemeCard.tsx";

function formatLastReview(reviewedAt: number | undefined) {
  if (!reviewedAt) {
    return "振り返りなし";
  }

  return `直近レビュー: ${new Date(reviewedAt).toLocaleDateString("ja-JP")}`;
}

export function DashboardPage() {
  const { isBusy, setBusy, setStatusMessage, statusMessage } = useWorkspaceStore();
  const summary = useLiveQuery(async () => {
    const [themes, notificationSettings, reviews] = await Promise.all([
      db.themes.orderBy("updatedAt").reverse().toArray(),
      db.notificationSettings.orderBy("updatedAt").reverse().toArray(),
      db.reviews.orderBy("reviewedAt").reverse().toArray(),
    ]);

    return {
      notificationSettings,
      reviews,
      themes: themes.filter((theme) => !theme.isArchived),
    };
  }, []);

  const handleArchive = async (themeId: string, issue: string) => {
    if (!window.confirm(`「${issue}」を通常一覧から外しますか？`)) {
      return;
    }

    setBusy(true);
    try {
      await archiveTheme(themeId);
      setStatusMessage(`「${issue}」をアーカイブしました。履歴は保持されています。`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateReference = async () => {
    setBusy(true);
    try {
      const settings = await createNotificationSettingsReference();
      setStatusMessage(`通知設定参照 ${settings.id} を作成しました。`);
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = async () => {
    setBusy(true);
    try {
      await seedPhase1DemoData();
      setStatusMessage("サンプルデータを投入しました。テーマ詳細と通知参照の表示確認に使えます。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      {statusMessage ? <Alert severity="info">{statusMessage}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={1}>
            <Typography variant="overline">反省点</Typography>
            <Typography variant="h4">{summary?.themes.length ?? 0}</Typography>
            <Typography color="text.secondary" variant="body2">
              通常一覧に表示される反省点
            </Typography>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={1}>
            <Typography variant="overline">通知設定参照</Typography>
            <Typography variant="h4">{summary?.notificationSettings.length ?? 0}</Typography>
            <Typography color="text.secondary" variant="body2">
              テーマから参照できる通知設定
            </Typography>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={1}>
            <Typography variant="overline">振り返り履歴</Typography>
            <Typography variant="h4">{summary?.reviews.length ?? 0}</Typography>
            <Typography color="text.secondary" variant="body2">
              7 段階評価として保存された履歴の総数
            </Typography>
          </Stack>
        </Paper>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h5">反省点一覧</Typography>
                <Typography color="text.secondary">
                  アクティブなテーマだけを表示しています。詳細確認、振り返り記録、アーカイブができます。
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="outlined" onClick={handleCreateReference} disabled={isBusy}>
                  通知設定参照を追加
                </Button>
                <Button variant="text" onClick={handleSeed} disabled={isBusy}>
                  サンプル投入
                </Button>
                <Button variant="contained" onClick={() => navigate({ name: "theme-new" })}>
                  新しい反省点
                </Button>
              </Stack>
            </Stack>

            {(summary?.themes.length ?? 0) === 0 ? (
              <Alert severity="warning">
                まだ反省点がありません。まずは 1 件作成して運用を始めましょう。
              </Alert>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                }}
              >
                {summary?.themes.map((theme) => {
                  const linkedSettings = summary.notificationSettings.find(
                    (settings) => settings.id === theme.notificationSettingsId,
                  );
                  const lastReview = summary.reviews.find((review) => review.themeId === theme.id);

                  return (
                    <ThemeCard
                      key={theme.id}
                      id={theme.id}
                      issue={theme.issue}
                      cause={theme.cause}
                      goal={theme.goal}
                      notificationLabel={
                        linkedSettings
                          ? `通知設定: ${linkedSettings.enabled ? "有効" : "無効"}`
                          : "通知設定: 未関連"
                      }
                      reviewLabel={formatLastReview(lastReview?.reviewedAt)}
                      onArchive={() => handleArchive(theme.id, theme.issue)}
                    />
                  );
                })}
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">最近の振り返り履歴</Typography>
            <Typography color="text.secondary">最新 5 件の時点評価を一覧で確認できます。</Typography>
            <Divider />
            <Stack spacing={1.5}>
              {summary?.reviews.length ? (
                summary.reviews.slice(0, 5).map((review) => (
                  <Paper key={review.id} variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2">
                      {new Date(review.reviewedAt).toLocaleString("ja-JP")} / 評価 {review.score}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {review.note || "メモなし"}
                    </Typography>
                  </Paper>
                ))
              ) : (
                <Typography color="text.secondary">まだ振り返り履歴はありません。</Typography>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
