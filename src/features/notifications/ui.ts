import type { NotificationRule } from "../../domain.ts";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function describeNotificationRule(rule: NotificationRule) {
  if (rule.type === "every-n-days") {
    return `${rule.intervalDays}日ごと / 基準日 ${rule.anchorDate} / ${rule.times.join(", ")}`;
  }

  const weekdays = rule.weekdays.map((weekday) => weekdayLabels[weekday]).join(", ");
  return `毎週 ${weekdays} / ${rule.times.join(", ")}`;
}
