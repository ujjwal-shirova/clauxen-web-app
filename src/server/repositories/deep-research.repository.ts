import { query, queryOne } from "@/server/db/pool";
import {
  researchFailureMessage,
  researchSourceUrls,
  type ResearchState,
} from "@/lib/research-state";
export type ResearchRow = ResearchState & {
  user_id: string;
  execution_origin: string;
  model: string | null;
  job_id: string | null;
  source_urls: string[];
};
const columns = `p.*, cardinality(p.source_urls) as source_count, j.assistant_message_id`;
export async function getResearch(
  chatId: string,
  toolId: string,
  userId: string,
) {
  return queryOne<ResearchRow>(
    `select ${columns} from public.deep_research_plans p left join public.chat_generation_jobs j on j.id=p.job_id where p.chat_id=$1 and p.tool_call_id=$2 and p.user_id=$3`,
    [chatId, toolId, userId],
  );
}
export async function getResearchById(id: string) {
  return queryOne<ResearchRow>(
    `select ${columns} from public.deep_research_plans p left join public.chat_generation_jobs j on j.id=p.job_id where p.id=$1`,
    [id],
  );
}
export async function createResearch(input: {
  chatId: string;
  userId: string;
  toolId: string;
  title: string;
  tasks: string[];
  origin: string;
  model?: string;
}) {
  const row = await queryOne<{ id: string }>(
    `insert into public.deep_research_plans(chat_id,user_id,tool_call_id,title,tasks,task_statuses,auto_start_at,execution_origin,model)
    select c.id,c.user_id,$3,$4,$5::jsonb,$6::jsonb,now()+interval '60 seconds',$7,$8 from public.chats c where c.id=$1 and c.user_id=$2
    on conflict(chat_id,tool_call_id) do update set tool_call_id=excluded.tool_call_id returning id`,
    [
      input.chatId,
      input.userId,
      input.toolId,
      input.title,
      JSON.stringify(input.tasks),
      JSON.stringify(input.tasks.map(() => "pending")),
      input.origin,
      input.model ?? null,
    ],
  );
  return row ? getResearchById(row.id) : null;
}
export async function dueResearch() {
  return query<{ id: string }>(
    `select id from public.deep_research_plans where (status='pending' and auto_start_at<=now()) or (status='starting' and updated_at<now()-interval '30 seconds') order by created_at limit 20`,
  );
}
export async function addResearchSources(id: string, urls: string[]) {
  await query(
    `update public.deep_research_plans set source_urls=array(select distinct u from unnest(source_urls||$2::text[]) u where u is not null limit 6400), search_count=search_count+1,updated_at=now() where id=$1 and status in ('running','paused')`,
    [id, researchSourceUrls(urls)],
  );
}
export async function updateResearchTask(
  id: string,
  index: number,
  status: string,
) {
  return queryOne(
    `update public.deep_research_plans set task_statuses=jsonb_set(task_statuses,array[$2::text],to_jsonb($3::text)),updated_at=now() where id=$1 and status='running' and $2::integer>=0 and $2::integer<jsonb_array_length(tasks) returning title`,
    [id, index, status],
  );
}
export function publicResearch(row: ResearchRow): ResearchState {
  return {
    id: row.id,
    chat_id: row.chat_id,
    tool_call_id: row.tool_call_id,
    title: row.title,
    tasks: row.tasks,
    task_statuses: row.task_statuses,
    status: row.status,
    auto_start_at: row.auto_start_at,
    source_count: row.source_count,
    search_count: row.search_count,
    assistant_message_id: row.assistant_message_id,
    error: row.error ? researchFailureMessage(row.error) : null,
  };
}
