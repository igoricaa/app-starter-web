import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { appErrorAdapter } from "~/lib/app-error";

// Server functions are same-origin RPC; refuse cross-site calls to them.
const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  serializationAdapters: [appErrorAdapter],
}));
