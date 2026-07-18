# Chat examples

## Fix blank assistant after failed generate

1. Trace SSE parser — ensure terminal errors rethrow/propagate to UI.
2. Persist `errorText` / failed status on assistant row.
3. Add/adjust test if stream helper changed.

## Add a new stream event type

1. Emit from backend inference SSE.
2. Handle in `chat-stream.ts` / agent reducer.
3. Update UI renderer.
4. Ensure reload via `content_json` if durable.
