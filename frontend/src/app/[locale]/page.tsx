import { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { defaultLocale, locales } from "src/i18n/config";

import { View } from "./view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requested } = await params;
  const locale = hasLocale(locales, requested) ? requested : defaultLocale;
  const t = await getTranslations({ locale });
  const meta: Metadata = {
    title: t("home.title"),
  };

  return meta;
}

export default function Controller() {
  return <View />;
}
