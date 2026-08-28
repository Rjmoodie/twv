-- Claim pending orders before calling Alpaca so concurrent approval requests
-- cannot submit the same order twice.

alter table public.execution_log
  drop constraint if exists execution_log_status_check;

alter table public.execution_log
  add constraint execution_log_status_check
  check (status in ('pending', 'submitting', 'submitted', 'filled', 'cancelled', 'rejected', 'error'));
