-- Fix: anonymous-visibility posts must appear in the community feed.
-- The original policy only allowed visibility='community', meaning anonymous
-- posts were invisible to everyone except the author.

drop policy if exists "Users can read community posts" on journey_posts;

create policy "Users can read community posts"
  on journey_posts for select
  using (
    (visibility = 'community' or visibility = 'anonymous')
    and status = 'published'
    and auth.uid() is not null
  );
