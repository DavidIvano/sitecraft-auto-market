import { access, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const liveDir = resolve(root, ".xano-live");
const credentials = resolve(root, ".xano-cli.credentials.yaml");
const apply = process.argv.includes("--apply");

const hooks = [
  { file: "api/sitecraft_auto_market/admin/cars/id/approve_PATCH.xs", event: "listing_approved", record: "$updated", requiresUserAuth: true },
  { file: "api/sitecraft_auto_market/dashboard/listings/id_PATCH.xs", event: "listing_edited", record: "$car", requiresUserAuth: true },
  { file: "api/sitecraft_auto_market/admin/cars/id/delete_PATCH.xs", event: "listing_deleted", record: "$updated", requiresUserAuth: true },
  { file: "api/sitecraft_auto_market/admin/cars/id/sold_PATCH.xs", event: "listing_sold", record: "$updated", requiresUserAuth: true },
  { file: "api/sitecraft_auto_market/admin/cars/id/block_PATCH.xs", event: "listing_blocked", record: "$updated", requiresUserAuth: true },
  { file: "api/sitecraft_auto_market/dashboard/listings/id/delete_PATCH.xs", event: "listing_deleted", record: "$car", condition: "($result.already_deleted != true)", requiresUserAuth: true },
  { file: "api/sitecraft_auto_market/translations/internal/jobs/id/complete_POST.xs", event: "translation_ready", record: "$car", translation: "$translation", locale: "$job.target_locale" },
];

const queueHook = ({ event, record, translation, locale, condition }) => {
  const identity = translation
    ? `${translation}.id ~ ":" ~ (${translation}.updated_at|first_notnull:now|to_text)`
    : `${record}.id ~ ":" ~ (${record}.updated_at|first_notnull:now|to_text)`;
  const localeLine = locale ? `\n            locale_code: ${locale}` : "";
  const body = `
    // SEO_MATERIALIZER_QUEUE_HOOK_V1: keep this mutation non-blocking.
    var $seo_event_key { value = "${event}:" ~ ${identity} }
    try_catch {
      try {
        db.add_or_edit seo_refresh_queue {
          field_name = "event_key"
          field_value = $seo_event_key
          data = {
            event_key: $seo_event_key
            event_type: "${event}"
            car_listing_id: ${record}.id${localeLine}
            translation_version: ${record}.translation_version|first_notnull:0
            status: "pending"
            attempts: 0
            available_at: now
            locked_at: null
            locked_by: null
            last_error_code: null
            materialization_generation: null
            materialization_cursor: 0
            updated_at: now
          }
        } as $seo_queue_event
      }
      catch { debug.log { value = {event: "seo_queue_enqueue_failed", source: "${event}"} } }
    }
`;
  return condition ? `
    conditional {
      if ${condition} {${body.replaceAll("\n", "\n  ")}
      }
    }
` : body;
};

const inject = (source, hook) => {
  if (source.includes("SEO_MATERIALIZER_QUEUE_HOOK_V1")) return { source, changed: false };
  const anchor = "\n  }\n\n  response";
  const index = source.lastIndexOf(anchor);
  if (index < 0) throw new Error(`${hook.file} has no stack/response anchor`);
  return { source: `${source.slice(0, index)}${queueHook(hook)}${source.slice(index)}`, changed: true };
};

await Promise.all([access(liveDir), access(credentials)]).catch(() => {
  throw new Error("Pull the production Xano workspace into .xano-live and configure .xano-cli.credentials.yaml first");
});

const changedFiles = [];
const results = [];
for (const hook of hooks) {
  const absolute = resolve(liveDir, hook.file);
  const current = await readFile(absolute, "utf8");
  if (hook.requiresUserAuth && !/^\s*auth\s*=\s*"automarket_users"\s*$/mu.test(current)) {
    throw new Error(`${hook.file} uses $auth but is not connected to automarket_users`);
  }
  const patched = inject(current, hook);
  if (patched.changed) {
    await writeFile(absolute, patched.source, "utf8");
    changedFiles.push(hook.file);
  }
  results.push({ file: hook.file, changed: patched.changed });
}

if (apply && changedFiles.length) {
  const args = ["--yes", "@xano/cli", "workspace", "push", "-d", liveDir, "-w", "115940", "-b", "v1", "-p", "sitecraft-seo-prod", "--force"];
  for (const file of changedFiles) args.push("-i", file);
  const pushed = spawnSync("npx", args, {
    cwd: root,
    env: { ...process.env, XANO_CONFIG: credentials },
    stdio: "inherit",
  });
  if (pushed.status !== 0) throw new Error(`Xano CLI push failed with exit ${pushed.status}`);
}

console.log(JSON.stringify({ ok: true, mode: apply ? "apply" : "dry-run", changed: changedFiles.length, results }, null, 2));
