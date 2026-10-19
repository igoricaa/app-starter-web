import { getRequestHeaders } from "@tanstack/react-start/server";
import { Cause, Effect, Exit, Layer, ManagedRuntime, Option, Schema } from "effect";
import { AppError } from "~/lib/app-error";
import * as AccountService from "./AccountService";
import * as Auth from "./auth";
import * as Db from "./Db";
import { InvalidInput, type AppFailure } from "./errors";

const appLayer = Layer.mergeAll(AccountService.layer, Auth.layer).pipe(
  Layer.provideMerge(Db.layer),
);

// A missing variable or an unreachable database is a defect: logged, never shown.
const runtime = ManagedRuntime.make(Layer.orDie(appLayer));

type Services = Layer.Success<typeof appLayer>;

const toAppError = (failure: AppFailure) => new AppError(failure._tag, failure.message);

// A server function's validator: `.validator(input(Schema))`. Input that fails the schema is
// InvalidInput, without the decoder's diagnostics.
export const input =
  <S extends Schema.Codec<unknown, unknown>>(schema: S) =>
  (data: S["Encoded"]): S["Type"] =>
    Option.getOrThrowWith(Schema.decodeUnknownOption(schema)(data), () =>
      toAppError(new InvalidInput()),
    );

// The one place Effects run. A typed failure reaches the browser as its tag and message; a defect
// is logged and the browser gets a generic message.
export async function run<A>(effect: Effect.Effect<A, AppFailure, Services>): Promise<A> {
  const exit = await runtime.runPromiseExit(effect.pipe(Effect.tapDefect(Effect.logError)));
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isSome(failure)) throw toAppError(failure.value);
  throw new AppError("Unknown", "Something went wrong. Please try again.");
}

// `run`, with CurrentUser from this request's session; Unauthenticated without one.
export function runAuthed<A>(effect: Effect.Effect<A, AppFailure, Services | Auth.CurrentUser>) {
  return run(Effect.provide(effect, Auth.authenticate(getRequestHeaders())));
}
