import { createSerializationAdapter } from "@tanstack/react-router";
import type { AppFailure } from "~/server/errors";

export type ErrorCode = AppFailure["_tag"] | "Unknown";

// The only error a server function throws to the browser (see src/server/runtime.ts).
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

// Start sends a plain Error's message only; this keeps the code. Registered in src/start.ts.
export const appErrorAdapter = createSerializationAdapter({
  key: "AppError",
  test: (value): value is AppError => value instanceof AppError,
  toSerializable: ({ code, message }) => ({ code, message }),
  fromSerializable: ({ code, message }) => new AppError(code, message),
});

export function readError(error: unknown): AppError {
  return error instanceof AppError
    ? error
    : new AppError("Unknown", "Something went wrong. Please try again.");
}
