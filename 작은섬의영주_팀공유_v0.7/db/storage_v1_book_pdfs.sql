-- ============================================================
-- 작은 섬의 영주 v0.7 — 📕 금융 도감 PDF 보관함 (Supabase Storage)
-- ------------------------------------------------------------
-- 왜: 카카오톡 안 브라우저는 게임이 만든 파일을 저장하지 못한다. 그래서 PDF를 여기 올리고 그 주소로 받거나 보낸다.
-- 실행: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 붙여 넣기 → Run (여러 번 실행해도 안전)
--
-- ① 버킷 book-pdfs : 공개 읽기(주소를 아는 사람만 열 수 있음 · 목록은 못 봄) · PDF만 · 한 파일 15MB까지
-- ② 게임(anon 키)은 이 버킷에 "올리기"만 가능. 덮어쓰기 · 지우기 · 목록 보기 불가
-- ③ 7일 지난 PDF 자동 삭제 — 매일 새벽 3시 17분(UTC) 예약 작업
--    ※ ③은 secret(service_role) 키가 필요하다. 아래 [③ 준비]의 한 줄을 먼저 한 번 실행할 것
-- ============================================================

-- ── ① 버킷 ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-pdfs', 'book-pdfs', true, 15728640, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ── ② 올리기만 허용 ──
drop policy if exists "game can upload book pdfs" on storage.objects;
create policy "game can upload book pdfs" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'book-pdfs');

-- ── ③ 7일 뒤 자동 삭제 ──
-- [③ 준비] 대시보드 Project Settings → API Keys 의 secret 키(sb_secret_… 또는 service_role)를 넣어 "한 번만" 실행:
--     select vault.create_secret('여기에_secret_키', 'book_pdf_cleanup_key');
--   키를 바꿨다면:  select vault.update_secret((select id from vault.secrets where name='book_pdf_cleanup_key'), '새_키');
-- (Storage 파일은 SQL로 바로 지우면 실제 파일이 남으므로, Storage API로 지운다 → pg_net 사용)
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.cleanup_book_pdfs(older_than interval default interval '7 days')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  r record;
  n int := 0;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'book_pdf_cleanup_key';
  if k is null then
    raise exception 'vault에 book_pdf_cleanup_key가 없어요. 파일 위쪽 [③ 준비]를 먼저 실행하세요';
  end if;
  for r in
    select name from storage.objects
    where bucket_id = 'book-pdfs' and created_at < now() - older_than
    order by created_at
    limit 1000
  loop
    perform net.http_delete(
      url := 'https://pposrdpdznaladikwoig.supabase.co/storage/v1/object/book-pdfs/' || r.name,
      headers := jsonb_build_object('apikey', k)
    );
    n := n + 1;
  end loop;
  return n;   -- 지우라고 보낸 파일 수 (실제 삭제는 몇 초 안에 끝남)
end;
$$;

revoke all on function public.cleanup_book_pdfs(interval) from public, anon, authenticated;

select cron.schedule('cleanup-book-pdfs', '17 3 * * *', $$select public.cleanup_book_pdfs()$$);

-- ── 확인용 ──
-- 올라온 PDF:        select name, created_at, metadata->>'size' as bytes from storage.objects where bucket_id='book-pdfs' order by created_at desc;
-- 지금 바로 지워 보기: select public.cleanup_book_pdfs(interval '0 seconds');   -- 테스트할 때만! 모두 지워짐
-- 예약 작업 보기:     select jobname, schedule, active from cron.job;
-- 예약 작업 결과:     select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
