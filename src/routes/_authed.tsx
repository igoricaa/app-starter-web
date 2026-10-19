import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";

// On the first request this runs on the server, so a signed-out visitor gets an HTTP redirect.
export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/sign-in" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  async function signOut() {
    await authClient.signOut();
    // A full load also drops every query cached for the signed-out user.
    location.assign("/sign-in");
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <nav className="mb-8 flex items-center gap-4 text-sm">
        <Link to="/">Home</Link>
        <Link to="/account">Account</Link>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
