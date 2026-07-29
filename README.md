# TVBox 456

This branch is a minimal, standalone subscription containing only:

- MissAV
- Hanime
- Jable
- 123AV

Subscription file: `api.json`

The source uses TVBox's native Python spider interface. MissAV switches between
its official domains when one is rate-limited. Jable pages are fetched as full
HTML through Jina Reader to avoid Jable's Android TLS challenge; catalog,
search, details, and signed playback URLs still come from Jable itself. Hanime
and 123AV use direct HTTP parsing. Providers never fall back to another site's
catalog. Playback qualities are read from each video's real media playlist,
with Jable's signed HLS exposed as 1080P.
