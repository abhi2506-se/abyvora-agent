const has = (...k: string[]) => k.every((x) => !!process.env[x]);

/** Presence-only integration status. Secret VALUES are never read into output. */
export function getIntegrationStatus() {
  return [
    { name: "Razorpay (payments)", configured: has("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"), vars: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
    { name: "Razorpay webhooks", configured: has("RAZORPAY_WEBHOOK_SECRET"), vars: ["RAZORPAY_WEBHOOK_SECRET"] },
    { name: "Resend (email)", configured: has("RESEND_API_KEY"), vars: ["RESEND_API_KEY"] },
    { name: "Inbound email webhook", configured: has("INBOUND_EMAIL_SECRET") || has("EMAIL_WEBHOOK_SECRET"), vars: ["INBOUND_EMAIL_SECRET", "EMAIL_WEBHOOK_SECRET"] },
    { name: "Supabase storage", configured: has("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"), vars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] },
    { name: "Google sign-in", configured: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
    { name: "AI assistant", configured: has("AI_API_KEY"), vars: ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"] },
    { name: "Portfolio handoff", configured: has("PORTFOLIO_HANDOFF_SECRET"), vars: ["PORTFOLIO_HANDOFF_SECRET", "PORTFOLIO_API_KEY"] },
    { name: "Scheduled health probe (cron)", configured: has("CRON_SECRET"), vars: ["CRON_SECRET"] },
  ];
}
