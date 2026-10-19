import { Effect } from "effect";
import * as Auth from "../src/server/auth";

await Effect.runPromise(Auth.seed.pipe(Effect.provide(Auth.layer)));
