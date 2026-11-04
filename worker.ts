// OpenNext'in ürettiği worker'ı sarmalar ve Cloudflare Cron tetikleyicisini ekler.
// @ts-ignore: build sırasında oluşturulur
import { default as handler } from "./.open-next/worker.js";

type Env = { CRON_SECRET?: string; APP_URL?: string };

export default {
  fetch: handler.fetch,
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const base = env.APP_URL || "https://okuma-takip.internal";
    const req = new Request(`${base}/api/cron`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
    });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
};
