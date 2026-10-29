import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRIORITY_CONNECTORS,
  type ConnectorId,
} from "../src/shared/lib/plugin-connectors";
import { CONNECTORS, getConnector } from "../src/server/plugins/registry";
import {
  executeRestTool,
  listRestTools,
} from "../src/server/plugins/rest-tools";

const token = "test-oauth-secret-not-a-real-token";
const mail = {
  to: ["person@example.com"],
  subject: "Hello",
  body: "Plain text",
};
const event = {
  title: "Planning",
  start: "2026-10-12T09:00:00Z",
  end: "2026-10-12T09:30:00Z",
};
const uuid = "a3573569-6936-4a5b-aef1-67ba2a890928";
type Example = {
  plugin: ConnectorId;
  tool: string;
  args: Record<string, unknown>;
  origin: string;
  path: string;
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
  mutation?: boolean;
};
const google = "https://www.googleapis.com";
const graph = "https://graph.microsoft.com";
const gmail = "https://gmail.googleapis.com";
const examples: Example[] = [
  {
    plugin: "gmail",
    tool: "search_messages",
    args: { query: "from:person@example.com", limit: 5 },
    origin: gmail,
    path: "/gmail/v1/users/me/messages",
    query: { q: "from:person@example.com", maxResults: "5" },
  },
  {
    plugin: "gmail",
    tool: "get_message",
    args: { messageId: "a/b+c=" },
    origin: gmail,
    path: "/gmail/v1/users/me/messages/a%2Fb%2Bc%3D",
    query: { format: "full" },
  },
  {
    plugin: "gmail",
    tool: "create_draft",
    args: mail,
    origin: gmail,
    path: "/gmail/v1/users/me/drafts",
    method: "POST",
    mutation: true,
  },
  {
    plugin: "gmail",
    tool: "send_message",
    args: mail,
    origin: gmail,
    path: "/gmail/v1/users/me/messages/send",
    method: "POST",
    mutation: true,
  },
  {
    plugin: "google-calendar",
    tool: "list_events",
    args: { calendarId: "user@example.com", limit: 7 },
    origin: google,
    path: "/calendar/v3/calendars/user%40example.com/events",
    query: { maxResults: "7", singleEvents: "true", orderBy: "startTime" },
  },
  {
    plugin: "google-calendar",
    tool: "create_event",
    args: { ...event, calendarId: "user@example.com" },
    origin: google,
    path: "/calendar/v3/calendars/user%40example.com/events",
    method: "POST",
    mutation: true,
    body: {
      summary: event.title,
      start: { dateTime: event.start },
      end: { dateTime: event.end },
    },
  },
  {
    plugin: "google-drive",
    tool: "search_files",
    args: { query: "O'Reilly\\guide", limit: 3 },
    origin: google,
    path: "/drive/v3/files",
    query: {
      q: "trashed = false and name contains 'O\\'Reilly\\\\guide'",
      pageSize: "3",
    },
  },
  {
    plugin: "google-drive",
    tool: "get_text",
    args: { fileId: "file/1" },
    origin: google,
    path: "/drive/v3/files/file%2F1",
  },
  {
    plugin: "google-drive",
    tool: "create_file",
    args: { name: "notes.txt", content: "Notes", parentId: "parent" },
    origin: google,
    path: "/upload/drive/v3/files",
    method: "POST",
    mutation: true,
    query: { uploadType: "multipart" },
  },
  {
    plugin: "slack",
    tool: "search_messages",
    args: { query: "in:general", limit: 4 },
    origin: "https://slack.com",
    path: "/api/search.messages",
    query: { query: "in:general", count: "4" },
  },
  {
    plugin: "slack",
    tool: "list_conversations",
    args: { limit: 4 },
    origin: "https://slack.com",
    path: "/api/conversations.list",
    query: { limit: "4", types: "public_channel,private_channel,mpim,im" },
  },
  {
    plugin: "slack",
    tool: "post_message",
    args: { conversationId: "C123", text: "Hi" },
    origin: "https://slack.com",
    path: "/api/chat.postMessage",
    method: "POST",
    mutation: true,
    body: {
      channel: "C123",
      text: "Hi",
      unfurl_links: false,
      unfurl_media: false,
    },
  },
  {
    plugin: "outlook",
    tool: "list_messages",
    args: { limit: 8 },
    origin: graph,
    path: "/v1.0/me/messages",
    query: { $top: "8" },
  },
  {
    plugin: "outlook",
    tool: "get_message",
    args: { messageId: "a/b+c=" },
    origin: graph,
    path: "/v1.0/me/messages/a%2Fb%2Bc%3D",
  },
  {
    plugin: "outlook",
    tool: "send_message",
    args: mail,
    origin: graph,
    path: "/v1.0/me/sendMail",
    method: "POST",
    mutation: true,
    body: {
      message: {
        subject: "Hello",
        body: { contentType: "Text", content: "Plain text" },
        toRecipients: [{ emailAddress: { address: "person@example.com" } }],
      },
      saveToSentItems: true,
    },
  },
  {
    plugin: "outlook-calendar",
    tool: "list_events",
    args: { limit: 6 },
    origin: graph,
    path: "/v1.0/me/events",
    query: { $top: "6" },
  },
  {
    plugin: "outlook-calendar",
    tool: "create_event",
    args: event,
    origin: graph,
    path: "/v1.0/me/events",
    method: "POST",
    mutation: true,
    body: {
      subject: "Planning",
      body: { contentType: "Text", content: "" },
      start: { dateTime: "2026-10-12T09:00:00.000", timeZone: "UTC" },
      end: { dateTime: "2026-10-12T09:30:00.000", timeZone: "UTC" },
    },
  },
  {
    plugin: "onedrive",
    tool: "search_files",
    args: { query: "annual report", limit: 3 },
    origin: graph,
    path: "/v1.0/me/drive/root/search(q='annual%20report')",
    query: { $top: "3" },
  },
  {
    plugin: "onedrive",
    tool: "list_items",
    args: { folderId: "a/b", limit: 3 },
    origin: graph,
    path: "/v1.0/me/drive/items/a%2Fb/children",
    query: { $top: "3" },
  },
  {
    plugin: "onedrive",
    tool: "get_item",
    args: { itemId: "a/b" },
    origin: graph,
    path: "/v1.0/me/drive/items/a%2Fb",
  },
  {
    plugin: "onedrive",
    tool: "create_file",
    args: { name: "file 1.txt", content: "Hello", parentId: "folder" },
    origin: graph,
    path: "/v1.0/me/drive/items/folder:/file%201.txt:/content",
    method: "PUT",
    mutation: true,
    query: { "@microsoft.graph.conflictBehavior": "fail" },
  },
  {
    plugin: "sharepoint",
    tool: "search_sites",
    args: { query: "Engineering", limit: 5 },
    origin: graph,
    path: "/v1.0/sites",
    query: { search: "Engineering", $top: "5" },
  },
  {
    plugin: "sharepoint",
    tool: "list_drives",
    args: { siteId: "tenant.sharepoint.com,abc,def", limit: 5 },
    origin: graph,
    path: "/v1.0/sites/tenant.sharepoint.com%2Cabc%2Cdef/drives",
    query: { $top: "5" },
  },
  {
    plugin: "sharepoint",
    tool: "list_drive_items",
    args: { driveId: "drive+1", folderId: "folder", limit: 5 },
    origin: graph,
    path: "/v1.0/drives/drive%2B1/items/folder/children",
    query: { $top: "5" },
  },
  {
    plugin: "teams",
    tool: "list_teams",
    args: {},
    origin: graph,
    path: "/v1.0/me/joinedTeams",
  },
  {
    plugin: "teams",
    tool: "list_chats",
    args: { limit: 4 },
    origin: graph,
    path: "/v1.0/me/chats",
    query: { $top: "4" },
  },
  {
    plugin: "teams",
    tool: "read_messages",
    args: { chatId: "19:abc@thread.v2", limit: 4 },
    origin: graph,
    path: "/v1.0/chats/19%3Aabc%40thread.v2/messages",
    query: { $top: "4" },
  },
  {
    plugin: "teams",
    tool: "send_chat_message",
    args: { chatId: "19:abc@thread.v2", text: "Hi" },
    origin: graph,
    path: "/v1.0/chats/19%3Aabc%40thread.v2/messages",
    method: "POST",
    mutation: true,
    body: { body: { contentType: "text", content: "Hi" } },
  },
  {
    plugin: "linear",
    tool: "search_issues",
    args: { query: 'x") { secret } #', limit: 5 },
    origin: "https://api.linear.app",
    path: "/graphql",
    method: "POST",
  },
  {
    plugin: "linear",
    tool: "create_issue",
    args: { teamId: uuid, title: "Fix bug" },
    origin: "https://api.linear.app",
    path: "/graphql",
    method: "POST",
    mutation: true,
  },
  {
    plugin: "airtable",
    tool: "list_bases",
    args: {},
    origin: "https://api.airtable.com",
    path: "/v0/meta/bases",
  },
  {
    plugin: "airtable",
    tool: "list_records",
    args: { baseId: "app123", tableId: "Contact List", limit: 2 },
    origin: "https://api.airtable.com",
    path: "/v0/app123/Contact%20List",
    query: { pageSize: "2", maxRecords: "2" },
  },
  {
    plugin: "airtable",
    tool: "create_record",
    args: {
      baseId: "app123",
      tableId: "tbl123",
      fields: { Name: "A", Active: true },
    },
    origin: "https://api.airtable.com",
    path: "/v0/app123/tbl123",
    method: "POST",
    mutation: true,
    body: {
      records: [{ fields: { Name: "A", Active: true } }],
      typecast: false,
    },
  },
  {
    plugin: "asana",
    tool: "list_tasks",
    args: { projectId: "123", limit: 5 },
    origin: "https://app.asana.com",
    path: "/api/1.0/tasks",
    query: { project: "123", limit: "5" },
  },
  {
    plugin: "asana",
    tool: "list_projects",
    args: { workspaceId: "123", limit: 5 },
    origin: "https://app.asana.com",
    path: "/api/1.0/projects",
    query: { workspace: "123", limit: "5" },
  },
  {
    plugin: "asana",
    tool: "create_task",
    args: { workspaceId: "123", name: "Task", projectId: "456" },
    origin: "https://app.asana.com",
    path: "/api/1.0/tasks",
    method: "POST",
    mutation: true,
    body: { data: { workspace: "123", name: "Task", projects: ["456"] } },
  },
  {
    plugin: "todoist",
    tool: "list_tasks",
    args: { projectId: "123", limit: 5 },
    origin: "https://api.todoist.com",
    path: "/api/v1/tasks",
    query: { project_id: "123", limit: "5" },
  },
  {
    plugin: "todoist",
    tool: "create_task",
    args: { content: "Task", projectId: "123", priority: 4 },
    origin: "https://api.todoist.com",
    path: "/api/v1/tasks",
    method: "POST",
    mutation: true,
    body: { content: "Task", project_id: "123", priority: 4 },
  },
  {
    plugin: "dropbox",
    tool: "search_files",
    args: { query: "notes", limit: 5 },
    origin: "https://api.dropboxapi.com",
    path: "/2/files/search_v2",
    method: "POST",
    body: { query: "notes", options: { max_results: 5, filename_only: true } },
  },
  {
    plugin: "dropbox",
    tool: "list_folder",
    args: { path: "/Docs", limit: 5 },
    origin: "https://api.dropboxapi.com",
    path: "/2/files/list_folder",
    method: "POST",
    body: { path: "/Docs", recursive: false, include_deleted: false, limit: 5 },
  },
  {
    plugin: "dropbox",
    tool: "get_metadata",
    args: { path: "/Docs/notes.txt" },
    origin: "https://api.dropboxapi.com",
    path: "/2/files/get_metadata",
    method: "POST",
    body: { path: "/Docs/notes.txt", include_deleted: false },
  },
  {
    plugin: "dropbox",
    tool: "download_text",
    args: { path: "/Docs/notes.txt" },
    origin: "https://content.dropboxapi.com",
    path: "/2/files/download",
    method: "POST",
  },
  {
    plugin: "dropbox",
    tool: "create_folder",
    args: { path: "/Docs/New" },
    origin: "https://api.dropboxapi.com",
    path: "/2/files/create_folder_v2",
    method: "POST",
    mutation: true,
    body: { path: "/Docs/New", autorename: false },
  },
  {
    plugin: "zoom",
    tool: "list_meetings",
    args: { limit: 5 },
    origin: "https://api.zoom.us",
    path: "/v2/users/me/meetings",
    query: { type: "scheduled", page_size: "5" },
  },
  {
    plugin: "zoom",
    tool: "create_meeting",
    args: { topic: "Planning", start: event.start, duration: 30 },
    origin: "https://api.zoom.us",
    path: "/v2/users/me/meetings",
    method: "POST",
    mutation: true,
    body: {
      topic: "Planning",
      type: 2,
      start_time: "2026-10-12T09:00:00.000Z",
      duration: 30,
      timezone: "UTC",
    },
  },
  {
    plugin: "hubspot",
    tool: "search_contacts",
    args: { query: "person@example.com", limit: 5 },
    origin: "https://api.hubapi.com",
    path: "/crm/v3/objects/contacts/search",
    method: "POST",
    body: {
      query: "person@example.com",
      limit: 5,
      properties: ["email", "firstname", "lastname", "company"],
    },
  },
  {
    plugin: "hubspot",
    tool: "get_contact",
    args: { contactId: "123" },
    origin: "https://api.hubapi.com",
    path: "/crm/v3/objects/contacts/123",
    query: { properties: "email,firstname,lastname,company,phone" },
  },
  {
    plugin: "hubspot",
    tool: "create_contact",
    args: { email: "person@example.com", firstName: "A" },
    origin: "https://api.hubapi.com",
    path: "/crm/v3/objects/contacts",
    method: "POST",
    mutation: true,
    body: { properties: { email: "person@example.com", firstname: "A" } },
  },
];

function mockFetch(
  respond: (
    url: URL,
    init: RequestInit,
    index: number,
  ) => Response | Promise<Response>,
) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url, init });
    return respond(url, init, calls.length - 1);
  };
  return { fetcher, calls };
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

for (const example of examples) {
  test(`${example.plugin}/${example.tool}: official request shape and classification`, async () => {
    const mock = mockFetch((_url, _init, index) => {
      if (example.tool === "get_text")
        return index === 0
          ? json({ mimeType: "text/plain", size: "5" })
          : new Response("Notes");
      if (example.tool === "download_text") return new Response("Notes");
      return json({ ok: true, data: { issueCreate: { success: true } } });
    });
    await executeRestTool(example.plugin, example.tool, example.args, {
      accessToken: token,
      fetch: mock.fetcher,
    });
    assert.equal(mock.calls.length, example.tool === "get_text" ? 2 : 1);
    const { url, init } = mock.calls[0];
    assert.equal(url.origin, example.origin);
    assert.equal(url.pathname, example.path);
    assert.equal(init.method, example.method ?? "GET");
    for (const [key, value] of Object.entries(example.query ?? {}))
      assert.equal(url.searchParams.get(key), value);
    if (example.body)
      assert.deepEqual(JSON.parse(String(init.body)), example.body);
    for (const call of mock.calls) {
      assert.equal(call.init.redirect, "manual");
      assert.equal(call.init.cache, "no-store");
      assert.ok(call.init.signal instanceof AbortSignal);
      assert.equal(
        new Headers(call.init.headers).get("Authorization"),
        `Bearer ${token}`,
      );
      assert.ok(!call.url.href.includes(token));
      assert.ok(!String(call.init.body).includes(token));
      assert.ok(
        getConnector(example.plugin)?.allowedHosts?.includes(call.url.hostname),
      );
    }
    assert.equal(
      listRestTools(example.plugin).find((tool) => tool.name === example.tool)
        ?.readOnly,
      !example.mutation,
    );
    if (example.plugin === "linear") {
      const body = JSON.parse(String(init.body));
      assert.ok(!body.query.includes(String(example.args.query ?? "Fix bug")));
      assert.deepEqual(
        body.variables,
        example.tool === "search_issues"
          ? { query: example.args.query, first: 5 }
          : { input: { teamId: uuid, title: "Fix bug" } },
      );
    }
    if (example.tool === "create_file") {
      const contentType = new Headers(init.headers).get("Content-Type");
      if (example.plugin === "google-drive") {
        assert.match(
          contentType ?? "",
          /^multipart\/related; boundary=clauxen_/,
        );
        assert.match(String(init.body), /"parents":\["parent"\]/);
        assert.ok(String(init.body).includes("Notes"));
      } else {
        assert.equal(contentType, "text/plain; charset=utf-8");
        assert.equal(init.body, "Hello");
      }
    }
    if (example.tool === "download_text") {
      assert.deepEqual(
        JSON.parse(new Headers(init.headers).get("Dropbox-API-Arg") ?? ""),
        { path: "/Docs/notes.txt" },
      );
    }
  });
}

test("exact priority registry: 16 REST, GitHub delegated, three official MCP servers", () => {
  assert.equal(PRIORITY_CONNECTORS.length, 20);
  assert.deepEqual(
    CONNECTORS.map(({ id }) => id),
    PRIORITY_CONNECTORS.map(({ id }) => id),
  );
  assert.equal(new Set(CONNECTORS.map(({ id }) => id)).size, 20);
  assert.equal(
    CONNECTORS.filter(({ transport }) => transport === "rest").length,
    16,
  );
  for (const connector of CONNECTORS) {
    assert.equal(new URL(connector.registrationUrl).protocol, "https:");
    const listed = listRestTools(connector.id);
    if (connector.transport !== "rest") {
      assert.deepEqual(listed, []);
      assert.equal(connector.oauth, undefined);
    } else {
      assert.ok(listed.length >= 2);
      assert.deepEqual(
        listed.map(({ name }) => name).sort(),
        examples
          .filter(({ plugin }) => plugin === connector.id)
          .map(({ tool }) => tool)
          .sort(),
      );
      assert.ok(connector.oauth?.scopes.length);
      assert.match(connector.oauth!.provider, /^[a-z]+$/);
      for (const tool of listed) {
        assert.equal(tool.inputSchema.type, "object");
        assert.equal(tool.inputSchema.additionalProperties, false);
        assert.ok(tool.title && tool.description);
      }
    }
  }
  assert.equal(getConnector("notion")?.mcpUrl, "https://mcp.notion.com/mcp");
  assert.equal(
    getConnector("atlassian-mcp")?.mcpUrl,
    "https://mcp.atlassian.com/v2/mcp",
  );
  assert.equal(getConnector("figma")?.mcpUrl, "https://mcp.figma.com/mcp");
  assert.equal(getConnector("github")?.transport, "github");
  assert.equal(getConnector("unknown"), undefined);
  for (const plugin of ["gmail", "google-calendar", "google-drive"])
    assert.equal(getConnector(plugin)?.oauth?.provider, "google");
  for (const plugin of [
    "outlook",
    "outlook-calendar",
    "onedrive",
    "sharepoint",
    "teams",
  ])
    assert.equal(getConnector(plugin)?.oauth?.provider, "microsoft");
  const slack = getConnector("slack")!.oauth!;
  assert.equal(slack.extraAuthorize?.user_scope, slack.scopes.join(","));
  assert.ok(getConnector("teams")?.oauth?.scopes.includes("ChatMessage.Send"));
  assert.deepEqual(getConnector("airtable")?.oauth?.scopes, [
    "schema.bases:read",
    "data.records:read",
    "data.records:write",
  ]);
});

test("every tool rejects unknown arguments without fetching", async () => {
  const mock = mockFetch(() => {
    throw new Error("Must not fetch");
  });
  for (const connector of CONNECTORS) {
    for (const tool of listRestTools(connector.id)) {
      await assert.rejects(
        executeRestTool(
          connector.id,
          tool.name,
          { url: "https://evil.example/credentials" },
          { accessToken: token, fetch: mock.fetcher },
        ),
        /Invalid arguments/,
      );
    }
  }
  assert.equal(mock.calls.length, 0);
});

test("validation failures: email injection, traversal, limits, timestamps, scalar fields", async () => {
  const invalid: [ConnectorId, string, Record<string, unknown>][] = [
    [
      "gmail",
      "send_message",
      { ...mail, subject: "Hello\r\nBcc: hidden@example.com" },
    ],
    ["gmail", "create_draft", { ...mail, to: ["not-an-email"] }],
    ["gmail", "send_message", { raw: "arbitrary RFC2822" }],
    ["gmail", "get_message", { messageId: ".." }],
    ["outlook", "get_message", { messageId: "%2e%2e%2f" }],
    [
      "outlook",
      "send_message",
      { ...mail, to: ["a@example.com\r\nBcc: b@example.com"] },
    ],
    ["google-calendar", "create_event", { ...event, end: event.start }],
    ["outlook-calendar", "create_event", { ...event, start: "not-a-date" }],
    [
      "google-calendar",
      "list_events",
      { timeMin: event.end, timeMax: event.start },
    ],
    ["onedrive", "create_file", { name: "../notes.txt", content: "x" }],
    ["onedrive", "search_files", { query: "x')/content" }],
    ["dropbox", "list_folder", { path: "/folder/../outside" }],
    ["dropbox", "download_text", { path: "https://evil.example/file.txt" }],
    ["dropbox", "create_folder", { path: "" }],
    ["linear", "create_issue", { teamId: "not-uuid", title: "x" }],
    [
      "airtable",
      "create_record",
      {
        baseId: "app123",
        tableId: "tbl123",
        fields: { name: { nested: "not allowed" } },
      },
    ],
    ["todoist", "create_task", { content: "x", priority: 5 }],
    [
      "zoom",
      "create_meeting",
      { topic: "x", start: event.start, duration: 481 },
    ],
    ["hubspot", "create_contact", { email: "invalid" }],
    ["slack", "search_messages", { query: "x", limit: 51 }],
    ["asana", "list_projects", { workspaceId: "123", limit: 0 }],
    ["teams", "read_messages", { chatId: "123", limit: 1.5 }],
  ];
  const mock = mockFetch(() => json({ ok: true }));
  for (const [plugin, tool, args] of invalid) {
    await assert.rejects(
      executeRestTool(plugin, tool, args, {
        accessToken: token,
        fetch: mock.fetcher,
      }),
      /Invalid arguments/,
    );
  }
  assert.equal(mock.calls.length, 0);
});

test("Gmail encodes UTF-8 email safely and folds complete encoded words", async () => {
  const mock = mockFetch(() => json({ id: "sent" }));
  const subject = "こんにちは世界".repeat(12);
  const body = "Line 1\r\nBcc: stays in body\r\nこんにちは";
  await executeRestTool(
    "gmail",
    "send_message",
    { ...mail, subject, body },
    { accessToken: token, fetch: mock.fetcher },
  );
  const raw = JSON.parse(String(mock.calls[0].init.body)).raw;
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const message = Buffer.from(raw, "base64url").toString("utf8");
  const [headers, payload] = message.split("\r\n\r\n");
  assert.ok(!headers.includes("Bcc:"));
  assert.equal(
    Buffer.from(payload.replace(/\r\n/g, ""), "base64").toString("utf8"),
    body,
  );
  const decodedSubject = Array.from(
    headers.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g),
  )
    .map((match) => Buffer.from(match[1], "base64").toString("utf8"))
    .join("");
  assert.equal(decodedSubject, subject);
  for (const line of message.split("\r\n")) assert.ok(line.length < 998);
});

test("Drive exports Google Docs using a second fixed-origin call, never a download URL", async () => {
  const mock = mockFetch((_url, _init, index) =>
    index === 0
      ? json({
          mimeType: "application/vnd.google-apps.document",
          webContentLink: "https://evil.example/download",
        })
      : new Response("Document"),
  );
  assert.deepEqual(
    await executeRestTool(
      "google-drive",
      "get_text",
      { fileId: "doc" },
      { accessToken: token, fetch: mock.fetcher },
    ),
    { text: "Document", truncated: false },
  );
  assert.equal(mock.calls[1].url.origin, google);
  assert.equal(mock.calls[1].url.pathname, "/drive/v3/files/doc/export");
  assert.equal(mock.calls[1].url.searchParams.get("mimeType"), "text/plain");
});

test("non-text and oversized Drive files stop before content fetch", async () => {
  for (const metadata of [
    { mimeType: "application/pdf", size: "10" },
    { mimeType: "text/plain", size: "1048577" },
  ]) {
    const mock = mockFetch(() => json(metadata));
    await assert.rejects(
      executeRestTool(
        "google-drive",
        "get_text",
        { fileId: "doc" },
        { accessToken: token, fetch: mock.fetcher },
      ),
    );
    assert.equal(mock.calls.length, 1);
  }
});

test("credential redaction, preauth URL removal, bounded arrays and text", async () => {
  const mock = mockFetch(() =>
    json({
      access_token: "another-secret",
      refreshToken: "another-secret",
      start_url: "host-secret",
      password: "123",
      "@microsoft.graph.downloadUrl": "https://evil.example/download",
      "@odata.nextLink": `https://evil.example/${token}`,
      nested: { authorization: "secret", title: `ordinary ${token} text` },
      results: Array.from({ length: 80 }, (_, id) => ({ id })),
      description: "x".repeat(20_000),
    }),
  );
  const result = (await executeRestTool(
    "onedrive",
    "get_item",
    { itemId: "file" },
    { accessToken: token, fetch: mock.fetcher },
  )) as Record<string, unknown>;
  assert.equal((result.results as unknown[]).length, 50);
  assert.equal((result.description as string).length, 12_000);
  assert.deepEqual(result.nested, { title: "ordinary [redacted] text" });
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.ok(!JSON.stringify(result).includes("evil.example"));
  assert.equal(mock.calls.length, 1);
});

test("large JSON and chunked text responses are bounded before parsing", async () => {
  for (const response of [
    new Response("ignored", { headers: { "Content-Length": "1048577" } }),
    new Response("x".repeat(1_048_577)),
  ]) {
    const mock = mockFetch(() => response);
    await assert.rejects(
      executeRestTool(
        "outlook",
        "list_messages",
        {},
        { accessToken: token, fetch: mock.fetcher },
      ),
      /outlook request failed \(HTTP 200\)/,
    );
    assert.equal(mock.calls.length, 1);
  }
  const mock = mockFetch(() => new Response("x".repeat(20_000)));
  const result = (await executeRestTool(
    "dropbox",
    "download_text",
    { path: "/notes.txt" },
    { accessToken: token, fetch: mock.fetcher },
  )) as { text: string; truncated: boolean };
  assert.equal(result.text.length, 12_000);
  assert.equal(result.truncated, true);
});

test("provider/network errors are generic; writes never retry or expose secrets", async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    const mock = mockFetch(() =>
      json({ error: token, description: "private provider message" }, status),
    );
    await assert.rejects(
      executeRestTool("gmail", "send_message", mail, {
        accessToken: token,
        fetch: mock.fetcher,
      }),
      (error: Error) =>
        error.message.includes(`HTTP ${status}`) &&
        !error.message.includes(token) &&
        !error.message.includes("private provider"),
    );
    assert.equal(mock.calls.length, 1);
  }
  const mock = mockFetch(() => {
    throw new Error(`Redirect to https://evil.example/?access_token=${token}`);
  });
  await assert.rejects(
    executeRestTool(
      "slack",
      "post_message",
      { conversationId: "C123", text: "Hi" },
      { accessToken: token, fetch: mock.fetcher },
    ),
    /^Error: slack request failed; write outcome may be unknown\.$/,
  );
  assert.equal(mock.calls.length, 1);
});

test("HTTP 200 logical errors and malformed JSON are failures, not false successes", async () => {
  const cases: [ConnectorId, string, Record<string, unknown>, unknown][] = [
    [
      "slack",
      "post_message",
      { conversationId: "C123", text: "Hi" },
      { ok: false, error: token },
    ],
    [
      "linear",
      "create_issue",
      { teamId: uuid, title: "Task" },
      { errors: [{ message: token }] },
    ],
    [
      "linear",
      "create_issue",
      { teamId: uuid, title: "Task" },
      { data: { issueCreate: { success: false } } },
    ],
  ];
  for (const [plugin, tool, args, response] of cases) {
    const mock = mockFetch(() => json(response));
    await assert.rejects(
      executeRestTool(plugin, tool, args, {
        accessToken: token,
        fetch: mock.fetcher,
      }),
      /HTTP 200/,
    );
    assert.equal(mock.calls.length, 1);
  }
  const mock = mockFetch(() => new Response(`not JSON ${token}`));
  await assert.rejects(
    executeRestTool("gmail", "send_message", mail, {
      accessToken: token,
      fetch: mock.fetcher,
    }),
    /HTTP 200/,
  );
});

test("202 mail response is accepted rather than incorrectly claimed delivered", async () => {
  const mock = mockFetch(() => new Response(null, { status: 202 }));
  assert.deepEqual(
    await executeRestTool("outlook", "send_message", mail, {
      accessToken: token,
      fetch: mock.fetcher,
    }),
    { accepted: true },
  );
});

test("deadline bounds even an injected fetch that ignores AbortSignal", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const mock = mockFetch(() => new Promise<Response>(() => undefined));
  const promise = executeRestTool("gmail", "send_message", mail, {
    accessToken: token,
    fetch: mock.fetcher,
  });
  const rejection = assert.rejects(
    promise,
    /gmail request timed out; write outcome may be unknown/,
  );
  t.mock.timers.tick(20_000);
  await rejection;
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].init.signal?.aborted, true);
});

test("result budget bounds aggregate text; credential validation prevents fetching", async () => {
  const mock = mockFetch(() =>
    json({ values: Array.from({ length: 50 }, () => "x".repeat(12_000)) }),
  );
  const result = await executeRestTool(
    "outlook",
    "list_messages",
    {},
    { accessToken: token, fetch: mock.fetcher },
  );
  assert.ok(JSON.stringify(result).length < 62_000);
  for (const accessToken of [
    "",
    "token\r\nInjected: header",
    "x".repeat(16_385),
  ]) {
    await assert.rejects(
      executeRestTool(
        "outlook",
        "list_messages",
        {},
        { accessToken, fetch: mock.fetcher },
      ),
      /Invalid connector credentials/,
    );
  }
  assert.equal(mock.calls.length, 1);
});

test("tool-list copies cannot reclassify mutations; unknown tools cannot fetch", async () => {
  const listed = listRestTools("gmail");
  listed.find(({ name }) => name === "send_message")!.readOnly = true;
  assert.equal(
    listRestTools("gmail").find(({ name }) => name === "send_message")!
      .readOnly,
    false,
  );
  const mock = mockFetch(() => json({}));
  for (const plugin of [
    "github",
    "notion",
    "atlassian-mcp",
    "figma",
  ] as ConnectorId[]) {
    await assert.rejects(
      executeRestTool(
        plugin,
        "request",
        {},
        { accessToken: token, fetch: mock.fetcher },
      ),
      /Unknown REST/,
    );
  }
  await assert.rejects(
    executeRestTool(
      "gmail",
      "request",
      { url: "https://evil.example" },
      { accessToken: token, fetch: mock.fetcher },
    ),
    /Unknown REST/,
  );
  assert.equal(mock.calls.length, 0);
});
