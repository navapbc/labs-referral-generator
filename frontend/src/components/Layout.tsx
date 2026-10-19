import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "src/i18n/config";

type Props = {
  children: React.ReactNode;
  locale?: Locale;
};

const Layout = ({ children, locale }: Props) => {
  return (
    // Stick the footer to the bottom of the page
    <div>
      <main id="main-content">
        <NextIntlClientProvider locale={locale}>
          <div>{children}</div>
        </NextIntlClientProvider>
      </main>
    </div>
  );
};

export default Layout;
