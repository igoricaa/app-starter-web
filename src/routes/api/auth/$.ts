import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { Auth } from "~/server/auth";
import { run } from "~/server/runtime";

const handle = ({ request }: { request: Request }) =>
  run(Auth.use((auth) => Effect.promise(() => auth.handler(request))));

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handle, POST: handle } },
});
