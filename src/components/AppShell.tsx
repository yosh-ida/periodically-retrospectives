import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";

import { navigate, type AppRoute } from "../routes.ts";

type AppShellProps = {
  route: AppRoute;
  title: string;
  description: string;
  children: ReactNode;
};

export function AppShell({ children, description, route, title }: AppShellProps) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 3, md: 5 },
        background:
          "radial-gradient(circle at top left, rgba(181,105,77,0.24), transparent 28%), radial-gradient(circle at top right, rgba(19,52,59,0.16), transparent 24%), linear-gradient(180deg, #f4efe7 0%, #e6ece9 100%)",
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Paper sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Stack spacing={1}>
                  <Typography variant="h3">{title}</Typography>
                  <Typography color="text.secondary">{description}</Typography>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button variant="text" onClick={() => navigate({ name: "dashboard" })}>
                    ダッシュボード
                  </Button>
                  <Button variant="contained" onClick={() => navigate({ name: "theme-new" })}>
                    テーマを追加
                  </Button>
                </Stack>
              </Stack>
              {route.name === "not-found" ? (
                <Alert severity="warning">
                  指定したページは見つかりませんでした。ダッシュボードから目的の画面へ戻れます。
                </Alert>
              ) : null}
            </Stack>
          </Paper>
          {children}
        </Stack>
      </Container>
    </Box>
  );
}
