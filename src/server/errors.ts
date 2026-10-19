import { Schema } from "effect";

// The failures a server function may send to the browser. The tag is the code; the message is
// shown to users, so it never carries internal detail.
export class Unauthenticated extends Schema.TaggedError<Unauthenticated>()("Unauthenticated", {}) {
  override get message() {
    return "Please sign in.";
  }
}

export class InvalidDisplayName extends Schema.TaggedError<InvalidDisplayName>()(
  "InvalidDisplayName",
  {},
) {
  override get message() {
    return "Display name must be 1 to 50 characters.";
  }
}

// Also for a record that exists but isn't the caller's: the two must look the same.
export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {}) {
  override get message() {
    return "Not found.";
  }
}

export type AppFailure = Unauthenticated | InvalidDisplayName | NotFound;
