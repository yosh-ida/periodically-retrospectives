import { Alert, Button, Card, CardContent, Stack } from "@mui/material";
import { useSyncExternalStore } from "react";

import { AppShell } from "./components/AppShell.tsx";
import {
  formatRouteTitle,
  getCurrentRoute,
  navigate,
  subscribeToRouteChanges,
} from "./routes.ts";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { ThemeDetailPage } from "./pages/ThemeDetailPage.tsx";
import { ThemeFormPage } from "./pages/ThemeFormPage.tsx";
import { ThemeReviewPage } from "./pages/ThemeReviewPage.tsx";

function App() {
  const route = useSyncExternalStore(subscribeToRouteChanges, getCurrentRoute, getCurrentRoute);

  let content = <DashboardPage />;
  let description =
    "課題・原因・ゴールを持つ反省点を管理し、7 段階の振り返り記録と推移確認まで行える Phase 3 の実装です。";

  if (route.name === "theme-new") {
    content = <ThemeFormPage mode="create" />;
    description =
      "継続的に意識したい反省点を登録します。通知設定の参照は既存レコードから選ぶか、その場で空の参照を用意できます。";
  }

  if (route.name === "theme-detail") {
    content = <ThemeDetailPage themeId={route.themeId} />;
    description =
      "反省点の内容と通知設定との関連づけ、保存済みの振り返り履歴をまとめて確認できます。";
  }

  if (route.name === "theme-edit") {
    content = <ThemeFormPage mode="edit" themeId={route.themeId} />;
    description =
      "既存の反省点を更新し、課題・原因・ゴールや通知設定参照のつながりを見直せます。";
  }

  if (route.name === "theme-review") {
    content = <ThemeReviewPage themeId={route.themeId} />;
    description =
      "対象テーマの達成度を 7 段階で記録し、必要に応じて過去の振り返りメモを見直して更新できます。";
  }

  if (route.name === "not-found") {
    content = (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              指定された画面はまだ存在しません。ダッシュボードへ戻ってください。
            </Alert>
            <Button variant="contained" onClick={() => navigate({ name: "dashboard" })}>
              ダッシュボードへ戻る
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
    description =
      "存在しないパスです。Phase 3 ではダッシュボード、反省点管理、振り返り入力画面を提供しています。";
  }

  return (
    <AppShell
      route={route}
      title={formatRouteTitle(route)}
      description={description}
    >
      {content}
    </AppShell>
  );
}

export default App;
