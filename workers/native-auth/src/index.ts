import { handleNativeAuth } from "./gateway";

export default {
  fetch(request, env) { return handleNativeAuth(request, env); },
} satisfies ExportedHandler<NativeAuthEnv>;
