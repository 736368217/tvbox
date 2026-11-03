### 潇洒 tvbox 订阅（xiaosa）

## 爱动漫

爱动漫固定放在 xiaosa/api.json 的 sites 列表第一位，使用站点官方 JSON 接口封装的 JS 源：

- 列表接口：`https://m3u8.girigirilove.com/api.php/Vod/get_list`
- 详情接口：`https://m3u8.girigirilove.com/api.php/Vod/get_detail`
- TVBox 类型：`type: 3`（JS 源，需要支持 QuickJS 的影视仓/白盒 TVBox）
- 分类：日番、美番、剧场版、真人番剧、BD副音轨、其他
- 筛选：类型、季度、年份、语言、版本、原作、排序

站点换域名时，只需把 `xiaosa/js/爱动漫.js` 顶部的 `HOST` 改成新域名。

## spider.jar（去认证版）

`xiaosa/spider.jar` 是上游 jar 的**去认证补丁版**，md5 与 `api.json` 的 `"spider"` 声明保持一致。

上游 jar 的加固壳会做三件事：

1. `Init.a(Context)` 校验宿主包名；
2. `Init.b(Context)` 校验应用名；
3. `Init.c(Context)` 校验签名 DN；
4. 任一不匹配 → `Init\.run()` 里 `Process.killProcess(自己)`，表现为 TVBox 启动十几秒后自杀退出。

补丁（`tools/patch_jar.py`，纯 Python，逐字节改写 DEX 并重算 Adler-32/SHA-1）：

| 目标 | 补丁后 |
| :--- | :--- |
| `Init.a` | `return true` |
| `Init.b` | `return true` |
| `Init.c` | `return false` |
| `Init\.run` | `killProcess` 置 nop |
| `Market.restartApp` / `merge.m.HH\.run` | `killProcess` 置 nop |

去掉 `Init\` 里的 `killProcess` 同时解决了白壳判定“保护型 JAR”的问题（该启发式要求 `Init*` 里存在 `killProcess`）。

## 文件保留规则

同步脚本只保留 `api.json` 实际引用的文件：

- `xiaosa/api.json`
- `xiaosa/README.md`
- `xiaosa/spider.jar`
- `xiaosa/js/爱动漫.js`
- `api.json` 中 `./json/...`、`./py/...` 等相对路径引用的文件