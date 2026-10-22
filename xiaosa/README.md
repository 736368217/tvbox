### 自动更新潇洒tvbox 接口

## 爱动漫

爱动漫已切换到站点官方 JSON API，不再解析网页，也不需要验证码或 OCR。

- 接口：https://m3u8.girigirilove.com/api.php/provide/vod/
- TVBox 类型：type 1（苹果CMS JSON）
- 支持：首页推荐、分类（日番 / 美番 / 4K杜比）、搜索、详情、m3u8 / mp4 直接播放

站点以后更换域名时，只需把 `xiaosa/api.json` 中爱动漫的 `api` 改成
`https://新域名/api.php/provide/vod/` 即可。

### 旧版说明（已废弃）

以下文件是旧版“网页解析 + 搜索验证码 OCR”方案，现已不再被 `xiaosa/api.json` 引用：

- `xiaosa/js/爱动漫.js`
- `xiaosa/js/aidongman-drpy2.min.js`
- `xiaosa/js/aidongman-drpy-core-lite.min.js`
- `xiaosa/json/aidongman-ocr.json`

旧站的 `/verify/index.html`、`/index.php/ajax/verify_check`、`/search/...` 现在都返回新版
SPA 页面；默认 OCR 接口 `api.nn.ci` 也不可用，因此旧搜索链路无法继续工作。确认不再
需要后可以删除这些文件。