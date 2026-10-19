import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, formats, locales, timeZone } from "./config";
import { getMessagesWithFallbacks } from "./getMessagesWithFallbacks";

/**
 * Make locale messages available to all server components.
 * This method is used behind the scenes by `next-intl/plugin`, which is setup in next.config.js.
 * @see https://next-intl-docs.vercel.app/docs/usage/configuration#nextconfigjs
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // Unsupported or missing locales fall back to the default locale
  const requested = await requestLocale;
  const locale = hasLocale(locales, requested) ? requested : defaultLocale;
  return {
    formats,
    locale,
    messages: await getMessagesWithFallbacks(locale),
    timeZone,
  };
});
