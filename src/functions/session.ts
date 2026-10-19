import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { findSession } from "~/server/auth";
import { run } from "~/server/runtime";

export const getSignedIn = createServerFn({ method: "GET" }).handler(() =>
  run(findSession(getRequestHeaders()).pipe(Effect.map(Boolean))),
);
