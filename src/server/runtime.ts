import { getRequestHeaders } from "@tanstack/react-start/server";
import { Cause, Effect, Exit, Layer, ManagedRuntime, Option } from "effect";
import { AppError } from "~/lib/app-error";
import * as AccountService from "./AccountService";
import * as Auth from "./auth";
import * as Db from "./Db";
import type { AppFailure } from "./errors";

const appLayer = Layer.mergeAll(AccountService.layer, Auth.layer).pipe(
  Layer.provideMerge(Db.layer),
);

// A missing variable or an unreachable database is a defect: logged, never shown.
const runtime = ManagedRuntime.make(Layer.orDie(appLayer));

type Services = Layer.Success<typeof appLayer>;

// The one place Effects run. A typed failure reaches the browser as its tag and message; a defect
// is logged and the browser gets a generic message.
export async function run<A>(effect: Effect.Effect<A, AppFailure, Services>): Promise<A> {
  const exit = await runtime.runPromiseExit(effect.pipe(Effect.tapDefect(Effect.logError)));
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isSome(failure)) throw new AppError(failure.value._tag, failure.value.message);
  throw new AppError("Unknown", "Something went wrong. Please try again.");
}

// `run`, with CurrentUser from this request's session; Unauthenticated without one.
export function runAuthed<A>(effect: Effect.Effect<A, AppFailure, Services | Auth.CurrentUser>) {
  return run(Effect.provide(effect, Auth.authenticate(getRequestHeaders())));
}
