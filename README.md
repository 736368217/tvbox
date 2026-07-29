# TVBox 456

This branch is a minimal, standalone subscription containing only:

- MissAV
- Hanime
- Jable (stable catalog mirror)
- 123AV

Subscription file: `api.json`

The source uses TVBox's native Python spider interface. MissAV switches between
its official domains when one is rate-limited. Jable uses a clearly labelled
123AV catalog mirror when Cloudflare blocks direct access. Hanime and 123AV use
direct HTTP parsing. Available playback qualities are read from each video's
real media playlist; 1080P appears only when the source actually provides it.
