import { assert, describe, it } from "@effect/vitest";
import { Schema } from "effect";
import { AppError } from "~/lib/app-error";
import { input } from "./runtime";
import { UserId } from "./schema";

function catchError(f: () => unknown) {
  try {
    f();
  } catch (error) {
    return error;
  }
}

describe("input", () => {
  const decode = input(Schema.Struct({ id: UserId, displayName: Schema.String }));

  it("decodes valid input", () => {
    const valid = { id: "a".repeat(32), displayName: "Alice" };
    assert.deepStrictEqual(decode(valid), valid);
  });

  it("answers InvalidInput for anything else, without the decoder's diagnostics", () => {
    for (const data of [{ id: "' or 1=1 --", displayName: "x" }, { id: 1 }, null]) {
      const error = catchError(() => decode(data as never));
      assert.instanceOf(error, AppError);
      assert.deepStrictEqual(
        { code: error.code, message: error.message },
        {
          code: "InvalidInput",
          message: "The request was invalid.",
        },
      );
    }
  });
});
