# tvbox

本仓库只维护 **潇洒（xiaosa）订阅** 和 **爱动漫** 入口。

- 订阅配置：`xiaosa/api.json`
- 爱动漫：固定在 `sites` 列表第一位，使用 `type: 3` 的 JS 源
  `./js/爱动漫.js`
- 爱动漫分类：日番、美番、剧场版、真人番剧、BD副音轨、其他
- 爱动漫筛选：类型、季度、年份、语言、版本、原作、排序
- `spider.jar` 以及 `api.json` 中 `./json/...`、`./py/...`、`./js/...` 引用的文件会保留
- 其他与 xiaosa 订阅无关的配置、直播源、jar、脚本等均已清理

同步说明：`.github/workflows/sync-upstream.yml` 只同步上游 `qist/tvbox` 的 `xiaosa/` 目录，然后按 `api.json` 引用裁剪文件，并把爱动漫放回第一位；不会再引入根目录的其他文件。
