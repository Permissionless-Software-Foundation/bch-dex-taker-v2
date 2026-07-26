# Reliable Nostr DMs (Frontend)

## Problem

On the nostr-chat page, the DM sidebar could list conversations (kind-4 history existed on relays), but opening a conversation often showed **no messages**. Sending a DM also often failed to appear in the UI until a full refresh — and sometimes not even then.

Logs from the REST2NOSTR proxy showed:

- `GET /req/dms-…` returning multiple kind-4 events (inbox listing worked)
- `POST /req/dm-{64-char-pubkey}-…` SSE subscriptions finishing immediately after relay `NOTICE` / close (conversation load failed)

The channel-info URL (`kinds:[41]`) is **not** the DM fetch path; it only loads NIP-28 group channel metadata.

## Root cause

[NIP-01](https://nips.nostr.com/1) requires subscription IDs to be at most **64 characters**.

The chat page built SSE subscription IDs like:

```text
dm-{64-char-peer-pubkey}-{timestamp}-{random}
```

That alone is already ~90 characters. The same pattern was used for group chat (`group-{channelId}-…`). Relays reject overlong `REQ` subscription IDs, so the SSE stream ended with no events.

Other Nostr pages (`profile`, `user-feeds`, `global-feeds`, likes, follow list) already used short prefixes and were unaffected.

Additionally:

- Conversation history depended entirely on SSE `onEvent` (no GET bootstrap).
- `selectedChannelIsDm` was inferred from `profiles[ch]`, so opening a DM before the profile finished loading could skip the DM subscription path.
- Outbound messages were not shown until an SSE echo arrived.

## Changes

### Short opaque subscription IDs

[`src/services/nostr-rest-client.js`](../src/services/nostr-rest-client.js) — `generateSubId(prefix)`:

- Accepts a short semantic prefix (`dm`, `group`, `dm-notify`, `profile`, …).
- Produces `{prefix}-{timestampBase36}-{random}` capped under a client-safe length.
- Strips accidental embedded 64-char hex (pubkey / event id) if a caller still embeds one.

Chat call sites now use `generateSubId('dm')` and `generateSubId('group')` instead of embedding hex IDs.

### GET history + live-only SSE

[`src/services/nostr-queries.js`](../src/services/nostr-queries.js):

- `getDmMessages(myPub, peerPub)` — kind-4 conversation history via GET `/req`
- `getChannelMessages(channelId)` — kind-42 group history via GET `/req`

[`src/components/app-body/nostr-chat/index.js`](../src/components/app-body/nostr-chat/index.js):

1. On channel select, load history with those helpers.
2. Decrypt / render, then set `loadedMessages`.
3. Open SSE with `limit: 0` (and `since` when history exists) for live updates only.

### Chat reliability polish

- DM vs group detection uses known DM / group channel membership (not only loaded profiles).
- After a successful publish, the outbound message is shown immediately via `onMsgRead` (optimistic UI).
- Subscription cleanup uses a single `subscription.close()` path (avoids double DELETE / abort noise).

## Side effects

| Area | Impact |
|---|---|
| Feeds / profile / likes / follow | Unchanged (already short sub-ids; still GET queries) |
| Publish (`/event`) | Unchanged |
| Group chat | Same reliability/efficiency pattern as DMs |
| REST contract | Unchanged paths and response shapes |

## Related

- REST2NOSTR companion doc: `nostr/REST2NOSTR/dev-docs/reliable-subscription-ids.md`
