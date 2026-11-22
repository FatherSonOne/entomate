-- Removes the demo seed from qntmecos_demo_seed.sql (org a993efd7-4360-4d38-aeb1-f2202632706c).
-- Only rows whose id starts with 5eed2026-, plus embeddings and search rows built from them.
-- Destructive: run only when you want the demo data gone.
begin;
delete from public.embeddings
 where source_id::text like '5eed2026-%';
delete from public.search_notes        where id::text like '5eed2026-%' and org_id = 'a993efd7-4360-4d38-aeb1-f2202632706c';
delete from public.meeting_notes       where id::text like '5eed2026-%' and org_id = 'a993efd7-4360-4d38-aeb1-f2202632706c';
delete from public.workflow_executions where id::text like '5eed2026-%';
delete from public.workflows           where id::text like '5eed2026-%' and org_id = 'a993efd7-4360-4d38-aeb1-f2202632706c';
delete from public.tasks               where id::text like '5eed2026-%' and org_id = 'a993efd7-4360-4d38-aeb1-f2202632706c';
delete from public.action_items        where id::text like '5eed2026-%' and org_id = 'a993efd7-4360-4d38-aeb1-f2202632706c';
delete from public.meetings            where id::text like '5eed2026-%' and org_id = 'a993efd7-4360-4d38-aeb1-f2202632706c';
delete from public.projects            where id::text like '5eed2026-%' and org_id = 'a993efd7-4360-4d38-aeb1-f2202632706c';
commit;
