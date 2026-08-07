-- The canonical embeddings_chunk_unique_idx already guarantees one vector per
-- chunk. Remove the duplicate introduced by project-chat reliability rollout.
drop index if exists public.embeddings_chunk_id_unique_idx;
