import { z } from "zod";

export const slackWebhook = /^https:\/\/hooks\.slack\.com\/services\/[\w/-]+$/;

export const slackBody = z.object({
  url: z
    .string()
    .trim()
    .regex(
      slackWebhook,
      "Paste a Slack incoming webhook URL (https://hooks.slack.com/services/...)",
    )
    .nullable(),
});
