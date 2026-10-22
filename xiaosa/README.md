### 潇洒 tvbox 订阅（xiaosa）

## 爱动漫

爱动漫固定放在 `xiaosa/api.json` 的 `sites` 列表第一位，使用站点官方 JSON API：

- 接口：`https://m3u8.girigirilove.com/api.php/provide/vod/`
- TVBox 类型：`type: 1`（苹果CMS JSON）
- 支持：首页推荐、分类（日番 / 美番 / 4K杜比）、搜索、详情、m3u8 / mp4 直接播放

站点以后更换域名时，只需把 `xiaosa/api.json` 中爱动漫的 `api` 改成
`https://新域名/api.php/provide/vod/`，并同步修改
`.github/scripts/ensure-aidongman.mjs` 里的地址即可。

## 旧版说明（已废弃）

旧版“网页解析 + 搜索验证码 OCR”方案已移除。旧站的
`/verify/index.html`、`/index.php/ajax/verify_check`、`/search/...`
现在都返回新版 SPA 页面，`api.nn.ci` OCR 也不可用，旧链路无法继续工作。

## 文件保留规则

同步脚本只保留 `api.json` 实际引用的文件：

- `xiaosa/api.json`
- `xiaosa/README.md`
- `xiaosa/spider.jar`
- `api.json` 中 `./json/...`、`./py/...` 等相对路径引用的文件

`api.json` 不再引用的 `js/`、`XBPQ/`、`XYQHiker/`、`ITV.txt` 等文件会在同步时清理。
