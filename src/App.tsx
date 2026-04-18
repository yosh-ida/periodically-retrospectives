import { useLiveQuery } from "dexie-react-hooks";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { db, resetPhase1Data, seedPhase1DemoData } from "./db.ts";
import { useWorkspaceStore } from "./store.ts";

const domainCards = [
  {
    title: "ReflectionTheme",
    description:
      "A long-lived reflection topic with required issue, cause, and goal fields plus an optional notification settings reference.",
    fields: ["issue", "cause", "goal", "notificationSettingsId", "isArchived"],
  },
  {
    title: "ReflectionReview",
    description: "A point-in-time self review with a 1 to 7 score and an optional note.",
    fields: ["themeId", "score", "note", "reviewedAt"],
  },
  {
    title: "NotificationSettings",
    description:
      "A local notification settings aggregate with check-in and review channel rules plus runtime state.",
    fields: ["enabled", "channels.checkIn", "channels.review", "lastNotifiedSlotId"],
  },
] as const;

function App() {
  const { isBusy, reset, setBusy, setStatusMessage, statusMessage } = useWorkspaceStore();
  const summary = useLiveQuery(async () => {
    const [themes, reviews, notificationSettings] = await Promise.all([
      db.themes.orderBy("updatedAt").reverse().toArray(),
      db.reviews.orderBy("reviewedAt").reverse().toArray(),
      db.notificationSettings.orderBy("updatedAt").reverse().toArray(),
    ]);

    return {
      themes,
      reviews,
      notificationSettings,
    };
  }, []);

  const handleSeed = async () => {
    setBusy(true);
    try {
      await seedPhase1DemoData();
      setStatusMessage(
        "Inserted a sample theme, review, and notification settings record so the Phase 1 relationships are visible.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      await resetPhase1Data();
      reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: 6,
        background:
          "radial-gradient(circle at top, rgba(181,105,77,0.2), transparent 35%), linear-gradient(180deg, #f4efe7 0%, #e7ece8 100%)",
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={4}>
          <Paper sx={{ p: 4 }}>
            <Stack spacing={2}>
              <Typography variant="overline" color="secondary">
                Phase 1 Foundation
              </Typography>
              <Typography variant="h3">Periodic Retrospectives</Typography>
              <Typography color="text.secondary">
                Phase 1 keeps only the domain and storage foundation for themes, reviews,
                and notification settings. Later navigation flows and PWA behavior are
                intentionally removed for now so we can build forward in clean steps.
              </Typography>
              <Alert severity="info">{statusMessage}</Alert>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            {domainCards.map((card) => (
              <Card key={card.title} sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h5">{card.title}</Typography>
                    <Typography color="text.secondary">{card.description}</Typography>
                    <Divider />
                    <Stack spacing={1}>
                      {card.fields.map((field) => (
                        <Typography key={field} variant="body2">
                          {field}
                        </Typography>
                      ))}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="h5">IndexedDB Snapshot</Typography>
                    <Typography color="text.secondary">
                      Phase 1 is only about schema shape and table relationships.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1.5}>
                    <Button variant="contained" disabled={isBusy} onClick={handleSeed}>
                      Insert sample data
                    </Button>
                    <Button variant="outlined" disabled={isBusy} onClick={handleReset}>
                      Reset tables
                    </Button>
                  </Stack>
                </Stack>

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
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Typography variant="overline">Themes</Typography>
                      <Typography variant="h4">{summary?.themes.length ?? 0}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        Reflection topics with issue, cause, and goal
                      </Typography>
                    </Stack>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Typography variant="overline">Reviews</Typography>
                      <Typography variant="h4">{summary?.reviews.length ?? 0}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        Point-in-time 1 to 7 reviews
                      </Typography>
                    </Stack>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Typography variant="overline">Notification Settings</Typography>
                      <Typography variant="h4">
                        {summary?.notificationSettings.length ?? 0}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        Check-in and review notification settings
                      </Typography>
                    </Stack>
                  </Paper>
                </Box>

                <Divider />

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
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Typography variant="h6">Latest Theme</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {summary?.themes[0]?.issue ?? "No records yet."}
                      </Typography>
                    </Stack>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Typography variant="h6">Latest Review</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {summary?.reviews[0]
                          ? `score ${summary.reviews[0].score} / note: ${
                              summary.reviews[0].note || "none"
                            }`
                          : "No records yet."}
                      </Typography>
                    </Stack>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Typography variant="h6">Latest Notification</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {summary?.notificationSettings[0]
                          ? `enabled: ${summary.notificationSettings[0].enabled ? "true" : "false"}`
                          : "No records yet."}
                      </Typography>
                    </Stack>
                  </Paper>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}

export default App;
