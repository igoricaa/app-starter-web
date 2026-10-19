import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getSignedIn } from "~/functions/session";
import appCss from "~/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "App" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  beforeLoad: async () => ({ isAuthenticated: await getSignedIn() }),
  shellComponent: Document,
  component: Outlet,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootError({ error }: ErrorComponentProps) {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="mt-4 overflow-x-auto text-xs">{error.stack}</pre>
      )}
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block underline">
        Go home
      </Link>
    </main>
  );
}
