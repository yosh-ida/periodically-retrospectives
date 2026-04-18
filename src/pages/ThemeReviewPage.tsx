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
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { createReview, db, updateReview } from "../db.ts";
import type { ReviewScore } from "../domain.ts";
import { navigate } from "../routes.ts";
import { useWorkspaceStore } from "../store.ts";

type ThemeReviewPageProps = {
  themeId: string;
};

const scoreOptions: ReviewScore[] = [1, 2, 3, 4, 5, 6, 7];

type ReviewFormValue = {
  score: ReviewScore;
  note: string;
  reviewedAt: string;
};

function formatDateTimeLocal(value: number) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseReviewedAt(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    throw new Error("日時の形式が正しくありません。");
  }

  return timestamp;
}

export function ThemeReviewPage({ themeId }: ThemeReviewPageProps) {
  const { isBusy, setBusy, setStatusMessage } = useWorkspaceStore();
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<ReviewFormValue>({
    score: 4,
    note: "",
    reviewedAt: formatDateTimeLocal(Date.now()),
  });
  const [errorMessage, setErrorMessage] = useState("");

  const data = useLiveQuery(async () => {
    const theme = await db.themes.get(themeId);
    if (!theme) {
      return null;
    }

    const reviews = await db.reviews.where("themeId").equals(themeId).reverse().sortBy("reviewedAt");

    return {
      theme,
      reviews: reviews.reverse(),
    };
  }, [themeId]);

  const editingReview = useMemo(
    () => data?.reviews.find((review) => review.id === editingReviewId) ?? null,
    [data?.reviews, editingReviewId],
  );

  useEffect(() => {
    if (!editingReview) {
      setFormValue((current) => ({
        ...current,
        reviewedAt: formatDateTimeLocal(Date.now()),
      }));
      return;
    }

    setFormValue({
      score: editingReview.score,
      note: editingReview.note,
      reviewedAt: formatDateTimeLocal(editingReview.reviewedAt),
    });
  }, [editingReview]);

  if (data === null) {
    return <Alert severity="error">対象の反省点が見つかりませんでした。</Alert>;
  }

  if (!data) {
    return <Alert severity="info">振り返りページを読み込んでいます。</Alert>;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setBusy(true);

    try {
      const payload = {
        score: formValue.score,
        note: formValue.note,
        reviewedAt: parseReviewedAt(formValue.reviewedAt),
      };

      if (editingReviewId) {
        await updateReview(editingReviewId, payload);
        setStatusMessage(`「${data.theme.issue}」の振り返りを更新しました。`);
      } else {
        await createReview({
          themeId: data.theme.id,
          ...payload,
        });
        setStatusMessage(`「${data.theme.issue}」の振り返りを保存しました。`);
      }

      navigate({ name: "theme-detail", themeId: data.theme.id });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "振り返りの保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectReview = (reviewId: string) => {
    setEditingReviewId(reviewId);
    setErrorMessage("");
  };

  const handleStartNew = () => {
    setEditingReviewId(null);
    setFormValue({
      score: 4,
      note: "",
      reviewedAt: formatDateTimeLocal(Date.now()),
    });
    setErrorMessage("");
  };

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            <Stack spacing={1}>
              <Typography variant="h4">{data.theme.issue}</Typography>
              <Typography color="text.secondary">{data.theme.goal}</Typography>
              <Typography color="text.secondary" variant="body2">
                その時点の達成度を 1 から 7 で記録します。必要なら過去の記録を選んで更新できます。
              </Typography>
            </Stack>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

            <Stack spacing={1}>
              <Typography variant="subtitle1">7 段階評価</Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "repeat(4, minmax(0, 1fr))",
                    sm: "repeat(7, minmax(0, 1fr))",
                  },
                }}
              >
                {scoreOptions.map((score) => (
                  <Button
                    key={score}
                    variant={formValue.score === score ? "contained" : "outlined"}
                    color={formValue.score === score ? "secondary" : "primary"}
                    onClick={() => setFormValue((current) => ({ ...current, score }))}
                  >
                    {score}
                  </Button>
                ))}
              </Box>
            </Stack>

            <TextField
              label="記録日時"
              type="datetime-local"
              value={formValue.reviewedAt}
              onChange={(event) =>
                setFormValue((current) => ({ ...current, reviewedAt: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="メモ"
              value={formValue.note}
              onChange={(event) =>
                setFormValue((current) => ({ ...current, note: event.target.value }))
              }
              minRows={4}
              multiline
              placeholder="今回の気づきや状況のメモを残せます"
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button type="submit" variant="contained" disabled={isBusy}>
                {editingReviewId ? "更新して詳細へ戻る" : "保存して詳細へ戻る"}
              </Button>
              <Button variant="outlined" onClick={handleStartNew} disabled={isBusy}>
                新しい記録に切り替える
              </Button>
              <Button variant="text" onClick={() => navigate({ name: "theme-detail", themeId })}>
                詳細へ戻る
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">過去の振り返り</Typography>
            <Typography color="text.secondary">
              既存記録を選ぶと、フォームに値を読み込んで更新できます。
            </Typography>
            <Divider />
            {data.reviews.length ? (
              <Stack spacing={1.5}>
                {data.reviews.map((review) => (
                  <Paper key={review.id} variant="outlined" sx={{ p: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography>
                          {new Date(review.reviewedAt).toLocaleString("ja-JP")} / score {review.score}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          {review.note || "メモなし"}
                        </Typography>
                      </Box>
                      <Button
                        variant={editingReviewId === review.id ? "contained" : "outlined"}
                        onClick={() => handleSelectReview(review.id)}
                      >
                        {editingReviewId === review.id ? "編集中" : "この記録を編集"}
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Alert severity="info">まだ振り返り履歴はありません。上のフォームから最初の 1 件を保存できます。</Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
