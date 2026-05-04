const appBaseUrl = process.env.APP_BASE_URL;
const cronSecret = process.env.VOICE_CRON_SECRET ?? process.env.CRON_SECRET;

if (!appBaseUrl || !cronSecret) {
  throw new Error("APP_BASE_URL and VOICE_CRON_SECRET are required");
}

const response = await fetch(`${appBaseUrl.replace(/\/$/, "")}/api/voice/send-daily-call`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${cronSecret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});

const body = await response.text();
console.log(body);

if (!response.ok) {
  throw new Error(`Daily voice call trigger failed: ${response.status}`);
}
