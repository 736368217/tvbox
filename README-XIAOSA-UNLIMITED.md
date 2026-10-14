# xiaosa-unlimited

`xiaosa` 订阅的**去认证版**分支：结构与 `master/xiaosa/` 一致，只把远程 `spider.jar`
里的「二次打包自检」去掉，让**任何** TVBox 系外壳（白壳 / 黑壳 / 影视仓 / 自改名自签包）都能直接加载。

## 订阅地址

```
https://raw.githubusercontent.com/736368217/tvbox/xiaosa-unlimited/api.json
```

（加速代理同理：`https://ghfast.top/https://raw.githubusercontent.com/736368217/tvbox/xiaosa-unlimited/api.json`）

JAR 由配置里的 `./spider.jar` 相对路径推导 → `…/xiaosa-unlimited/spider.jar`。

## 改了什么

补丁脚本 `tools/patch_jar.py`（纯 Python、无需 Java，逐字节原地改写 + 重算 DEX 头校验）：

| 目标 | 原行为 | 补丁后 |
| :--- | :--- | :--- |
| `com.github.catvod.spider.Init.a(Context)Z` | 包名白名单校验 | `return true` |
| `com.github.catvod.spider.Init.b(Context)Z` | 应用名（Label）白名单校验 | `return true` |
| `com.github.catvod.spider.Init.c(Context)Z` | 签名 DN 黑名单校验 | `return false` |
| `Init$3.run()V` | `sleep(5000)` → `Process.killProcess(自己)` | kill 调用置 nop |
| `Market.restartApp(Context)V`、`merge.m.HH$1.run()V` | 重启后自杀 | kill 调用置 nop |

去掉 `Init$3` 里的 `killProcess` 还顺带解决**白壳（上游 TVBoxOS）**的兼容问题：白壳的
`ProtectedInitJar` 判定"保护型 JAR"的条件之一是 `Init*` 类里存在 `killProcess`；补丁后不再命中，
白壳会走正常的 `Init.init(Context)` 路径（否则它会要求 JAR 里有 `DexNative`，而本 JAR 没有 →
`load error key=main, protected jar loader not bound`，主页能开、站点全打不开）。

`tools/update_config.py` 只改写 `api.json` 里 `"spider": "…;md5;<32hex>"` 的 32 位 md5，
其余字节保持与上游一致（diff 最小）。

补丁后 JAR 只保留 `classes.dex`：原 `META-INF/*.RSA|SF` 签名记录在改写后必然失效，按项目惯例丢弃
（`DexClassLoader` 不校验 JAR 签名）。

## 自动更新

`.github/workflows/xiaosa-unlimited-sync.yml`：每天 05:43 / 17:43 UTC 拉取本仓库 `master` 的
`xiaosa/` → 重新打补丁 → 校验「声明的 md5 == 实际 jar md5」→ 提交到本分支。

- **失败关闭**：JAR 结构变化导致指纹找不到时，`patch_jar.py` 退出码 2，工作流失败，分支保留上一版可用产物。
- 拉的是**本仓库 master**（而不是 `qist/tvbox`），因此 `aidongman` 等本地 overlay 会一并保留。
- 定时任务只在**默认分支**上触发；若要让 cron 生效，需要在 `master` 上也放一份该 workflow
  （只写入本分支，不影响 master 内容），或手动 `workflow_dispatch` 触发。

## 自检

```powershell
$base = "https://raw.githubusercontent.com/736368217/tvbox/xiaosa-unlimited"
$api  = (Invoke-WebRequest "$base/api.json" -UseBasicParsing).Content
$decl = ($api | ConvertFrom-Json).spider -split ";md5;" | Select-Object -Last 1
Invoke-WebRequest "$base/spider.jar" -OutFile "$env:TEMP\s.jar" -UseBasicParsing
"declared=$decl"
"actual  =" + (Get-FileHash "$env:TEMP\s.jar" -Algorithm MD5).Hash.ToLower()
# 两者一致即正常；本地复跑补丁应得到同一个 md5（脚本是确定性的）
python tools/patch_jar.py .\spider.jar .\spider.check.jar --report
```

设备侧（任何外壳）：`adb logcat` 里应看到 `load success key=main`（白壳）或不再出现
`包名不匹配|App名称不匹配|签名DN命中黑名单|protected jar loader not bound`。
