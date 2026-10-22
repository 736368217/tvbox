# tvbox

本仓库只维护 **潇洒（xiaosa）订阅** 和 **爱动漫** 入口。

- 订阅配置：`xiaosa/api.json`
- 爱动漫：固定在 `sites` 列表第一位，使用官方 JSON API
  `https://m3u8.girigirilove.com/api.php/provide/vod/`
- `spider.jar` 以及 `api.json` 中 `./json/...`、`./py/...` 引用的文件会保留
- 其他与 xiaosa 订阅无关的配置、直播源、jar、脚本等均已清理

同步说明：`.github/workflows/sync-upstream.yml` 只同步上游 `qist/tvbox` 的 `xiaosa/` 目录，然后按 `api.json` 引用裁剪文件，并把爱动漫放回第一位；不会再引入根目录的其他文件。
