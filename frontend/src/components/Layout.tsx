import { NextIntlClientProvider } from "next-intl";

type Props = {
  children: React.ReactNode;
  locale?: string;
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
