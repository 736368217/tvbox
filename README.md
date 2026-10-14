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


## Requirements

* A TVBox build compiled with **Python support** (the python / Pyramid flavour). Java-only builds list
  these sites but every source fails to load, because all pi values are .py spiders.
* A network path that can reach the sites. MissAV and Jable sit behind Cloudflare: on a blocked egress IP
  the fetch returns Just a moment... and that source shows an empty category list. The spiders try the
  site directly first and then fall back to a text-reader service, so a working node is usually enough.

## Source status (verified 2026-10-14)

| Source | Category | Search | Detail/play |
| :--- | :--- | :--- | :--- |
| KanAV | OK (24/page) | OK | OK (signed m3u8) |
| Hanime | OK (59/page) | OK | OK |
| 123AV | OK when the egress is not rate-limited | OK | OK |
| 18AV | OK (24/page) | OK | OK (multi-quality) |
| MissAV | Cloudflare-dependent | Cloudflare-dependent | Cloudflare-dependent |
| Jable | Cloudflare-dependent | Cloudflare-dependent | Cloudflare-dependent |

Whenever a py/*.py file changes, bump the ?v= query on its pi URL in pi.json so clients refetch
the new copy instead of a cached one.
