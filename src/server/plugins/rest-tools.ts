import { z } from "zod";
import type {
  ConnectorId,
  ConnectorTool,
} from "../../shared/lib/plugin-connectors";
import { getConnector } from "./registry";

type ExecutionContext = { accessToken: string; fetch?: typeof fetch };
type RequestSpec = {
  url: URL;
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  text?: boolean;
};
type Request = (spec: RequestSpec) => Promise<unknown>;
type Tool = {
  public: ConnectorTool;
  run: (args: Record<string, unknown>, request: Request) => Promise<unknown>;
};
const tools = new Map<ConnectorId, Tool[]>();

const MAX_BYTES = 1_048_576;
const MAX_PAGE = 50;
const text = z.string().min(1).max(12_000);
const query = z.string().min(1).max(500);
const id = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[^%\\?#\x00-\x1f\x7f]+$/)
  .refine(
    (value) =>
      value.trim().length > 0 &&
      value.split("/").every((part) => part !== "." && part !== ".."),
    "Invalid ID",
  );
const limit = z.number().int().min(1).max(MAX_PAGE).default(20);
const dateTime = z.iso.datetime({ offset: true });
const headerText = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[^\r\n\x00-\x1f\x7f]+$/);
const email = z
  .email()
  .max(254)
  .regex(/^[^\r\n\x00-\x1f\x7f]+$/);
const mail = z.strictObject({
  to: z.array(email).min(1).max(20),
  subject: headerText,
  body: text,
});
const fileName = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[^/\\:*?"<>|%\x00-\x1f\x7f]+$/)
  .refine(
    (value) => value !== "." && value !== ".." && !/[. ]$/.test(value),
    "Invalid filename",
  );
const event = z
  .strictObject({
    title: headerText,
    start: dateTime,
    end: dateTime,
    description: text.optional(),
  })
  .refine(
    (value) => Date.parse(value.end) > Date.parse(value.start),
    "End must follow start",
  );
const scalar = z.union([
  z.string().max(12_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const fields = z
  .record(
    z
      .string()
      .min(1)
      .max(200)
      .refine(
        (key) => !["__proto__", "constructor", "prototype"].includes(key),
      ),
    z.union([scalar, z.array(scalar).max(20)]),
  )
  .refine(
    (value) => Object.keys(value).length > 0 && Object.keys(value).length <= 50,
    "Use 1–50 fields",
  );
const dropboxPath = z
  .string()
  .max(1_000)
  .refine((value) => {
    if (value === "") return true;
    return (
      value.startsWith("/") &&
      !/[\x00-\x1f\x7f\\]/.test(value) &&
      value
        .slice(1)
        .split("/")
        .every((part) => part && part !== "." && part !== "..")
    );
  }, "Use a Dropbox path, not a URL or traversal");

// Each ID is a single encoded segment, never a user-supplied path or URL.
const segment = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
type Origin =
  | "https://gmail.googleapis.com"
  | "https://www.googleapis.com"
  | "https://graph.microsoft.com"
  | "https://slack.com"
  | "https://api.linear.app"
  | "https://api.airtable.com"
  | "https://app.asana.com"
  | "https://api.todoist.com"
  | "https://api.dropboxapi.com"
  | "https://content.dropboxapi.com"
  | "https://api.zoom.us"
  | "https://api.hubapi.com";
function endpoint(
  origin: Origin,
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): URL {
  const url = new URL(origin + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}
const gmail = (path: string, params = {}) =>
  endpoint("https://gmail.googleapis.com", `/gmail/v1/users/me${path}`, params);
const graph = (path: string, params = {}) =>
  endpoint("https://graph.microsoft.com", `/v1.0${path}`, params);
const drive = (path: string, params = {}) =>
  endpoint("https://www.googleapis.com", `/drive/v3${path}`, params);
const slack = (method: string, params = {}) =>
  endpoint("https://slack.com", `/api/${method}`, params);
const asana = (path: string, params = {}) =>
  endpoint("https://app.asana.com", `/api/1.0${path}`, params);
const dropbox = (method: string) =>
  endpoint("https://api.dropboxapi.com", `/2/files/${method}`);
const hubspot = (path: string) =>
  endpoint("https://api.hubapi.com", `/crm/v3/objects/contacts${path}`);

function add<S extends z.ZodType>(
  pluginId: ConnectorId,
  name: string,
  title: string,
  description: string,
  readOnly: boolean,
  schema: S,
  run: (args: z.output<S>, request: Request) => Promise<unknown>,
) {
  const entries = tools.get(pluginId) ?? [];
  entries.push({
    public: {
      name,
      title,
      description,
      readOnly,
      inputSchema: z.toJSONSchema(schema) as Record<string, unknown>,
    },
    run: async (args, request) => {
      const parsed = schema.safeParse(args);
      if (!parsed.success)
        throw new Error(`Invalid arguments for ${pluginId}/${name}.`);
      return run(parsed.data, request);
    },
  });
  tools.set(pluginId, entries);
}

function rfc2822(args: z.output<typeof mail>): string {
  // No arbitrary raw email or headers. Each encoded word contains complete UTF-8 characters.
  const words: string[] = [];
  let chunk = "";
  for (const character of Array.from(args.subject)) {
    if (Buffer.byteLength(chunk + character) > 30) {
      words.push(`=?UTF-8?B?${Buffer.from(chunk).toString("base64")}?=`);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) words.push(`=?UTF-8?B?${Buffer.from(chunk).toString("base64")}?=`);
  const body =
    Buffer.from(args.body)
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? "";
  return Buffer.from(
    [
      `To: ${args.to.join(",\r\n ")}`,
      `Subject: ${words.join("\r\n ")}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      body,
    ].join("\r\n"),
  ).toString("base64url");
}

add(
  "gmail",
  "search_messages",
  "Search Gmail",
  "Search the connected user's mailbox; returns message IDs, at most 50 per call.",
  true,
  z.strictObject({ query, limit }),
  (a, request) =>
    request({ url: gmail("/messages", { q: a.query, maxResults: a.limit }) }),
);
add(
  "gmail",
  "get_message",
  "Read Gmail message",
  "Read a message's headers, snippet and bounded MIME payload from the user's mailbox.",
  true,
  z.strictObject({ messageId: id }),
  (a, request) =>
    request({
      url: gmail(`/messages/${segment(a.messageId)}`, { format: "full" }),
    }),
);
add(
  "gmail",
  "create_draft",
  "Create Gmail draft",
  "Create a plain-text draft addressed to the specified recipients in the user's mailbox. Does not send.",
  false,
  mail,
  (a, request) =>
    request({
      url: gmail("/drafts"),
      method: "POST",
      body: { message: { raw: rfc2822(a) } },
    }),
);
add(
  "gmail",
  "send_message",
  "Send Gmail message",
  "Send a plain-text email as the connected user to the exact specified recipients.",
  false,
  mail,
  (a, request) =>
    request({
      url: gmail("/messages/send"),
      method: "POST",
      body: { raw: rfc2822(a) },
    }),
);

add(
  "google-calendar",
  "list_events",
  "List Google Calendar events",
  "Read up to 50 events from a calendar accessible to the connected user, optionally within a time range.",
  true,
  z
    .strictObject({
      calendarId: id.default("primary"),
      timeMin: dateTime.optional(),
      timeMax: dateTime.optional(),
      limit,
    })
    .refine(
      (a) =>
        !a.timeMin ||
        !a.timeMax ||
        Date.parse(a.timeMax) > Date.parse(a.timeMin),
    ),
  (a, request) =>
    request({
      url: endpoint(
        "https://www.googleapis.com",
        `/calendar/v3/calendars/${segment(a.calendarId)}/events`,
        {
          maxResults: a.limit,
          singleEvents: true,
          orderBy: "startTime",
          timeMin: a.timeMin,
          timeMax: a.timeMax,
        },
      ),
    }),
);
add(
  "google-calendar",
  "create_event",
  "Create Google Calendar event",
  "Create a timed event in the specified user-accessible calendar. No attendees or invitation emails are added.",
  false,
  event.safeExtend({ calendarId: id.default("primary") }),
  (a, request) =>
    request({
      url: endpoint(
        "https://www.googleapis.com",
        `/calendar/v3/calendars/${segment(a.calendarId)}/events`,
      ),
      method: "POST",
      body: {
        summary: a.title,
        description: a.description,
        start: { dateTime: a.start },
        end: { dateTime: a.end },
      },
    }),
);

add(
  "google-drive",
  "search_files",
  "Search Google Drive",
  "Search file names in all Drive files visible to the user (drive.readonly); excludes trashed files.",
  true,
  z.strictObject({ query, limit }),
  (a, request) => {
    const literal = a.query.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return request({
      url: drive("/files", {
        q: `trashed = false and name contains '${literal}'`,
        pageSize: a.limit,
        fields: "files(id,name,mimeType,size,modifiedTime),nextPageToken",
      }),
    });
  },
);
add(
  "google-drive",
  "get_text",
  "Read Drive text",
  "Read a UTF-8 text file (maximum 1 MiB) or export a Google Doc as plain text; no external download links followed.",
  true,
  z.strictObject({ fileId: id }),
  async (a, request) => {
    const metadata = (await request({
      url: drive(`/files/${segment(a.fileId)}`, {
        fields: "id,name,mimeType,size",
      }),
    })) as { mimeType?: string; size?: string };
    if (Number(metadata.size) > MAX_BYTES)
      throw new Error("google-drive response too large.");
    if (metadata.mimeType === "application/vnd.google-apps.document") {
      return request({
        url: drive(`/files/${segment(a.fileId)}/export`, {
          mimeType: "text/plain",
        }),
        text: true,
      });
    }
    if (!metadata.mimeType?.startsWith("text/"))
      throw new Error("google-drive file is not supported text.");
    return request({
      url: drive(`/files/${segment(a.fileId)}`, { alt: "media" }),
      text: true,
    });
  },
);
add(
  "google-drive",
  "create_file",
  "Create Drive text file",
  "Create a new plain-text file in Drive, optionally in a specified folder (drive.file). Does not overwrite files.",
  false,
  z.strictObject({
    name: fileName,
    content: z.string().max(100_000),
    parentId: id.optional(),
  }),
  (a, request) => {
    const boundary = `clauxen_${crypto.randomUUID()}`;
    const metadata = {
      name: a.name,
      mimeType: "text/plain",
      ...(a.parentId ? { parents: [a.parentId] } : {}),
    };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${a.content}\r\n--${boundary}--\r\n`;
    return request({
      url: endpoint("https://www.googleapis.com", "/upload/drive/v3/files", {
        uploadType: "multipart",
        fields: "id,name,mimeType",
      }),
      method: "POST",
      rawBody: body,
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    });
  },
);

add(
  "slack",
  "search_messages",
  "Search Slack messages",
  "Search messages visible to the connected Slack user (search:read), including private conversations they can access.",
  true,
  z.strictObject({ query, limit }),
  (a, request) =>
    request({
      url: slack("search.messages", {
        query: a.query,
        count: a.limit,
        highlight: false,
      }),
    }),
);
add(
  "slack",
  "list_conversations",
  "List Slack conversations",
  "List public/private channels, DMs and group DMs accessible to the connected user. Maximum 50.",
  true,
  z.strictObject({ limit }),
  (a, request) =>
    request({
      url: slack("conversations.list", {
        limit: a.limit,
        exclude_archived: true,
        types: "public_channel,private_channel,mpim,im",
      }),
    }),
);
add(
  "slack",
  "post_message",
  "Post Slack message",
  "Post text as the connected user to the specified conversation (chat:write); mentions may notify recipients. Link unfurling disabled.",
  false,
  z.strictObject({
    conversationId: id,
    text,
    threadTs: z
      .string()
      .regex(/^\d+\.\d+$/)
      .max(40)
      .optional(),
  }),
  (a, request) =>
    request({
      url: slack("chat.postMessage"),
      method: "POST",
      body: {
        channel: a.conversationId,
        text: a.text,
        thread_ts: a.threadTs,
        unfurl_links: false,
        unfurl_media: false,
      },
    }),
);

add(
  "outlook",
  "list_messages",
  "List Outlook messages",
  "Read up to 50 recent messages in the connected user's mailbox (Mail.Read).",
  true,
  z.strictObject({ limit }),
  (a, request) =>
    request({
      url: graph("/me/messages", {
        $top: a.limit,
        $select: "id,subject,from,toRecipients,receivedDateTime,bodyPreview",
        $orderby: "receivedDateTime desc",
      }),
    }),
);
add(
  "outlook",
  "get_message",
  "Read Outlook message",
  "Read a specific email's sender, recipients and text body in the connected user's mailbox.",
  true,
  z.strictObject({ messageId: id }),
  (a, request) =>
    request({
      url: graph(`/me/messages/${segment(a.messageId)}`, {
        $select: "id,subject,from,toRecipients,receivedDateTime,body",
      }),
      headers: { Prefer: 'outlook.body-content-type="text"' },
    }),
);
add(
  "outlook",
  "send_message",
  "Send Outlook message",
  "Send plain-text email as the connected user to the exact specified recipients (Mail.Send). A successful response means accepted, not delivered.",
  false,
  mail,
  (a, request) =>
    request({
      url: graph("/me/sendMail"),
      method: "POST",
      body: {
        message: {
          subject: a.subject,
          body: { contentType: "Text", content: a.body },
          toRecipients: a.to.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: true,
      },
    }),
);
add(
  "outlook-calendar",
  "list_events",
  "List Outlook Calendar events",
  "Read up to 50 events from the connected user's default calendar (Calendars.ReadWrite).",
  true,
  z.strictObject({ limit }),
  (a, request) =>
    request({
      url: graph("/me/events", {
        $top: a.limit,
        $select: "id,subject,start,end,location,bodyPreview",
        $orderby: "start/dateTime",
      }),
    }),
);
add(
  "outlook-calendar",
  "create_event",
  "Create Outlook Calendar event",
  "Create a timed event in the connected user's default calendar. No attendees or invitations are added.",
  false,
  event,
  (a, request) =>
    request({
      url: graph("/me/events"),
      method: "POST",
      body: {
        subject: a.title,
        body: { contentType: "Text", content: a.description ?? "" },
        start: {
          dateTime: new Date(a.start).toISOString().replace(/Z$/, ""),
          timeZone: "UTC",
        },
        end: {
          dateTime: new Date(a.end).toISOString().replace(/Z$/, ""),
          timeZone: "UTC",
        },
      },
    }),
);

const driveSelect =
  "id,name,size,file,folder,parentReference,lastModifiedDateTime";
add(
  "onedrive",
  "search_files",
  "Search OneDrive",
  "Search the connected user's drive (Files.ReadWrite). Returns metadata only; download URLs are never exposed.",
  true,
  z.strictObject({ query: query.regex(/^[^'\x00-\x1f\x7f]+$/), limit }),
  (a, request) =>
    request({
      url: graph(`/me/drive/root/search(q='${segment(a.query)}')`, {
        $top: a.limit,
        $select: driveSelect,
      }),
    }),
);
add(
  "onedrive",
  "list_items",
  "List OneDrive folder",
  "List up to 50 items in the connected user's root or specified folder; metadata only.",
  true,
  z.strictObject({ folderId: id.optional(), limit }),
  (a, request) =>
    request({
      url: graph(
        a.folderId
          ? `/me/drive/items/${segment(a.folderId)}/children`
          : "/me/drive/root/children",
        { $top: a.limit, $select: driveSelect },
      ),
    }),
);
// Graph /content returns a preauthenticated external URL. Strict redirect:error/no external fetch
// deliberately permits metadata reads only, not a nonfunctional or credential-leaking download tool.
add(
  "onedrive",
  "get_item",
  "Read OneDrive item metadata",
  "Read file/folder metadata, not file contents. Graph content downloads require external redirects and are not supported here.",
  true,
  z.strictObject({ itemId: id }),
  (a, request) =>
    request({
      url: graph(`/me/drive/items/${segment(a.itemId)}`, {
        $select: driveSelect,
      }),
    }),
);
add(
  "onedrive",
  "create_file",
  "Create OneDrive text file",
  "Create a new UTF-8 text file in the root or specified folder (Files.ReadWrite). Name conflicts fail; existing content is not overwritten.",
  false,
  z.strictObject({
    name: fileName,
    content: z.string().max(100_000),
    parentId: id.optional(),
  }),
  (a, request) =>
    request({
      url: graph(
        a.parentId
          ? `/me/drive/items/${segment(a.parentId)}:/${segment(a.name)}:/content`
          : `/me/drive/root:/${segment(a.name)}:/content`,
        { "@microsoft.graph.conflictBehavior": "fail" },
      ),
      method: "PUT",
      rawBody: a.content,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
);

add(
  "sharepoint",
  "search_sites",
  "Search SharePoint sites",
  "Search sites visible to the connected organizational user (Sites.Read.All). Tenant consent may be required.",
  true,
  z.strictObject({ query, limit }),
  (a, request) =>
    request({
      url: graph("/sites", {
        search: a.query,
        $top: a.limit,
        $select: "id,displayName,webUrl,description",
      }),
    }),
);
add(
  "sharepoint",
  "list_drives",
  "List SharePoint document libraries",
  "Read document libraries of the specified site (Sites.Read.All); no modifications.",
  true,
  z.strictObject({ siteId: id, limit }),
  (a, request) =>
    request({
      url: graph(`/sites/${segment(a.siteId)}/drives`, {
        $top: a.limit,
        $select: "id,name,driveType,webUrl",
      }),
    }),
);
add(
  "sharepoint",
  "list_drive_items",
  "List SharePoint library items",
  "Read up to 50 file/folder metadata entries in a document library root or specified folder (Sites.Read.All).",
  true,
  z.strictObject({ driveId: id, folderId: id.optional(), limit }),
  (a, request) =>
    request({
      url: graph(
        `/drives/${segment(a.driveId)}/${a.folderId ? `items/${segment(a.folderId)}` : "root"}/children`,
        { $top: a.limit, $select: driveSelect },
      ),
    }),
);

add(
  "teams",
  "list_teams",
  "List joined Teams",
  "Read the organizational user's joined teams (Team.ReadBasic.All). Personal Microsoft accounts are unsupported.",
  true,
  z.strictObject({}),
  (_a, request) =>
    request({
      url: graph("/me/joinedTeams", { $select: "id,displayName,description" }),
    }),
);
add(
  "teams",
  "list_chats",
  "List Teams chats",
  "Read up to 50 of the connected organizational user's chats (Chat.Read).",
  true,
  z.strictObject({ limit }),
  (a, request) =>
    request({
      url: graph("/me/chats", {
        $top: a.limit,
        $select: "id,topic,chatType,lastUpdatedDateTime",
      }),
    }),
);
add(
  "teams",
  "read_messages",
  "Read Teams chat messages",
  "Read up to 50 messages in a chat accessible to the organizational user (Chat.Read).",
  true,
  z.strictObject({ chatId: id, limit }),
  (a, request) =>
    request({
      url: graph(`/chats/${segment(a.chatId)}/messages`, { $top: a.limit }),
    }),
);
add(
  "teams",
  "send_chat_message",
  "Send Teams chat message",
  "Send plain text as the connected organizational user in the exact specified existing chat (ChatMessage.Send).",
  false,
  z.strictObject({ chatId: id, text }),
  (a, request) =>
    request({
      url: graph(`/chats/${segment(a.chatId)}/messages`),
      method: "POST",
      body: { body: { contentType: "text", content: a.text } },
    }),
);

add(
  "linear",
  "search_issues",
  "Search Linear issues",
  "Search issue titles visible to the connected Linear user (read). Variables are used, never interpolated GraphQL.",
  true,
  z.strictObject({ query, limit }),
  (a, request) =>
    request({
      url: endpoint("https://api.linear.app", "/graphql"),
      method: "POST",
      body: {
        query:
          "query SearchIssues($query: String!, $first: Int!) { issues(first: $first, filter: { title: { containsIgnoreCase: $query } }) { nodes { id identifier title description url team { id name key } project { id name } state { name } } pageInfo { hasNextPage endCursor } } }",
        variables: { query: a.query, first: a.limit },
      },
    }),
);
add(
  "linear",
  "create_issue",
  "Create Linear issue",
  "Create an issue in the exact specified team (issues:create), optionally assigned to a project. No updates to existing issues.",
  false,
  z.strictObject({
    teamId: z.uuid(),
    title: headerText,
    description: text.optional(),
    projectId: z.uuid().optional(),
  }),
  (a, request) =>
    request({
      url: endpoint("https://api.linear.app", "/graphql"),
      method: "POST",
      body: {
        query:
          "mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }",
        variables: {
          input: {
            teamId: a.teamId,
            title: a.title,
            description: a.description,
            projectId: a.projectId,
          },
        },
      },
    }),
);

add(
  "airtable",
  "list_bases",
  "List Airtable bases",
  "Read bases granted to this OAuth connection (schema.bases:read). Returns at most 50; no additional pages fetched.",
  true,
  z.strictObject({}),
  (_a, request) =>
    request({ url: endpoint("https://api.airtable.com", "/v0/meta/bases") }),
);
add(
  "airtable",
  "list_records",
  "List Airtable records",
  "Read up to 50 records in a specified granted base/table (data.records:read).",
  true,
  z.strictObject({ baseId: id, tableId: id, limit }),
  (a, request) =>
    request({
      url: endpoint(
        "https://api.airtable.com",
        `/v0/${segment(a.baseId)}/${segment(a.tableId)}`,
        { pageSize: a.limit, maxRecords: a.limit },
      ),
    }),
);
add(
  "airtable",
  "create_record",
  "Create Airtable record",
  "Create one record in the exact specified base/table (data.records:write). Only bounded scalar or scalar-list field values; no typecasting.",
  false,
  z.strictObject({ baseId: id, tableId: id, fields }),
  (a, request) =>
    request({
      url: endpoint(
        "https://api.airtable.com",
        `/v0/${segment(a.baseId)}/${segment(a.tableId)}`,
      ),
      method: "POST",
      body: { records: [{ fields: a.fields }], typecast: false },
    }),
);

add(
  "asana",
  "list_tasks",
  "List Asana tasks",
  "Read up to 50 tasks from the specified accessible project (tasks:read).",
  true,
  z.strictObject({ projectId: id, limit }),
  (a, request) =>
    request({
      url: asana("/tasks", {
        project: a.projectId,
        limit: a.limit,
        opt_fields: "gid,name,completed,due_on,permalink_url",
      }),
    }),
);
add(
  "asana",
  "list_projects",
  "List Asana projects",
  "Read up to 50 projects in the specified workspace (projects:read).",
  true,
  z.strictObject({ workspaceId: id, limit }),
  (a, request) =>
    request({
      url: asana("/projects", {
        workspace: a.workspaceId,
        limit: a.limit,
        opt_fields: "gid,name,archived,permalink_url",
      }),
    }),
);
add(
  "asana",
  "create_task",
  "Create Asana task",
  "Create a task in the specified workspace, optionally in one project (tasks:write).",
  false,
  z.strictObject({
    workspaceId: id,
    name: headerText,
    notes: text.optional(),
    projectId: id.optional(),
    dueOn: z.iso.date().optional(),
  }),
  (a, request) =>
    request({
      url: asana("/tasks"),
      method: "POST",
      body: {
        data: {
          workspace: a.workspaceId,
          name: a.name,
          notes: a.notes,
          ...(a.projectId ? { projects: [a.projectId] } : {}),
          due_on: a.dueOn,
        },
      },
    }),
);

add(
  "todoist",
  "list_tasks",
  "List Todoist tasks",
  "Read up to 50 active tasks of the connected user, optionally in one project (data:read). Uses API v1, not retired REST v2.",
  true,
  z.strictObject({ projectId: id.optional(), limit }),
  (a, request) =>
    request({
      url: endpoint("https://api.todoist.com", "/api/v1/tasks", {
        project_id: a.projectId,
        limit: a.limit,
      }),
    }),
);
add(
  "todoist",
  "create_task",
  "Create Todoist task",
  "Create a task for the connected user (task:add), optionally in one project with a due date. Priority ranges from 1 (normal) to 4 (urgent).",
  false,
  z.strictObject({
    content: text,
    description: text.optional(),
    projectId: id.optional(),
    dueDate: z.iso.date().optional(),
    priority: z.number().int().min(1).max(4).default(1),
  }),
  (a, request) =>
    request({
      url: endpoint("https://api.todoist.com", "/api/v1/tasks"),
      method: "POST",
      body: {
        content: a.content,
        description: a.description,
        project_id: a.projectId,
        due_date: a.dueDate,
        priority: a.priority,
      },
      headers: { "X-Request-Id": crypto.randomUUID() },
    }),
);

add(
  "dropbox",
  "search_files",
  "Search Dropbox",
  "Search file names accessible under this Dropbox app's granted access (files.metadata.read). At most 50 matches.",
  true,
  z.strictObject({ query, limit }),
  (a, request) =>
    request({
      url: dropbox("search_v2"),
      method: "POST",
      body: {
        query: a.query,
        options: { max_results: a.limit, filename_only: true },
      },
    }),
);
add(
  "dropbox",
  "list_folder",
  "List Dropbox folder",
  "Read file/folder metadata under the specified Dropbox path (files.metadata.read). Empty path means root; no recursive listing.",
  true,
  z.strictObject({ path: dropboxPath.default(""), limit }),
  (a, request) =>
    request({
      url: dropbox("list_folder"),
      method: "POST",
      body: {
        path: a.path,
        recursive: false,
        include_deleted: false,
        limit: a.limit,
      },
    }),
);
add(
  "dropbox",
  "get_metadata",
  "Read Dropbox file metadata",
  "Read metadata of a specific file or folder (files.metadata.read). No temporary links returned.",
  true,
  z.strictObject({ path: dropboxPath.refine((value) => value !== "") }),
  (a, request) =>
    request({
      url: dropbox("get_metadata"),
      method: "POST",
      body: { path: a.path, include_deleted: false },
    }),
);
add(
  "dropbox",
  "download_text",
  "Read Dropbox text file",
  "Download a UTF-8 text file of at most 1 MiB from the fixed official content API (files.content.read). No provider-supplied URLs are fetched.",
  true,
  z.strictObject({
    path: dropboxPath.refine((value) =>
      /\.(txt|md|csv|json|log|xml|html|css|js|ts)$/i.test(value),
    ),
  }),
  (a, request) =>
    request({
      url: endpoint("https://content.dropboxapi.com", "/2/files/download"),
      method: "POST",
      text: true,
      headers: {
        "Dropbox-API-Arg": JSON.stringify({ path: a.path }).replace(
          /[\u007f-\uffff]/g,
          (character) =>
            `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
        ),
      },
    }),
);
add(
  "dropbox",
  "create_folder",
  "Create Dropbox folder",
  "Create exactly the specified folder path (files.content.write); name conflicts fail rather than autorenaming.",
  false,
  z.strictObject({ path: dropboxPath.refine((value) => value !== "") }),
  (a, request) =>
    request({
      url: dropbox("create_folder_v2"),
      method: "POST",
      body: { path: a.path, autorename: false },
    }),
);

add(
  "zoom",
  "list_meetings",
  "List Zoom meetings",
  "Read up to 50 scheduled meetings for the connected Zoom user (meeting:read:list_meetings).",
  true,
  z.strictObject({ limit }),
  (a, request) =>
    request({
      url: endpoint("https://api.zoom.us", "/v2/users/me/meetings", {
        type: "scheduled",
        page_size: a.limit,
      }),
    }),
);
add(
  "zoom",
  "create_meeting",
  "Create Zoom meeting",
  "Create a scheduled meeting hosted by the connected user (meeting:write:meeting). Does not send invitations. Host start URLs/passwords are removed from output.",
  false,
  z.strictObject({
    topic: headerText,
    start: dateTime,
    duration: z.number().int().min(1).max(480),
    agenda: text.optional(),
  }),
  (a, request) =>
    request({
      url: endpoint("https://api.zoom.us", "/v2/users/me/meetings"),
      method: "POST",
      body: {
        topic: a.topic,
        type: 2,
        start_time: new Date(a.start).toISOString(),
        duration: a.duration,
        timezone: "UTC",
        agenda: a.agenda,
      },
    }),
);

add(
  "hubspot",
  "search_contacts",
  "Search HubSpot contacts",
  "Search up to 50 contacts visible to the connected HubSpot account (crm.objects.contacts.read).",
  true,
  z.strictObject({ query, limit }),
  (a, request) =>
    request({
      url: hubspot("/search"),
      method: "POST",
      body: {
        query: a.query,
        limit: a.limit,
        properties: ["email", "firstname", "lastname", "company"],
      },
    }),
);
add(
  "hubspot",
  "get_contact",
  "Read HubSpot contact",
  "Read a contact's email, name, company and phone (crm.objects.contacts.read).",
  true,
  z.strictObject({ contactId: id }),
  (a, request) =>
    request({
      url: (() => {
        const url = hubspot(`/${segment(a.contactId)}`);
        url.searchParams.set(
          "properties",
          "email,firstname,lastname,company,phone",
        );
        return url;
      })(),
    }),
);
add(
  "hubspot",
  "create_contact",
  "Create HubSpot contact",
  "Create one contact with the exact email and optional name/company/phone (crm.objects.contacts.write). No arbitrary properties or existing-contact updates.",
  false,
  z.strictObject({
    email,
    firstName: headerText.optional(),
    lastName: headerText.optional(),
    company: headerText.optional(),
    phone: headerText.optional(),
  }),
  (a, request) =>
    request({
      url: hubspot(""),
      method: "POST",
      body: {
        properties: {
          email: a.email,
          firstname: a.firstName,
          lastname: a.lastName,
          company: a.company,
          phone: a.phone,
        },
      },
    }),
);

export function listRestTools(pluginId: ConnectorId): ConnectorTool[] {
  // Return copies so a caller cannot alter the approval classification or schemas.
  return (tools.get(pluginId) ?? []).map((tool) =>
    structuredClone(tool.public),
  );
}

async function readBounded(response: Response): Promise<string> {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("Response too large");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let result = "";
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Response too large");
      result += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function sanitize(
  value: unknown,
  token: string,
  depth = 0,
  budget = { remaining: 60_000 },
): unknown {
  if (depth > 10 || budget.remaining <= 0) return "[truncated]";
  budget.remaining -= 16;
  if (typeof value === "string") {
    // Also remove echoed credentials and preauthenticated URLs embedded in ordinary text.
    const result = value
      .split(token)
      .join("[redacted]")
      .split(encodeURIComponent(token))
      .join("[redacted]")
      .replace(
        /https?:\/\/[^\s"<>]*(?:access_token|refresh_token|downloadauth|tempauth|[?&]sig=)[^\s"<>]*/gi,
        "[redacted]",
      )
      .slice(0, Math.max(0, Math.min(12_000, budget.remaining)));
    budget.remaining -= result.length;
    return result;
  }
  if (Array.isArray(value))
    return value
      .slice(0, MAX_PAGE)
      .map((item) => sanitize(item, token, depth + 1, budget));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .filter(
          ([key]) =>
            !/token|secret|authorization|password|start_url|downloadurl|@odata\.(nextLink|deltaLink)|^(__proto__|constructor|prototype)$/i.test(
              key,
            ),
        )
        .map(([key, item]) => {
          const safeKey = key.split(token).join("[redacted]").slice(0, 200);
          budget.remaining -= safeKey.length;
          return [safeKey, sanitize(item, token, depth + 1, budget)];
        }),
    );
  }
  return value;
}

export async function executeRestTool(
  pluginId: ConnectorId,
  toolName: string,
  args: Record<string, unknown>,
  context: ExecutionContext,
): Promise<unknown> {
  const tool = tools
    .get(pluginId)
    ?.find((entry) => entry.public.name === toolName);
  const connector = getConnector(pluginId);
  if (!tool || connector?.transport !== "rest")
    throw new Error("Unknown REST connector tool.");
  if (
    typeof context.accessToken !== "string" ||
    !context.accessToken ||
    context.accessToken.length > 16_384 ||
    /[\r\n\x00-\x20\x7f]/.test(context.accessToken)
  )
    throw new Error("Invalid connector credentials.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new Error(
          `${pluginId} request timed out; write outcome may be unknown.`,
        ),
      );
    }, 20_000);
  });
  const request: Request = async (spec) => {
    if (
      spec.url.protocol !== "https:" ||
      spec.url.username ||
      spec.url.password ||
      spec.url.port ||
      !connector.allowedHosts?.includes(spec.url.hostname)
    )
      throw new Error("Invalid connector endpoint.");
    let status: number | undefined;
    try {
      const response = await (context.fetch ?? globalThis.fetch)(spec.url, {
        method: spec.method ?? "GET",
        redirect: "error",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: spec.text ? "text/plain" : "application/json",
          ...(spec.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...spec.headers,
          Authorization: `Bearer ${context.accessToken}`,
        },
        body:
          spec.rawBody ??
          (spec.body === undefined ? undefined : JSON.stringify(spec.body)),
      });
      status = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Provider request failed");
      }
      const raw = await readBounded(response);
      if (spec.text)
        return {
          text: sanitize(raw, context.accessToken),
          truncated: raw.length > 12_000,
        };
      if (!raw) return { accepted: true };
      const value = JSON.parse(raw) as Record<string, unknown>;
      if (
        (pluginId === "slack" && value.ok !== true) ||
        (pluginId === "linear" &&
          (value.errors ||
            (value.data as { issueCreate?: { success?: boolean } } | undefined)
              ?.issueCreate?.success === false))
      ) {
        throw new Error("Provider operation failed");
      }
      return sanitize(value, context.accessToken);
    } catch {
      // Never expose a provider error body, fetch error URL, credentials, or query arguments.
      // Do not retry: writes may have been accepted before a network/parse failure.
      throw new Error(
        `${pluginId} request failed${status === undefined ? "" : ` (HTTP ${status})`}; write outcome may be unknown.`,
      );
    }
  };
  try {
    return await Promise.race([tool.run(args, request), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}
