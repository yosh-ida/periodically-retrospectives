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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";

import { db } from "../db.ts";
import { navigate } from "../routes.ts";
import {
  aggregateReviewsForChart,
  type ChartInterval,
  type ChartPoint,
} from "../reviewChart.ts";

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
  const [interval, setInterval] = useState<ChartInterval>("raw");
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);

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

  const chartPoints = useMemo(
    () => aggregateReviewsForChart(detail?.reviews ?? [], interval),
    [detail?.reviews, interval],
  );
  const selectedPoint =
    chartPoints.find((point) => point.periodKey === selectedPeriodKey) ?? null;

  if (detail === null) {
    return <Alert severity="error">対象の反省点が見つかりませんでした。</Alert>;
  }

  if (!detail) {
    return <Alert severity="info">反省点を読み込んでいます。</Alert>;
  }

  const handleIntervalChange = (_event: React.MouseEvent<HTMLElement>, value: ChartInterval | null) => {
    if (!value) {
      return;
    }

    setInterval(value);
    setSelectedPeriodKey(null);
  };

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
                onClick={() => navigate({ name: "theme-review", themeId: detail.theme.id })}
              >
                振り返りを記録
              </Button>
              <Button
                variant="outlined"
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
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography variant="h5">振り返り推移</Typography>
                <Typography color="text.secondary">
                  7 段階評価の推移を確認し、メモ付きの点から補足内容を開けます。
                </Typography>
              </Box>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={interval}
                onChange={handleIntervalChange}
              >
                <ToggleButton value="raw">そのまま</ToggleButton>
                <ToggleButton value="weekly">週単位</ToggleButton>
                <ToggleButton value="monthly">月単位</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Divider />
            {chartPoints.length ? (
              <ReviewTrendChart
                points={chartPoints}
                selectedPeriodKey={selectedPoint?.periodKey ?? null}
                onSelectPoint={setSelectedPeriodKey}
              />
            ) : (
              <Alert severity="info">まだ振り返り履歴はありません。最初の 1 件を記録して推移を作りましょう。</Alert>
            )}
            {selectedPoint?.notes.length ? (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1">選択したデータ点のメモ</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {selectedPoint.label} / score {selectedPoint.score}
                  </Typography>
                  {selectedPoint.notes.map((note) => (
                    <Paper key={note.id} variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2">
                        {formatDate(note.reviewedAt)}
                      </Typography>
                      <Typography color="text.secondary">{note.note}</Typography>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            ) : null}
            <Divider />
            <Typography variant="h6">振り返り履歴</Typography>
            {detail.reviews.length ? (
              <Stack spacing={1.5}>
                {detail.reviews.map((review) => (
                  <Paper key={review.id} variant="outlined" sx={{ p: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography>
                          score {review.score} / {formatDate(review.reviewedAt)}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          {review.note || "メモなし"}
                        </Typography>
                      </Box>
                      <Button
                        variant="text"
                        onClick={() => navigate({ name: "theme-review", themeId: detail.theme.id })}
                      >
                        振り返りページで確認
                      </Button>
                    </Stack>
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

type ReviewTrendChartProps = {
  points: ChartPoint[];
  selectedPeriodKey: string | null;
  onSelectPoint: (periodKey: string | null) => void;
};

function ReviewTrendChart({
  onSelectPoint,
  points,
  selectedPeriodKey,
}: ReviewTrendChartProps) {
  const width = 720;
  const height = 260;
  const paddingX = 36;
  const paddingTop = 20;
  const paddingBottom = 36;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const xStep = points.length > 1 ? chartWidth / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => {
    const x = paddingX + index * xStep;
    const y = paddingTop + ((7 - point.score) / 6) * chartHeight;
    return { point, x, y };
  });

  const polylinePoints = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <Stack spacing={2}>
      <Box sx={{ overflowX: "auto" }}>
        <Box
          component="svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          sx={{ width: "100%", minWidth: 360, display: "block" }}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((score) => {
            const y = paddingTop + ((7 - score) / 6) * chartHeight;
            return (
              <g key={score}>
                <line
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                  stroke="rgba(29, 54, 58, 0.16)"
                  strokeDasharray="4 4"
                />
                <text x={10} y={y + 4} fontSize="12" fill="#486165">
                  {score}
                </text>
              </g>
            );
          })}
          {coordinates.length > 1 ? (
            <polyline
              fill="none"
              points={polylinePoints}
              stroke="#1f5f5b"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {coordinates.map(({ point, x, y }) => {
            const isSelected = point.periodKey === selectedPeriodKey;
            const hasNotes = point.notes.length > 0;
            return (
              <g key={point.periodKey}>
                {hasNotes ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 12 : 10}
                    fill="rgba(181, 105, 77, 0.18)"
                  />
                ) : null}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 8 : 6}
                  fill={hasNotes ? "#b5694d" : "#1f5f5b"}
                  stroke="#ffffff"
                  strokeWidth="2"
                  onClick={() => onSelectPoint(hasNotes ? point.periodKey : null)}
                  style={{ cursor: hasNotes ? "pointer" : "default" }}
                />
                <text x={x} y={height - 12} textAnchor="middle" fontSize="12" fill="#486165">
                  {point.label}
                </text>
              </g>
            );
          })}
        </Box>
      </Box>
      <Typography color="text.secondary" variant="body2">
        メモ付きの点は強調表示されます。点を選ぶと、その時点または集約期間のメモを確認できます。
      </Typography>
    </Stack>
  );
}
