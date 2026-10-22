# TVBox 456

This branch is a minimal, standalone subscription containing only:

- MissAV
- Hanime
- Jable
- 123AV
- KanAV
- 18AV

Subscription file: `api.json`

The sources use TVBox's native Python spider interface. MissAV and Jable use the
official sites first when reachable, with a MacCMS mirror fallback (`missav.app` /
`jable.vip`) for classification, search, detail and playback. Hanime, 123AV,
KanAV and 18AV use their own spiders and direct parsing. Providers never fall
back to another site's catalog. Playback qualities are read from each video's
real media playlist.

## Requirements

* A TVBox build compiled with **Python support** (the python / Pyramid flavour).
  Java-only builds list these sites but every source fails to load, because all
  `api` values are .py spiders.
* A network path that can reach the sites. MissAV and Jable are Cloudflare
  sensitive: the spider tries the official site, then a MacCMS mirror, then a
  text-reader service. A working network node is usually enough.

## Source status (checked 2026-10-22)

| Source | Category | Search | Detail/play |
| :--- | :--- | :--- | :--- |
| Hanime | OK | OK | OK (direct media) |
| 123AV | OK when the egress is not rate-limited | OK | OK / parser fallback |
| KanAV | OK (24/page) | OK | OK (signed m3u8) |
| 18AV | OK (24/page) | OK | OK (multi-quality) |
| MissAV | OK via mirror fallback | OK via mirror fallback | OK (direct m3u8) |
| Jable | OK via mirror fallback | OK via mirror fallback | OK (direct m3u8) |

Whenever a `py/*.py` file changes, bump the `?v=` query on its `api` URL in
`api.json` so clients refetch the new copy instead of a cached one.

## Import URL

For clients in mainland China import the proxied form (no VPN needed to fetch
the config):

`https://ghfast.top/https://raw.githubusercontent.com/736368217/tvbox/456/api.json`

The direct `raw.githubusercontent.com` form only works where GitHub raw is
reachable; the spider files themselves are already requested through the same
proxy.
