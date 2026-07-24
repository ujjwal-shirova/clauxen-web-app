import { query, queryOne } from "@/server/db/pool";
import {
  TRANSCRIPT_SCHEMA_VERSION,
  type TranscriptRecord,
} from "@/server/training/transcript-format";

export type TranscriptLineRow = {
  id: string;
  chat_id: string;
  user_id: string;
  message_id: string | null;
  seq: number;
  role: string;
  record: TranscriptRecord;
  schema_version: string;
  training_eligible: boolean;
  created_at: string;
};

export async function appendTranscriptLine(input: {
  chatId: string;
  userId: string;
  messageId?: string | null;
  role: string;
  record: TranscriptRecord;
  trainingEligible?: boolean;
}) {
  return queryOne<TranscriptLineRow>(
    `select *
     from public.append_chat_transcript_line(
       $1, $2, $3, $4, $5::jsonb, $6, $7
     )`,
    [
      input.chatId,
      input.userId,
      input.messageId ?? null,
      input.role,
      JSON.stringify(input.record),
      TRANSCRIPT_SCHEMA_VERSION,
      input.trainingEligible ?? true,
    ],
  );
}

export async function replaceTranscriptLines(input: {
  chatId: string;
  userId: string;
  lines: Array<{
    role: string;
    record: TranscriptRecord;
    messageId?: string | null;
    trainingEligible?: boolean;
  }>;
}) {
  const payload = input.lines.map((line) => ({
    role: line.role,
    record: line.record,
    message_id: line.messageId ?? null,
    schema_version: TRANSCRIPT_SCHEMA_VERSION,
    training_eligible: line.trainingEligible ?? true,
  }));

  return queryOne<{ replace_chat_transcript_lines: number }>(
    `select public.replace_chat_transcript_lines($1, $2, $3::jsonb) as replace_chat_transcript_lines`,
    [input.chatId, input.userId, JSON.stringify(payload)],
  );
}

export async function listTranscriptLines(chatId: string, userId: string) {
  return query<TranscriptLineRow>(
    `select id::text, chat_id, user_id, message_id::text, seq, role, record,
            schema_version, training_eligible, created_at
     from public.chat_transcript_lines
     where chat_id = $1 and user_id = $2
     order by seq asc`,
    [chatId, userId],
  );
}

export async function getChatTranscriptJsonl(chatId: string, userId: string) {
  return queryOne<{
    chat_id: string;
    user_id: string;
    chat_title: string;
    line_count: number;
    training_eligible: boolean;
    jsonl: string;
  }>(
    `select chat_id, user_id, chat_title, line_count, training_eligible, jsonl
     from public.chat_transcripts_jsonl
     where chat_id = $1 and user_id = $2`,
    [chatId, userId],
  );
}
