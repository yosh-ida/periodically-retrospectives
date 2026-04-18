import { useLiveQuery } from "dexie-react-hooks";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { db } from "../db.ts";
import { navigate } from "../routes.ts";

type ThemeDetailPageProps = {
  themeId: string;
};

function formatDate(value: number) {
  return new Date(value).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ThemeDetailPage({ themeId }: ThemeDetailPageProps) {
  const detail = useLiveQuery(async () => {
    const theme = await db.themes.get(themeId);
    if (!theme) {
      return null;
    }

    const [notificationSettings, reviews] = await Promise.all([
      theme.notificationSettingsId
        ? db.notificationSettings.get(theme.notificationSettingsId)
        : Promise.resolve(undefined),
      db.reviews.where("themeId").equals(themeId).toArray(),
    ]);

    return {
      notificationSettings,
      reviews: reviews.sort((left, right) => right.reviewedAt - left.reviewedAt),
      theme,
    };
  }, [themeId]);

  if (detail === null) {
    return <Alert severity="error">対象の反省点が見つかりませんでした。</Alert>;
  }

  if (!detail) {
    return <Alert severity="info">反省点を読み込んでいます。</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Typography variant="h4">{detail.theme.issue}</Typography>
            <Typography color="text.secondary">
              作成日 {formatDate(detail.theme.createdAt)} / 更新日 {formatDate(detail.theme.updatedAt)}
            </Typography>
            <Divider />
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="overline">原因</Typography>
                <Typography>{detail.theme.cause}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="overline">ゴール</Typography>
                <Typography>{detail.theme.goal}</Typography>
              </Paper>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={() => navigate({ name: "theme-edit", themeId: detail.theme.id })}
              >
                編集する
              </Button>
              <Button variant="text" onClick={() => navigate({ name: "dashboard" })}>
                ダッシュボードへ戻る
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">通知設定との関連づけ</Typography>
            {detail.notificationSettings ? (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography>参照 ID: {detail.notificationSettings.id}</Typography>
                <Typography color="text.secondary" variant="body2">
                  状態: {detail.notificationSettings.enabled ? "enabled" : "disabled"}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  check-in rules: {detail.notificationSettings.channels.checkIn.rules.length}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  review rules: {detail.notificationSettings.channels.review.rules.length}
                </Typography>
              </Paper>
            ) : (
              <Alert severity="info">
                この反省点には通知設定が紐づいていません。編集画面からあとで関連づけできます。
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">振り返り履歴</Typography>
            <Typography color="text.secondary">
              グラフと 7 段階評価入力は Phase 3 で追加します。現時点では保存済み履歴だけ確認できます。
            </Typography>
            <Divider />
            {detail.reviews.length ? (
              <Stack spacing={1.5}>
                {detail.reviews.map((review) => (
                  <Paper key={review.id} variant="outlined" sx={{ p: 2.5 }}>
                    <Typography>
                      score {review.score} / {formatDate(review.reviewedAt)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {review.note || "メモなし"}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">まだ振り返り履歴はありません。</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
