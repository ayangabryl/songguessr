# Multiplayer live interactions and connection recovery — 2026-09-08

## Changes

The connection controller now owns and cleans up handshake, retry and heartbeat timers. Transient handshake/connection failures retry with bounded exponential backoff; live sockets use ping/pong to detect silent failures. Returning online or resuming the visible page recovers the connection. Leaving invalidates unfinished host/join requests and cancels retries. A seat replaced by another tab gets an explicit message and stops automatic retries, preventing the two tabs from fighting over that seat. Server match state remains authoritative and survives reconnects.

Noot motion is a separate, ephemeral channel, outside React's roster/scoreboard updates. Drag packets are coalesced to at most about 17 per second per client; the server validates membership, numeric bounds, sequence order and grab ownership. Lift/drop remain immediate. Remote held positions interpolate locally and expire safely; disconnect releases held characters. Reconnect sends active held snapshots. Motion never writes scores or a durable position every frame. Shared social events are chosen once per 15-second server slot and driven only while visible clients are present; local independent social scheduling is disabled in live rooms. Listening/idle activity is shared too. Decorative blink micro-timing remains local, and reduced-motion users retain their preference.

Standings reuse the same compact Ruler as This sitting, including skip rings, miss marks and wins. Ready/reconnecting remain explicit status text. Viewport background hue follows the active game difficulty so the root, body and bounded room use identical colors on wide displays.

## Evidence

- 65 focused tests passed: connection retries, heartbeat recovery, malformed messages, disposed/stale callbacks, duplicate-tab replacement, offline resume, relay bounds/membership/ownership, dropped-grab recovery, channel throttling/echo handling, social direction, match scoring and sitting history.
- Real local Worker table KHZH with three protocol clients: heartbeat pong; all peers received lift/drag/drop/jump; conflicting grab rejected; no scoreboard/state broadcasts during motion; identical social packet on all peers; disconnect released a held actor; reconnect accepted a fresh sequence; duplicate socket received close code 4001.
- Browser observer in local table WHCU visibly followed a remote held Noot at y=2, then landed at y=0 after release. The browser's keyboard jump arrived on the remote protocol client. Those were our own local QA seats.
- At 1920px, dark Impossible computed backgrounds for html, body, root and room all equalled `oklch(0.17 0.012 300)`. The standings rendered the same two skip rings as the main ruler and the compact sitting-history style.
- Production build passed; scoped lint found no new protocol/scene issues. Existing hook lint warnings remain in older React code. The earlier exclusion-search improvements are included in this release.

These checks establish the exercised paths; they are not a guarantee against every future network outage. Production connection smoke checks follow deployment.
