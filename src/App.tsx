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
    "テーマ管理、振り返り、通知設定を横断して、定期的な内省フローをひとつの画面群で進めます。";

  if (route.name === "theme-new") {
    content = <ThemeFormPage mode="create" />;
    description =
      "新しいテーマを登録します。必要なら通知設定レコードも先に作成して関連付けできます。";
  }

  if (route.name === "theme-detail") {
    content = <ThemeDetailPage themeId={route.themeId} />;
    description =
      "テーマの目的、通知設定との関連、振り返り履歴と推移グラフをまとめて確認します。";
  }

  if (route.name === "theme-edit") {
    content = <ThemeFormPage mode="edit" themeId={route.themeId} />;
    description = "既存テーマの issue / cause / goal と通知設定の関連付けを更新します。";
  }

  if (route.name === "theme-review") {
    content = <ThemeReviewPage themeId={route.themeId} />;
    description = "7 段階評価とメモを記録し、過去の振り返りも同じ画面で更新できます。";
  }

  if (route.name === "theme-notifications") {
    content = <ThemeNotificationsPage themeId={route.themeId} />;
    description =
      "check-in / review の通知ルール、権限状態、Periodic Sync 登録、手動チェックをここで扱います。";
  }

  if (route.name === "not-found") {
    content = (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              指定された画面は見つかりません。ダッシュボードへ戻って操作を続けてください。
            </Alert>
            <Button variant="contained" onClick={() => navigate({ name: "dashboard" })}>
              ダッシュボードへ戻る
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
    description = "存在しない画面です。利用できる導線からやり直せます。";
  }

  return (
    <AppShell route={route} title={formatRouteTitle(route)} description={description}>
      {content}
    </AppShell>
  );
}

export default App;
