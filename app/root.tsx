import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import Footer from "./components/Footer/Footer";
import Header from "./components/Header/Header";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

/**
 * Render the top-level HTML document wrapper for the application.
 *
 * Renders an <html lang="en"> element with a head that includes charset, viewport, router-managed meta and link tags, and a body that contains the provided `children` plus router utilities for scroll restoration and scripts.
 *
 * @param children - The React nodes to place inside the document body
 * @returns The complete HTML document element used as the app layout
 */
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Compose the application shell with the header, routed content area, and footer.
 *
 * @returns A React element containing the app header, a centered container with the router Outlet for page content, and the footer.
 */
export default function App() {
  return (
    <>
    <Header />
      <div className="app-container">
      <Outlet />
      </div>
      <Footer />
    </>
  );
}

/**
 * Render a user-facing error page for route responses and runtime errors.
 *
 * Displays a prioritized message and details for route error responses (e.g., a 404 page), falls back to a generic error message for other cases, and includes the error's message and stack trace when running in development.
 *
 * @param error - The router-provided error payload; may be a route error response or a thrown Error.
 * @returns A React element showing an error title, a descriptive message, and — when available in development — the stack trace.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}