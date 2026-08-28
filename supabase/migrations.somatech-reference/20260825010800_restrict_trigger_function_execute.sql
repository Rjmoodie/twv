-- Trigger functions are not an API surface.
--
-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated, and PostgreSQL additionally grants EXECUTE to PUBLIC. That
-- left the SECURITY DEFINER trigger functions from 20260825010700 reachable at
-- /rest/v1/rpc/<name>, which the security advisor flags as
-- {anon,authenticated}_security_definer_function_executable.
--
-- Direct calls already fail -- PostgreSQL refuses to invoke a trigger function
-- outside a trigger context -- so this closes a hardening gap rather than an
-- active hole. Revoking is safe for the triggers themselves: EXECUTE on a
-- trigger function is checked when the trigger is created, not each time it
-- fires, so the owning triggers keep working for ordinary callers.
--
-- claim_notification_outbox already revokes its own grants at creation and
-- keeps service_role execute; it is deliberately untouched here.

revoke all on function public.validate_research_publish() from public, anon, authenticated;
revoke all on function public.capture_research_revision() from public, anon, authenticated;
revoke all on function public.queue_research_publish_notifications() from public, anon, authenticated;
revoke all on function public.auto_hide_reported_research() from public, anon, authenticated;
