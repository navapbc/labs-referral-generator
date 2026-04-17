## Overview

- This is a [Next.js](https://nextjs.org/) React web application, written in [TypeScript](https://www.typescriptlang.org/).
- This frontend app uses ShadCN [ShadCN](https://ui.shadcn.com/) for styling and components
- [Storybook](https://storybook.js.org/) is included as a frontend workshop.

### Directory structure

```
├── .storybook        # Storybook configuration
├── public            # Static assets
├── src               # Source code
│   ├── app           # Routes, layouts, and loading screens
│   │   ├── api       # Custom request handlers
│   │   ├── layout.tsx # Root layout, wraps every page
│   │   └── page.tsx  # Homepage
|   ├── adapters      # External service adapters
│   ├── components    # Reusable UI components
│   ├── i18n          # Internationalization
│   │   ├── config.ts  # Supported locales, timezone, and formatters
│   │   └── messages  # Translated strings
│   ├── styles        # Sass & design system settings
│   └── types         # TypeScript type declarations
├── stories           # Storybook pages
└── tests             # Test setup and helpers
```

## 💻 Development

[Next.js](https://nextjs.org/docs) provides the React framework for building the web application. Routes are defined in the `app/` directory. Pages are automatically routed based on the directory name. For example, `app/[locale]/about/page.tsx` would render at `/about` (for English) or `/es-US/about` (for Spanish).

[**Learn more about developing Next.js applications** ↗️](https://nextjs.org/docs)

### Getting started

The application can be run natively or in a Docker container.

Start by navigating to the frontend directory: `cd frontend`
Create a .env.local file: `.touch env.local`

#### Environment variables

Set these in `frontend/.env.local` for local development. For deployed environments they are configured via Terraform (see `infra/frontend/app-config/env-config/environment_variables.tf` and per-env overrides in `infra/frontend/app-config/<env>.tf`).

| Variable                   | Required                                              | Description                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Required in deployed environments; optional for local | Base URL of the backend API, e.g. `https://api.example.com/`. When unset and `ENVIRONMENT` is `local` or unset, `getApiDomain()` falls back to `http://0.0.0.0:3000/`. In any other environment, `getApiDomain()` throws. |
| `ENVIRONMENT`              | Optional locally; set by Terraform in deployed envs   | `local`, `dev`, `prod`, etc. Controls the local fallback behavior in `getApiDomain()`.                                                                                                                                    |
| `NEXT_PUBLIC_BASE_PATH`    | Optional                                              | Subpath the app is served under.                                                                                                                                                                                          |
| `NEXT_PUBLIC_USE_NONRAG`   | Optional                                              | Set to `true` to use the non-RAG endpoints.                                                                                                                                                                               |

#### Native

From the `frontend/` directory:

1. Install dependencies
   ```bash
   npm install
   ```
1. Optionally, disable [telemetry data collection](https://nextjs.org/telemetry)
   ```bash
   npx next telemetry disable
   ```
1. Run the local development server
   ```bash
   npm run dev
   ```
1. Navigate to [localhost:3001](http://localhost:3001) to view the application

##### Other scripts

- `npm run build` - Builds the production Next.js bundle
- `npm start` - Runs the Next.js server, after building the production bundle

#### Docker

Alternatively, you can run the application in a Docker container.

NOTE: we advise allocating extra RAM - 6GB+ - in order to ensure the frontend compiles and functions as expected

From the `frontend/` directory:

1. (Optional) If your machine doesn't include Node, and you'd like tools like VS Code to provide intellisense & type checking, run the following command to install the packages locally:
   ```bash
   make container-npm-install
   ```
2. Run the local development server
   ```bash
   make dev
   ```
3. Navigate to [localhost:3001](http://localhost:3001) to view the application

##### Other scripts

- `make release-build` - Creates the Docker image for deployment to the cloud

## 🖼️ Storybook

Storybook is a [frontend workshop](https://bradfrost.com/blog/post/a-frontend-workshop-environment/) for developing and documenting pages and components in isolation. It allows you to render the same React components and files in the `src/` directory in a browser, without the need for a server or database. This allows you to develop and manually test components without having to run the entire Next.js application.

See the [Storybook Next.js documentation](https://github.com/storybookjs/storybook/tree/next/code/frameworks/nextjs) for more information about using Storybook with Next.js

Similar to the Next.js application, Storybook can be ran natively or in a Docker container.

#### Native

From the `frontend/` directory:

1. `npm run storybook`
2. Navigate to [localhost:6007](http://localhost:6007) to view

##### Other scripts

- `npm run storybook-build` - Exports a static site to `storybook-static/`

#### Docker

Alternatively, you can run Storybook in a Docker container.

From the `frontend/` directory:

1. `make storybook`
2. Navigate to [localhost:6007](http://localhost:6007) to view

## 🐛 Testing

[Jest](https://jestjs.io/docs/getting-started) is used as the test runner. Tests are managed as `.test.ts` (or `.test.tsx`) files and are colocated with the files they reference (for unit tests).

To run tests:

- `npm test` - Runs all tests and outputs test coverage report
- `npm run test-update` - Updates test snapshots
- `npm run test-watch` - Runs tests in [watch](https://jestjs.io/docs/cli#--watch) mode. Tests will re-run when files are changed, and an interactive prompt will allow you to run specific tests or update snapshots.

A subset of tests can be ran by passing a pattern to the script. For example, to only run tests in `src/components`:

```sh
npm run test-watch -- src/components
```

### Testing React components

[React Testing Library (RTL)](https://testing-library.com/docs/react-testing-library/intro) provides the utilities for rendering and querying, and [`jest-axe`](https://www.npmjs.com/package/jest-axe) is used for accessibility testing. Refer to their docs to learn more about their APIs, or view an existing test for examples.

`@testing-library/react` methods should be imported from `tests/react-utils` in order for internationalization to work within your tests:

```diff
- import { render, screen } from '@testing-library/react';
+ import { render, screen } from 'tests/react-utils';

it("renders submit button", () => {
  render(<Page />)

  expect(
    screen.getByRole("button", { name: "Submit" })
  ).toBeInTheDocument()
})
```

## 🤖 Type checking, linting, and formatting

- [TypeScript](https://www.typescriptlang.org/) is used for type checking.
  - `npm run ts:check` - Type checks all files
  - `npm run i18n-types` - Updates the i18n TypeScript declaration. You only need to run this if you've added a new English locale file (JSON files in `public/locales/en-US`). This runs automatically when you start the development server or build the application.
- [ESLint](https://eslint.org/) is used for linting. This helps catch common mistakes and encourage best practices.
  - `npm run lint` - Lints all files and reports any errors
  - `npm run lint-fix` - Lints all files and fixes any auto-fixable errors
- [Prettier](https://prettier.io/) is used for code formatting. This reduces the need for manual formatting or nitpicking and enforces a consistent style.
  - `npm run format`: Formats all files
  - `npm run format-check`: Check files for formatting violations without fixing them.

Optionally, configure your code editor to auto run these tools on file save. Most code editors have plugins for these tools or provide native support.

<details>
  <summary>VSCode instructions</summary>

1. Install the [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) extensions.
2. Add the following to a `.vscode/settings.json` file, in whichever directory you open in VSCode (root or this directory):

   ```json
   {
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     },
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "eslint.workingDirectories": ["./frontend"],
     "typescript.validate.enable": true
   }
   ```

[Learn more about these settings](https://code.visualstudio.com/docs/getstarted/settings)

</details>

## Other topics

- [Internationalization](../docs/frontend/internationalization.md)
- [Security](../docs/frontend/security.md)
- [Image optimization](../docs/frontend/image-optimization.md)
- Refer to the [architecture decision records](../docs/decisions) for more context on technical decisions.
