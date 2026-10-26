/**
 * First-party tools for providers that do not offer a usable remote MCP
 * server. Each tool calls the provider's REST API with the user's OAuth
 * token, which the runtime injects; tools never see or return the token.
 */

export type RestToolsetId =
  | "google-drive"
  | "outlook-mail"
  | "outlook-calendar"
  | "onedrive"
  | "teams"
  | "sharepoint";

export type ToolRisk = "read" | "write" | "destructive";

export type RestRequest = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  rawBody?: string;
  contentType?: string;
  accept?: "json" | "text";
  headers?: Record<string, string>;
};

/** Authenticated fetch bound to one connection. Throws `RestApiError`. */
export type RestApi = (request: RestRequest) => Promise<unknown>;

export class RestApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RestApiError";
  }
}

export type RestTool = {
  name: string;
  title: string;
  description: string;
  risk: ToolRisk;
  inputSchema: Record<string, unknown>;
  run: (api: RestApi, args: Record<string, unknown>) => Promise<unknown>;
};

// ─── helpers ────────────────────────────────────────────────────────────────

const MAX_TEXT_CHARS = 20_000;

function s(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function n(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function required(args: Record<string, unknown>, key: string): string {
  const value = s(args[key]).trim();
  if (!value) throw new RestApiError(`Missing required argument "${key}".`, 400);
  return value;
}

function clip(text: string, max = MAX_TEXT_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
}

/** Plain text from an HTML body — enough for the model to read an email. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const objectSchema = (
  properties: Record<string, unknown>,
  requiredKeys: string[] = [],
) => ({
  type: "object",
  properties,
  ...(requiredKeys.length > 0 ? { required: requiredKeys } : {}),
  additionalProperties: false,
});

const str = (description: string) => ({ type: "string", description });
const int = (description: string) => ({ type: "integer", description });
const strList = (description: string) => ({
  type: "array",
  items: { type: "string" },
  description,
});

// ─── Google Drive ───────────────────────────────────────────────────────────

const DRIVE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_FIELDS =
  "id,name,mimeType,modifiedTime,size,webViewLink,owners(displayName,emailAddress)";

const GOOGLE_EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

function driveQueryEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const googleDrive: RestTool[] = [
  {
    name: "search_files",
    title: "Search files",
    description:
      "Search Google Drive by file name or full text. Returns ids, names, types, and links.",
    risk: "read",
    inputSchema: objectSchema({
      query: str("Words to match in file names and contents."),
      mime_type: str("Optional MIME type filter, e.g. application/pdf."),
      page_size: int("Maximum results (1-50, default 20)."),
    }),
    run: async (api, args) => {
      const clauses = ["trashed = false"];
      const text = s(args.query).trim();
      if (text) {
        const escaped = driveQueryEscape(text);
        clauses.push(`(name contains '${escaped}' or fullText contains '${escaped}')`);
      }
      const mime = s(args.mime_type).trim();
      if (mime) clauses.push(`mimeType = '${driveQueryEscape(mime)}'`);
      return api({
        url: `${DRIVE}/files`,
        query: {
          q: clauses.join(" and "),
          pageSize: n(args.page_size, 20, 50),
          fields: `files(${DRIVE_FIELDS})`,
          orderBy: text ? undefined : "modifiedTime desc",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        },
      });
    },
  },
  {
    name: "get_file",
    title: "Get file details",
    description: "Get metadata for one Google Drive file.",
    risk: "read",
    inputSchema: objectSchema({ file_id: str("Drive file id.") }, ["file_id"]),
    run: (api, args) =>
      api({
        url: `${DRIVE}/files/${encodeURIComponent(required(args, "file_id"))}`,
        query: { fields: DRIVE_FIELDS, supportsAllDrives: true },
      }),
  },
  {
    name: "read_file",
    title: "Read file contents",
    description:
      "Read the text of a Google Doc, Sheet (as CSV), Slides deck, or plain-text file.",
    risk: "read",
    inputSchema: objectSchema({ file_id: str("Drive file id.") }, ["file_id"]),
    run: async (api, args) => {
      const id = encodeURIComponent(required(args, "file_id"));
      const meta = (await api({
        url: `${DRIVE}/files/${id}`,
        query: { fields: "id,name,mimeType", supportsAllDrives: true },
      })) as { name?: string; mimeType?: string };
      const mime = meta.mimeType ?? "";
      const exportMime = GOOGLE_EXPORTS[mime];
      if (exportMime) {
        const content = await api({
          url: `${DRIVE}/files/${id}/export`,
          query: { mimeType: exportMime },
          accept: "text",
        });
        return { name: meta.name, mimeType: mime, content: clip(String(content)) };
      }
      if (mime.startsWith("text/") || mime === "application/json") {
        const content = await api({
          url: `${DRIVE}/files/${id}`,
          query: { alt: "media", supportsAllDrives: true },
          accept: "text",
        });
        return { name: meta.name, mimeType: mime, content: clip(String(content)) };
      }
      return {
        name: meta.name,
        mimeType: mime,
        content: null,
        note: "This file type cannot be read as text.",
      };
    },
  },
  {
    name: "create_document",
    title: "Create document",
    description:
      "Create a new Google Doc (or a plain-text file) in the user's Drive with the given content.",
    risk: "write",
    inputSchema: objectSchema(
      {
        name: str("File name."),
        content: str("Text content of the file."),
        as_google_doc: { type: "boolean", description: "Create a Google Doc (default true)." },
        folder_id: str("Optional parent folder id."),
      },
      ["name", "content"],
    ),
    run: async (api, args) => {
      const asDoc = args.as_google_doc !== false;
      const metadata: Record<string, unknown> = {
        name: required(args, "name"),
        mimeType: asDoc ? "application/vnd.google-apps.document" : "text/plain",
      };
      const folder = s(args.folder_id).trim();
      if (folder) metadata.parents = [folder];
      const boundary = `clauxen${crypto.randomUUID().replace(/-/g, "")}`;
      const body = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify(metadata),
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        s(args.content),
        `--${boundary}--`,
        "",
      ].join("\r\n");
      return api({
        method: "POST",
        url: `${DRIVE_UPLOAD}/files`,
        query: { uploadType: "multipart", fields: DRIVE_FIELDS },
        rawBody: body,
        contentType: `multipart/related; boundary=${boundary}`,
      });
    },
  },
];

// ─── Microsoft Graph ────────────────────────────────────────────────────────

const GRAPH = "https://graph.microsoft.com/v1.0";

function recipients(addresses: string[]) {
  return addresses.map((address) => ({ emailAddress: { address } }));
}

function graphItems(payload: unknown): unknown[] {
  const value = (payload as { value?: unknown })?.value;
  return Array.isArray(value) ? value : [];
}

const outlookMail: RestTool[] = [
  {
    name: "search_messages",
    title: "Search messages",
    description:
      "Search the user's Outlook mailbox. Without a query, lists the newest messages in the folder.",
    risk: "read",
    inputSchema: objectSchema({
      query: str("Search words, e.g. a sender, subject, or phrase."),
      folder: str("Folder: inbox (default), sentitems, drafts, archive."),
      top: int("Maximum results (1-50, default 15)."),
    }),
    run: async (api, args) => {
      const folder = s(args.folder, "inbox").trim() || "inbox";
      const text = s(args.query).trim();
      const payload = await api({
        url: `${GRAPH}/me/mailFolders/${encodeURIComponent(folder)}/messages`,
        query: {
          $top: n(args.top, 15, 50),
          $select: "id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments",
          ...(text ? { $search: `"${text.replace(/"/g, "")}"` } : { $orderby: "receivedDateTime desc" }),
        },
        headers: text ? { ConsistencyLevel: "eventual" } : undefined,
      });
      return { messages: graphItems(payload) };
    },
  },
  {
    name: "get_message",
    title: "Read message",
    description: "Read one Outlook message, including its body as plain text.",
    risk: "read",
    inputSchema: objectSchema({ message_id: str("Message id.") }, ["message_id"]),
    run: async (api, args) => {
      const message = (await api({
        url: `${GRAPH}/me/messages/${encodeURIComponent(required(args, "message_id"))}`,
        query: {
          $select:
            "id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,hasAttachments,conversationId",
        },
      })) as { body?: { content?: string; contentType?: string } } & Record<string, unknown>;
      const raw = message.body?.content ?? "";
      const body = message.body?.contentType === "html" ? htmlToText(raw) : raw;
      return { ...message, body: clip(body) };
    },
  },
  {
    name: "create_draft",
    title: "Create draft",
    description: "Save a draft email in Outlook without sending it.",
    risk: "write",
    inputSchema: objectSchema(
      {
        to: strList("Recipient email addresses."),
        cc: strList("CC email addresses."),
        subject: str("Subject line."),
        body: str("Plain-text body."),
      },
      ["to", "subject", "body"],
    ),
    run: (api, args) =>
      api({
        method: "POST",
        url: `${GRAPH}/me/messages`,
        body: {
          subject: required(args, "subject"),
          body: { contentType: "text", content: s(args.body) },
          toRecipients: recipients(list(args.to)),
          ccRecipients: recipients(list(args.cc)),
        },
      }),
  },
  {
    name: "send_mail",
    title: "Send email",
    description:
      "Send an email from the user's Outlook account. Confirm recipients and content with the user first.",
    risk: "write",
    inputSchema: objectSchema(
      {
        to: strList("Recipient email addresses."),
        cc: strList("CC email addresses."),
        subject: str("Subject line."),
        body: str("Plain-text body."),
      },
      ["to", "subject", "body"],
    ),
    run: async (api, args) => {
      const to = list(args.to);
      if (to.length === 0) throw new RestApiError("At least one recipient is required.", 400);
      await api({
        method: "POST",
        url: `${GRAPH}/me/sendMail`,
        body: {
          message: {
            subject: required(args, "subject"),
            body: { contentType: "text", content: s(args.body) },
            toRecipients: recipients(to),
            ccRecipients: recipients(list(args.cc)),
          },
          saveToSentItems: true,
        },
      });
      return { sent: true, to };
    },
  },
  {
    name: "reply_to_message",
    title: "Reply to message",
    description: "Reply to an Outlook message. Confirm the reply with the user first.",
    risk: "write",
    inputSchema: objectSchema(
      { message_id: str("Message id."), comment: str("Reply text.") },
      ["message_id", "comment"],
    ),
    run: async (api, args) => {
      await api({
        method: "POST",
        url: `${GRAPH}/me/messages/${encodeURIComponent(required(args, "message_id"))}/reply`,
        body: { comment: required(args, "comment") },
      });
      return { replied: true };
    },
  },
];

const outlookCalendar: RestTool[] = [
  {
    name: "list_events",
    title: "List events",
    description: "List calendar events between two ISO 8601 date-times.",
    risk: "read",
    inputSchema: objectSchema(
      {
        start: str("Range start, ISO 8601."),
        end: str("Range end, ISO 8601."),
        top: int("Maximum events (1-100, default 50)."),
      },
      ["start", "end"],
    ),
    run: async (api, args) => {
      const payload = await api({
        url: `${GRAPH}/me/calendarView`,
        query: {
          startDateTime: required(args, "start"),
          endDateTime: required(args, "end"),
          $top: n(args.top, 50, 100),
          $orderby: "start/dateTime",
          $select: "id,subject,start,end,location,attendees,organizer,isOnlineMeeting,webLink",
        },
      });
      return { events: graphItems(payload) };
    },
  },
  {
    name: "create_event",
    title: "Create event",
    description:
      "Create a calendar event. Attendees receive invitations, so confirm with the user first.",
    risk: "write",
    inputSchema: objectSchema(
      {
        subject: str("Event title."),
        start: str("Start, ISO 8601 local date-time."),
        end: str("End, ISO 8601 local date-time."),
        time_zone: str("IANA or Windows time zone (default UTC)."),
        attendees: strList("Attendee email addresses."),
        location: str("Location."),
        body: str("Description."),
      },
      ["subject", "start", "end"],
    ),
    run: (api, args) => {
      const timeZone = s(args.time_zone, "UTC") || "UTC";
      return api({
        method: "POST",
        url: `${GRAPH}/me/events`,
        body: {
          subject: required(args, "subject"),
          start: { dateTime: required(args, "start"), timeZone },
          end: { dateTime: required(args, "end"), timeZone },
          attendees: list(args.attendees).map((address) => ({
            emailAddress: { address },
            type: "required",
          })),
          ...(s(args.location) ? { location: { displayName: s(args.location) } } : {}),
          ...(s(args.body) ? { body: { contentType: "text", content: s(args.body) } } : {}),
        },
      });
    },
  },
  {
    name: "update_event",
    title: "Update event",
    description: "Change an event's title, time, location, or description.",
    risk: "write",
    inputSchema: objectSchema(
      {
        event_id: str("Event id."),
        subject: str("New title."),
        start: str("New start, ISO 8601."),
        end: str("New end, ISO 8601."),
        time_zone: str("Time zone for start/end (default UTC)."),
        location: str("New location."),
        body: str("New description."),
      },
      ["event_id"],
    ),
    run: (api, args) => {
      const timeZone = s(args.time_zone, "UTC") || "UTC";
      const patch: Record<string, unknown> = {};
      if (s(args.subject)) patch.subject = s(args.subject);
      if (s(args.start)) patch.start = { dateTime: s(args.start), timeZone };
      if (s(args.end)) patch.end = { dateTime: s(args.end), timeZone };
      if (s(args.location)) patch.location = { displayName: s(args.location) };
      if (s(args.body)) patch.body = { contentType: "text", content: s(args.body) };
      return api({
        method: "PATCH",
        url: `${GRAPH}/me/events/${encodeURIComponent(required(args, "event_id"))}`,
        body: patch,
      });
    },
  },
  {
    name: "delete_event",
    title: "Delete event",
    description: "Delete a calendar event. Always confirm with the user first.",
    risk: "destructive",
    inputSchema: objectSchema({ event_id: str("Event id.") }, ["event_id"]),
    run: async (api, args) => {
      await api({
        method: "DELETE",
        url: `${GRAPH}/me/events/${encodeURIComponent(required(args, "event_id"))}`,
      });
      return { deleted: true };
    },
  },
];

function driveItemPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

const DRIVE_ITEM_SELECT = "id,name,size,lastModifiedDateTime,webUrl,folder,file";

async function readGraphText(api: RestApi, url: string) {
  const meta = (await api({ url, query: { $select: "id,name,size,file" } })) as {
    name?: string;
    size?: number;
    file?: { mimeType?: string };
  };
  const mime = meta.file?.mimeType ?? "";
  const textual =
    mime.startsWith("text/") ||
    mime === "application/json" ||
    /\.(md|txt|csv|json|log|ya?ml|xml|html?)$/i.test(meta.name ?? "");
  if (!textual) {
    return { name: meta.name, mimeType: mime, content: null, note: "This file type cannot be read as text." };
  }
  if ((meta.size ?? 0) > 2_000_000) {
    return { name: meta.name, mimeType: mime, content: null, note: "File is too large to read." };
  }
  const content = await api({ url: `${url}/content`, accept: "text" });
  return { name: meta.name, mimeType: mime, content: clip(String(content)) };
}

const onedrive: RestTool[] = [
  {
    name: "search_files",
    title: "Search files",
    description: "Search the user's OneDrive by name or content.",
    risk: "read",
    inputSchema: objectSchema({ query: str("Search words.") }, ["query"]),
    run: async (api, args) => {
      const q = required(args, "query").replace(/'/g, "''");
      const payload = await api({
        url: `${GRAPH}/me/drive/root/search(q='${encodeURIComponent(q)}')`,
        query: { $select: DRIVE_ITEM_SELECT, $top: 25 },
      });
      return { items: graphItems(payload) };
    },
  },
  {
    name: "list_folder",
    title: "List folder",
    description: "List the items in a OneDrive folder (root by default).",
    risk: "read",
    inputSchema: objectSchema({ path: str("Folder path such as Documents/Reports.") }),
    run: async (api, args) => {
      const path = driveItemPath(s(args.path));
      const payload = await api({
        url: path ? `${GRAPH}/me/drive/root:/${path}:/children` : `${GRAPH}/me/drive/root/children`,
        query: { $select: DRIVE_ITEM_SELECT, $top: 100 },
      });
      return { items: graphItems(payload) };
    },
  },
  {
    name: "read_file",
    title: "Read file",
    description: "Read a text-based OneDrive file by item id.",
    risk: "read",
    inputSchema: objectSchema({ item_id: str("Drive item id.") }, ["item_id"]),
    run: (api, args) =>
      readGraphText(api, `${GRAPH}/me/drive/items/${encodeURIComponent(required(args, "item_id"))}`),
  },
  {
    name: "upload_text_file",
    title: "Save text file",
    description:
      "Create or overwrite a text file in OneDrive at the given path. Confirm before overwriting.",
    risk: "write",
    inputSchema: objectSchema(
      { path: str("File path, e.g. Notes/summary.md."), content: str("File content.") },
      ["path", "content"],
    ),
    run: (api, args) =>
      api({
        method: "PUT",
        url: `${GRAPH}/me/drive/root:/${driveItemPath(required(args, "path"))}:/content`,
        rawBody: s(args.content),
        contentType: "text/plain; charset=utf-8",
      }),
  },
];

const teams: RestTool[] = [
  {
    name: "list_chats",
    title: "List chats",
    description: "List the user's recent Teams chats with their members.",
    risk: "read",
    inputSchema: objectSchema({ top: int("Maximum chats (1-50, default 20).") }),
    run: async (api, args) => {
      const payload = await api({
        url: `${GRAPH}/me/chats`,
        query: { $top: n(args.top, 20, 50), $expand: "members" },
      });
      return { chats: graphItems(payload) };
    },
  },
  {
    name: "list_chat_messages",
    title: "Read chat messages",
    description: "Read recent messages in a Teams chat.",
    risk: "read",
    inputSchema: objectSchema(
      { chat_id: str("Chat id."), top: int("Maximum messages (1-50, default 20).") },
      ["chat_id"],
    ),
    run: async (api, args) => {
      const payload = await api({
        url: `${GRAPH}/me/chats/${encodeURIComponent(required(args, "chat_id"))}/messages`,
        query: { $top: n(args.top, 20, 50) },
      });
      return {
        messages: graphItems(payload).map((raw) => {
          const message = raw as {
            id?: string;
            createdDateTime?: string;
            from?: unknown;
            body?: { content?: string; contentType?: string };
          };
          const content = message.body?.content ?? "";
          return {
            id: message.id,
            createdDateTime: message.createdDateTime,
            from: message.from,
            text: message.body?.contentType === "html" ? htmlToText(content) : content,
          };
        }),
      };
    },
  },
  {
    name: "send_chat_message",
    title: "Send chat message",
    description: "Send a message to a Teams chat. Confirm the content with the user first.",
    risk: "write",
    inputSchema: objectSchema(
      { chat_id: str("Chat id."), content: str("Message text.") },
      ["chat_id", "content"],
    ),
    run: (api, args) =>
      api({
        method: "POST",
        url: `${GRAPH}/chats/${encodeURIComponent(required(args, "chat_id"))}/messages`,
        body: { body: { contentType: "text", content: required(args, "content") } },
      }),
  },
  {
    name: "list_teams_and_channels",
    title: "List teams and channels",
    description: "List the teams the user belongs to and each team's channels.",
    risk: "read",
    inputSchema: objectSchema({}),
    run: async (api) => {
      const joined = graphItems(await api({ url: `${GRAPH}/me/joinedTeams` })) as Array<{
        id: string;
        displayName?: string;
      }>;
      const teamsWithChannels = await Promise.all(
        joined.slice(0, 20).map(async (team) => ({
          id: team.id,
          displayName: team.displayName,
          channels: graphItems(
            await api({
              url: `${GRAPH}/teams/${encodeURIComponent(team.id)}/channels`,
              query: { $select: "id,displayName,description" },
            }).catch(() => ({ value: [] })),
          ),
        })),
      );
      return { teams: teamsWithChannels };
    },
  },
  {
    name: "send_channel_message",
    title: "Post to channel",
    description: "Post a message in a Teams channel. Confirm the content with the user first.",
    risk: "write",
    inputSchema: objectSchema(
      {
        team_id: str("Team id."),
        channel_id: str("Channel id."),
        content: str("Message text."),
      },
      ["team_id", "channel_id", "content"],
    ),
    run: (api, args) =>
      api({
        method: "POST",
        url: `${GRAPH}/teams/${encodeURIComponent(required(args, "team_id"))}/channels/${encodeURIComponent(required(args, "channel_id"))}/messages`,
        body: { body: { contentType: "text", content: required(args, "content") } },
      }),
  },
];

const sharepoint: RestTool[] = [
  {
    name: "search_sites",
    title: "Search sites",
    description: "Find SharePoint sites by name.",
    risk: "read",
    inputSchema: objectSchema({ query: str("Site name words.") }, ["query"]),
    run: async (api, args) => {
      const payload = await api({
        url: `${GRAPH}/sites`,
        query: { search: required(args, "query"), $select: "id,displayName,webUrl,description" },
      });
      return { sites: graphItems(payload) };
    },
  },
  {
    name: "list_site_files",
    title: "List site files",
    description: "List files in a SharePoint site's default document library.",
    risk: "read",
    inputSchema: objectSchema(
      { site_id: str("Site id."), path: str("Optional folder path.") },
      ["site_id"],
    ),
    run: async (api, args) => {
      const site = encodeURIComponent(required(args, "site_id"));
      const path = driveItemPath(s(args.path));
      const payload = await api({
        url: path
          ? `${GRAPH}/sites/${site}/drive/root:/${path}:/children`
          : `${GRAPH}/sites/${site}/drive/root/children`,
        query: { $select: DRIVE_ITEM_SELECT, $top: 100 },
      });
      return { items: graphItems(payload) };
    },
  },
  {
    name: "read_site_file",
    title: "Read site file",
    description: "Read a text-based file from a SharePoint document library.",
    risk: "read",
    inputSchema: objectSchema(
      { site_id: str("Site id."), item_id: str("Drive item id.") },
      ["site_id", "item_id"],
    ),
    run: (api, args) =>
      readGraphText(
        api,
        `${GRAPH}/sites/${encodeURIComponent(required(args, "site_id"))}/drive/items/${encodeURIComponent(required(args, "item_id"))}`,
      ),
  },
];

const TOOLSETS: Record<RestToolsetId, RestTool[]> = {
  "google-drive": googleDrive,
  "outlook-mail": outlookMail,
  "outlook-calendar": outlookCalendar,
  onedrive,
  teams,
  sharepoint,
};

export function restToolset(id: RestToolsetId): RestTool[] {
  return TOOLSETS[id];
}

export function findRestTool(id: RestToolsetId, name: string): RestTool | null {
  return TOOLSETS[id].find((tool) => tool.name === name) ?? null;
}

/** Build the authenticated fetch a REST tool runs with. */
export function createRestApi(accessToken: string): RestApi {
  return async (request) => {
    const url = new URL(request.url);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      accept: request.accept === "text" ? "*/*" : "application/json",
      ...(request.headers ?? {}),
    };
    let body: string | undefined;
    if (request.rawBody !== undefined) {
      body = request.rawBody;
      headers["content-type"] = request.contentType ?? "text/plain";
    } else if (request.body !== undefined) {
      body = JSON.stringify(request.body);
      headers["content-type"] = "application/json";
    }

    const response = await fetch(url.toString(), {
      method: request.method ?? "GET",
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      let message = `Request failed with ${response.status}.`;
      try {
        const parsed = JSON.parse(detail) as { error?: { message?: string } | string };
        const inner = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
        if (inner) message = inner;
      } catch {
        // Non-JSON error bodies are not surfaced to the model.
      }
      throw new RestApiError(message, response.status);
    }

    if (response.status === 204) return { ok: true };
    if (request.accept === "text") return response.text();
    const text = await response.text();
    if (!text) return { ok: true };
    try {
      return JSON.parse(text);
    } catch {
      return clip(text);
    }
  };
}
