import { useTranslations } from "next-intl";

export function View() {
  const t = useTranslations("home");

  return (
    <div className="max-w-5xl mx-auto px-4">
      <h1>{t("title")}</h1>

      {/* Demonstration of more complex translated strings, with safe-listed links HTML elements */}
      <p>
        {t.rich("intro", {
          LinkToNextJs: (content) => (
            <a href="https://nextjs.org/docs">{content}</a>
          ),
        })}
      </p>
      <div>
        {t.rich("body", {
          ul: (content) => <ul>{content}</ul>,
          li: (content) => <li>{content}</li>,
        })}

        <p>
          {/* Demonstration of formatters */}
          {t("formatting", {
            amount: 1234,
            isoDate: new Date("2023-11-29T23:30:00.000Z"),
          })}
        </p>
      </div>
    </div>
  );
}
