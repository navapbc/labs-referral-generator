// @ts-check
const withNextIntl = require("next-intl/plugin")("./src/i18n/server.ts");

/**
 * Configure the base path for the app. Useful if you're deploying to a subdirectory (like GitHub Pages).
 * If this is defined, you'll need to set the base path anywhere you use relative paths, like in
 * `<a>`, `<img>`, or `<Image>` tags. Next.js handles this for you automatically in `<Link>` tags.
 * @see https://nextjs.org/docs/api-reference/next.config.js/basepath
 * @example "/test" results in "localhost:3000/test" as the index page for the app
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  reactStrictMode: true,
  // Output only the necessary files for a deployment, excluding irrelevant node_modules
  // https://nextjs.org/docs/app/api-reference/next-config-js/output
  output: "standalone",
  // Exclude esbuild from standalone output - it's a devDependency (from Storybook)
  // that shouldn't be needed at runtime and contains Go binaries with vulnerabilities
  outputFileTracingExcludes: {
    "*": ["node_modules/@esbuild/**", "node_modules/esbuild/**"],
  },
  // Continue to support older browsers (ES5)
  transpilePackages: [],

  async redirects() {
    return [
      {
        source: "/",
        destination: "/generate-referrals",
        permanent: false,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
