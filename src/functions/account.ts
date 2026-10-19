import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { AccountService } from "~/server/AccountService";
import { runAuthed } from "~/server/runtime";

export const getAccount = createServerFn({ method: "GET" }).handler(() =>
  runAuthed(AccountService.use((account) => account.getMine)),
);

const UpdateDisplayNameInput = Schema.Struct({ id: Schema.String, displayName: Schema.String });

export const updateDisplayName = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(UpdateDisplayNameInput))
  .handler(({ data }) =>
    runAuthed(
      AccountService.use((account) => account.updateDisplayName(data.id, data.displayName)),
    ),
  );
