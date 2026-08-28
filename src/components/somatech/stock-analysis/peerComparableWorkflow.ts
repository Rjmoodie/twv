export const PEER_RESULT_TTL_MS = 24 * 60 * 60 * 1000;

export function isFreshPeerResult(fetchedAt: string, now = Date.now()) {
  const age = now - Date.parse(fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < PEER_RESULT_TTL_MS;
}

export function pendingPeerTickers(
  selected: string[], loaded: Array<{ ticker: string; fetchedAt: string }>, failures: Array<{ ticker: string }>, now = Date.now(),
) {
  return selected.filter((ticker) => failures.some((failure) => failure.ticker === ticker)
    || !loaded.some((peer) => peer.ticker === ticker && isFreshPeerResult(peer.fetchedAt, now)));
}

export function shouldStopPeerBatch(message: string) {
  return /refresh limit|rate limit|too many|\b429\b/i.test(message);
}
