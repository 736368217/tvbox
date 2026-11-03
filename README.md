# tvbox

本仓库只维护 **潇洒（xiaosa）订阅** 和 **爱动漫** 入口。

- 订阅配置：xiaosa/api.json（112 个站点）
- 爱动漫：固定在 sites 列表第一位，	ype: 3 的 JS 源 ./js/爱动漫.js
- 爱动漫分类：日番、美番、剧场版、真人番剧、BD副音轨、其他
- 爱动漫筛选：类型、季度、年份、语言、版本、原作、排序
- spider.jar：**去认证版**。上游 jar 的加固壳会校验宿主包名/应用名/签名并对自身进程发 SIGKILL，
  白盒 TVBox 一加载就闪退；本分支用 	ools/patch_jar.py 把 Init.a/b/c 改成 return true/true/false，
  并把 Init\.run()、Market.restartApp()、merge.m.HH\.run() 里的 killProcess 置 nop。
  补丁只改 DEX 字节并重算头部校验，classes.dex 之外不再保留 META-INF 签名记录。
- 站点换域名只需改 xiaosa/js/爱动漫.js 顶部的 const HOST。

同步说明：.github/workflows/sync-upstream.yml 只同步上游 qist/tvbox 的 xiaosa/ 目录，
随后重新打补丁、回写 spider 的 md5、按 pi.json 引用裁剪文件，并把爱动漫放回第一位。
若打补丁失败（上游 jar 结构变化导致指纹找不到），脚本以非 0 退出且不提交，分支保留上一版可用产物。