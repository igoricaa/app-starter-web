import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AccountService } from "~/server/AccountService";
import { input, runAuthed } from "~/server/runtime";
import { UserId } from "~/server/schema";

export const getAccount = createServerFn({ method: "GET" }).handler(() =>
  runAuthed(AccountService.use((account) => account.getMine)),
);

const UpdateDisplayNameInput = Schema.Struct({ id: UserId, displayName: Schema.String });

export const updateDisplayName = createServerFn({ method: "POST" })
  .validator(input(UpdateDisplayNameInput))
  .handler(({ data }) =>
    runAuthed(
      AccountService.use((account) => account.updateDisplayName(data.id, data.displayName)),
    ),
  );
