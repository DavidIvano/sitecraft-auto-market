export type LogFields = Record<string, string | number | boolean | null | undefined>;
function write(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  // Structured operations only. No secrets, seller data, images, or upstream payloads are logged.
  console[level](JSON.stringify({ service: "sitecraft-deal-finder-sync", level, event, ...fields }));
}
export const logger = { info: (event: string, fields?: LogFields) => write("info", event, fields), warn: (event: string, fields?: LogFields) => write("warn", event, fields), error: (event: string, fields?: LogFields) => write("error", event, fields) };
