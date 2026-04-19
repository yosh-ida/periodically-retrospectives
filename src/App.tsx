import { Alert, Button, Card, CardContent, Stack } from "@mui/material";
import { useSyncExternalStore } from "react";

import { AppShell } from "./components/AppShell.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { ThemeDetailPage } from "./pages/ThemeDetailPage.tsx";
import { ThemeFormPage } from "./pages/ThemeFormPage.tsx";
import { ThemeNotificationsPage } from "./pages/ThemeNotificationsPage.tsx";
import { ThemeReviewPage } from "./pages/ThemeReviewPage.tsx";
import {
  formatRouteTitle,
  getCurrentRoute,
  navigate,
  subscribeToRouteChanges,
} from "./routes.ts";

function App() {
  const route = useSyncExternalStore(subscribeToRouteChanges, getCurrentRoute, getCurrentRoute);

  let content = <DashboardPage />;
  let description =
    "テーマ整理、7 段階レビュー、PWA 通知設定をつないで、継続しやすい振り返りフローを整えます。";

  if (route.name === "theme-new") {
    content = <ThemeFormPage mode="create" />;
    description =
      "新しいテーマを整理します。必要なら作成後そのまま通知設定ページへ進み、頻度や曜日も続けて決められます。";
  }

  if (route.name === "theme-detail") {
    content = <ThemeDetailPage themeId={route.themeId} />;
    description =
      "テーマの詳細、通知設定の関連状況、レビュー履歴と推移を 1 画面で確認できます。";
  }

  if (route.name === "theme-edit") {
    content = <ThemeFormPage mode="edit" themeId={route.themeId} />;
    description = "既存テーマの issue / cause / goal と通知設定の関連づけを見直します。";
  }

  if (route.name === "theme-review") {
    content = <ThemeReviewPage themeId={route.themeId} />;
    description =
      "7 段階評価とメモを記録し、必要なら同じ画面から過去レビューも振り返ります。";
  }

  if (route.name === "theme-notifications") {
    content = <ThemeNotificationsPage themeId={route.themeId} />;
    description =
      "check-in / review の通知ルール、権限状態、Periodic Sync、PWA 導線をまとめて調整します。";
  }

  if (route.name === "not-found") {
    content = (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              指定された画面は見つかりませんでした。ダッシュボードへ戻って再度選択してください。
            </Alert>
            <Button variant="contained" onClick={() => navigate({ name: "dashboard" })}>
              ダッシュボードへ戻る
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
    description = "存在しない画面です。利用できる導線から戻ってください。";
  }

  return (
    <AppShell route={route} title={formatRouteTitle(route)} description={description}>
      {content}
    </AppShell>
  );
}

export default App;
