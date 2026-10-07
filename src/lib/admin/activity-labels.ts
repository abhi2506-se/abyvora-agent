/**
 * Maps raw audit `action` keys to a human title + visual tone for the
 * Recent Activities feed. Pure + presentational; unknown actions still render
 * (humanized) rather than being dropped, so the feed never hides real events.
 */
export type ActivityTone = "info" | "success" | "warning" | "danger" | "accent";

const RULES: { match: RegExp; title: string; tone: ActivityTone }[] = [
  { match: /^organization\.(created|registered)/, title: "New organization registered", tone: "info" },
  { match: /^organization\.approved/, title: "Organization approved", tone: "success" },
  { match: /^organization\.rejected/, title: "Organization rejected", tone: "danger" },
  { match: /^organization\.changes_requested/, title: "Changes requested from organization", tone: "warning" },
  { match: /^organization\.(suspended|terminated)/, title: "Organization access restricted", tone: "danger" },
  { match: /^organization\./, title: "Organization updated", tone: "info" },
  { match: /^user\.(created|invited)|^agent\.created/, title: "New user added", tone: "info" },
  { match: /^user\.role/, title: "User role changed", tone: "warning" },
  { match: /^user\./, title: "User updated", tone: "info" },
  { match: /^payment\.(captured|received|verified)/, title: "Payment received", tone: "success" },
  { match: /^payment\.failed/, title: "Payment failed", tone: "danger" },
  { match: /^refund\.(processed|approved)/, title: "Refund processed", tone: "warning" },
  { match: /^refund\./, title: "Refund activity", tone: "warning" },
  { match: /^subscription\.(upgraded|downgraded|plan_changed)/, title: "Subscription changed", tone: "accent" },
  { match: /^subscription\./, title: "Subscription updated", tone: "accent" },
  { match: /^plan\.created/, title: "New plan created", tone: "accent" },
  { match: /^plan\./, title: "Plan updated", tone: "accent" },
  { match: /^support_ticket\.resolved/, title: "Ticket resolved", tone: "success" },
  { match: /^support_ticket\.escalated/, title: "Ticket escalated", tone: "danger" },
  { match: /^support_ticket\./, title: "Support ticket updated", tone: "info" },
  { match: /^platform_owner\.mfa.*(verified|enrolled|confirmed)/, title: "MFA verified", tone: "success" },
  { match: /^platform_owner\.mfa|^platform_owner\..*fail/, title: "Security event", tone: "danger" },
  { match: /^webhook\..*invalid|^mfa\.(failed|reset)|^security\.|^auth\.failed/, title: "Security event", tone: "danger" },
  { match: /^mfa\./, title: "MFA event", tone: "info" },
  { match: /^export\./, title: "Data exported", tone: "warning" },
  { match: /^invoice\./, title: "Invoice activity", tone: "info" },
  { match: /^department\.|^team\./, title: "Team structure updated", tone: "info" },
  { match: /^settings?\./, title: "Settings changed", tone: "warning" },
];

export function describeAction(action: string): { title: string; tone: ActivityTone } {
  for (const r of RULES) if (r.match.test(action)) return { title: r.title, tone: r.tone };
  const humanized = action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { title: humanized, tone: "info" };
}

/** Audit actions that count as security events for alerts / sidebar badges. */
export function isSecurityAction(action: string): boolean {
  return /^webhook\..*invalid|^mfa\.|^security\.|^auth\.|\.idor|\.forbidden|\.denied/.test(action);
}
