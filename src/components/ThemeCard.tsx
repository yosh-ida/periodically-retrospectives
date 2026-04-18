import { Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

import { buildPath, navigate } from "../routes.ts";

type ThemeCardProps = {
  id: string;
  issue: string;
  cause: string;
  goal: string;
  notificationLabel: string;
  reviewLabel: string;
  onArchive: () => void;
};

export function ThemeCard({
  cause,
  goal,
  id,
  issue,
  notificationLabel,
  onArchive,
  reviewLabel,
}: ThemeCardProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={2} sx={{ height: "100%" }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={notificationLabel} variant="outlined" />
            <Chip label={reviewLabel} variant="outlined" color="secondary" />
          </Stack>
          <Stack spacing={1}>
            <Typography variant="h6">{issue}</Typography>
            <Typography variant="body2" color="text.secondary">
              原因: {cause}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ゴール: {goal}
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: "auto" }}>
            <Button variant="contained" onClick={() => navigate({ name: "theme-detail", themeId: id })}>
              詳細を見る
            </Button>
            <Button variant="outlined" onClick={() => navigate({ name: "theme-review", themeId: id })}>
              振り返る
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate({ name: "theme-notifications", themeId: id })}
            >
              通知設定
            </Button>
            <Button
              variant="text"
              href={buildPath({ name: "theme-edit", themeId: id })}
              onClick={(event) => {
                event.preventDefault();
                navigate({ name: "theme-edit", themeId: id });
              }}
            >
              編集
            </Button>
            <Button color="inherit" onClick={onArchive}>
              アーカイブ
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
