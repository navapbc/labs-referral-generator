/**
 * @file Setup type safe message keys with `next-intl`
 * @see https://next-intl.dev/docs/workflows/typescript
 */
import type { Locale } from "src/i18n/config";
import type { messages } from "src/i18n/messages/en-US";

declare global {
  type Messages = typeof messages;
}

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
