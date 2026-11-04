import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Tüm sayfalar kullanıcıya özel/dinamik olduğu için ek bir önbellek (R2) gerekmiyor.
export default defineCloudflareConfig({});
