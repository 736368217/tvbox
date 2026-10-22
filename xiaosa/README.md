### 潇洒 tvbox 订阅（xiaosa）

## 爱动漫

爱动漫固定放在 `xiaosa/api.json` 的 `sites` 列表第一位，使用站点官方 JSON 接口封装的 JS 源：

- 列表接口：`https://m3u8.girigirilove.com/api.php/Vod/get_list`
- 详情接口：`https://m3u8.girigirilove.com/api.php/Vod/get_detail`
- TVBox 类型：`type: 3`（JS 源，需要支持 QuickJS 的影视仓/白盒 TVBox）
- 分类：日番、美番、剧场版、真人番剧、BD副音轨、其他
- 筛选：类型、季度、年份、语言、版本、原作、排序
- 支持：首页推荐、分类、筛选、搜索、详情、m3u8 直链播放

站点以后更换域名时，只需把 `xiaosa/js/爱动漫.js` 顶部的 `HOST` 改成新域名。

## 文件保留规则

同步脚本只保留 `api.json` 实际引用的文件：

- `xiaosa/api.json`
- `xiaosa/README.md`
- `xiaosa/spider.jar`
- `xiaosa/js/爱动漫.js`
- `api.json` 中 `./json/...`、`./py/...` 等相对路径引用的文件

`api.json` 不再引用的其他文件会在同步时清理。
