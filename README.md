# TVBox 456

This branch is a minimal, standalone subscription containing only:

- MissAV (stable catalog mirror)
- Hanime
- Jable (stable catalog mirror)
- 123AV

Subscription file: `api.json`

MissAV and Jable use the matching catalogs served by 123AV because their
original domains currently require Cloudflare browser verification. This
avoids empty pages in TVBox while keeping search, filters, details and playback.
