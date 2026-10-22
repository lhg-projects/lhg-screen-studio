# 架构剖析 — Screen Studio 3.7.5

> 所有结论都有代码位置依据。锚点（grep 关键词）在 `index/anchors.md`，切片在 `src/main/slices/`。

---

## 1. 进程与产物结构

```
Screen Studio.app/
├── Contents/Info.plist                     ElectronAsarIntegrity: Resources/app.asar → sha256
├── Contents/MacOS/Screen Studio            Electron 39.2.7 壳
├── Contents/Resources/app.asar             245 MB
│   ├── package.json                        name/version/author（指向 Adam Pietrasiak）
│   ├── dist-electron/index.js              7.1 MB  主进程，单 bundle
│   ├── dist-electron/preload.js            573 KB  contextBridge 桥
│   ├── dist/index.html + 72 个 *.js       渲染进程（Vite 代码分割）
│   ├── node_modules/                       132 个包，44 MB（未打包，原样拷贝）
│   └── assets/                             字体、图标、音效、内置素材
```

主进程和 preload 都是 **esbuild 风格单文件 bundle + javascript-obfuscator 二次处理**；渲染进程是 **Vite/Rollup 分块 + 同样的混淆器**。

第三方依赖**没有**打进 bundle 的那部分仍在 `node_modules/` 里保持源码形态——这一点非常有利：`tools/fingerprint.cjs` 就是拿它们的字符串集合反过来给 bundle 里的块"认祖归宗"。

---

## 2. 进程间通信：electron-trpc

这是全项目最关键的设计决策。作者**没有**手写 `ipcMain.handle('xxx')` 通道，而是把主进程能力做成一棵 **tRPC router**，通过 `electron-trpc` 暴露给渲染进程。

证据链：

```js
// 主进程侧：定义 router（切片 22-ipc-bridge-router.js）
Vn()["query"]("lastUpdatedAt", { async 'resolve'() { return await rs["query"]("auth.terms.lastUpdatedAt"); } })
   ["query"]("lastAcceptedByUser", { async 'resolve'() { return await rs['query']('auth.terms.lastAcceptedByUser'); } })
   ["mutation"]("accept", { async 'resolve'() { return await rs["mutation"]("auth.terms.accept"); } })

// 渲染进程侧：直接调用（renderer/D4qqfDv_.js）
const _0x40a03a = await he["query"]("auth.hasToken") && !this["checkedAt"];
const _0x295c0b = await he["query"]("terms.lastAcceptedByUser");
```

好处：**类型安全、批量请求、订阅推送**一次拿下。代价：通道名是框架内部生成的，静态提取不到"IPC 通道"，只能提取 router 的 procedure 名——这正是 `index/api-surface.md` 那张表的来源。

> 学习要点：如果你要写类似的应用，这套"electron-trpc + 单一 router"比 100 个裸 ipcMain.handle 干净得多。

---

## 3. 状态管理与持久化

三层：

| 层 | 位置 | 机制 |
|---|---|---|
| 主进程持久化 | `~/Library/Application Support/Screen Studio/user-preferences/*.json` | `electron-store`（底层 `conf`） |
| 主进程内存 store | `Xi`（授权）、`yS`（token 持久化）、`OG`（版本）、`_3`（box） | 类 + getter/setter，手写观察者 |
| 渲染进程 store | `lt("StoreName")` 命名的 store 类 | 持久化字段用 `_a(key, default)` 声明 |

持久化字段的声明形态（可 grep `_a(`）：

```js
Ju = _a("termsAcceptedCheckboxCheckedAt", null)   // 渲染端：条款勾选时间
```

token 的文件名叫得很有意思：`auth-persistance-persistance.json`——说明构造 store 时 `name` 和 `suffix` 都传了 `'persistance'`，于是 `conf` 拼成 `name-suffix.json`。这种"小 bug 留在生产里"的细节，是逆向阅读时最有意思的部分。

---

## 4. 授权链路（整个应用最有商业设计感的部分）

### 4.1 数据

```json
// user-preferences/auth-persistance-persistance.json
{ "json": { "token": "<JWT>" } }
```

JWT payload 的 zod schema（`src/main/slices/06-licensing-token-payload-schema.js`）：

```js
{ type: 'auth',
  userId: <uuid>, email: <email>, fullName?: string, isAdmin?: boolean,
  provider: 'email' | 'license-key' | 'sso',
  appActivation?: { type:'license-key', licenseKeyId:number, instanceId:string }
                 | { type:'subscription', provider:'stripe'|'lemon', subscriptionId:number, instanceId:string }
                 | { type:'team', teamId:<uuid>, instanceId:string }
                 | { type:'legacy-license-key', licenseKeyId:number, instanceId:string },
  version?: string, iat?: number, exp?: number }
```

### 4.2 本地校验只有"结构校验"

```js
function _0x37aba8(token) {           // = vSe.decodeIfValid
  try {
    const payload = TV(token);        // 纯 base64 解码，不验签
    const r = _0x2afc22.safeParse(payload);   // zod
    return r.success ? r.data : null;
  } catch { return null; }
}
```

**没有 HMAC 校验，没有公钥验签。** 客户端的全部信任都押在"服务端会替我校验"上。这是 Electron 应用授权的常见选择（省掉密钥分发），也意味着**离线状态下它必须 fail-open 或者 fail-closed**——作者选了哪种，见 4.4。

### 4.3 三道校验闸门

| 时机 | 函数 | 行为 |
|---|---|---|
| 启动 | `$qe(async ({getIsCancelled}) => {...})` | 读 token → 结构校验 → `UJ()` 探活 → `rs.query('auth.isTokenValid')` → 失败则 **清 token + 弹 toast** |
| 窗口获得焦点 | `sfe()` | `hasToken` 为真时查 `activation.status`，`type !== 'valid'` 就 `Xi.logout()` |
| 用户输入 license key | `tEe(activation)` | 正则初筛 → 探活 → `rs.query('license.verify')` |

### 4.4 网络失败时的行为（fail-open）

```js
try {
  const r = await rs["query"]('activation.status');
  if (r["type"] === 'valid') return;
  Xi["logout"]();                      // 明确返回"无效" → 登出
} catch (e) {
  e0["warn"]("Failed to refresh activation status");   // 抛异常（网络挂） → 保留 token
}
```

`tEe` 里更直接：`catch → "Failed to verify license - assuming correct" → allow = true`。

**这是设计上的取舍**：断网用户必须能用（否则飞机上打不开软件，退款率爆炸），代价是"阻断域名解析 = 永久激活"。这解释了为什么网上流传的破解方式清一色是 `/etc/hosts` 把 `screen.studio` 指向 `127.0.0.1`。

### 4.5 服务端契约

```js
k0t = q1t({                                   // tRPC client
  fetch: (u, o) => (await lR)(u, o),          // 主进程用 undici
  transformer: sr,
  links: [I0t({ url: O0t })],                 // O0t = 'https://screen.studio/api/trpc'
  headers() { return {
    Authorization: `Bearer ${Xi.token}`,
    'x-screen-studio-app-version': ...,
    'x-screen-studio-architecture': ...,
    'x-screen-studio-platform': ...,
    'x-screen-studio-updates-channel': ...,
    'x-screen-studio-license-key': ...,
    'x-screen-studio-machine-id': ...,
  }; }
});
```

用到 15 个 procedure：`auth.isTokenValid`、`activation.status`、`license.verify`、`healthz`、`auth.terms.{lastUpdatedAt,lastAcceptedByUser,accept,reset}`、`auth.authorize.app.{tryToUpgradeToken,requestTokenAfterRecentOrder}`、`teams.getBlockedFeatures`、`updates.checkForUpdates`、`share.*`、`speech.*`、`qa.addExportOutputs`、`dev.*`。

---

## 5. 录音流程

```
preRecordingCheck  →  start  →  [录制中: pause / resume / addMarker]  →  finish
                        │
                        └─ 崩溃/断电 → unfinishedRecordings（磁盘清单）
                                        └─ tryToRecoverRecording（下次启动提示恢复）
```

- **采集**：macOS 13+ 走 **ScreenCaptureKit**（`ScreenCaptureKitStreamPickerSonoma` 特性开关在进程启动参数里可见），旧系统回退 `desktopCapturer`；`isScreenCaptureKitSupported` 暴露给 UI 做能力探测。
- **权限**：`node-mac-permissions` 检查屏幕录制 / 辅助功能，对应那个"Welcome to Screen Studio! Before you can start recording..."引导窗。
- **目标窗口枚举**：`capturableWindows` / `capturableWindowById`，UI 里是选窗口录制。
- **录完**：`extractRawRecordingFiles` 把临时包拆成原始视频轨，进入项目。
- **细节彩蛋**：依赖里有 `hide-desktop-icons` 和 `wallpaper`——录屏期间可以临时隐藏桌面图标、设置纯色壁纸，避免录进乱七八糟的桌面。`file-icon` 用来给项目列表取文件图标。

---

## 6. 项目模型与导出

项目（Project）是 JSON + 资源目录：

```
project/
├── project.json        { scenes[], clips[], zoomRanges[], layouts[], transcripts[], ... }
├── recordings/         原始 .mp4 / 音频
├── thumbnails/
└── .screenstudio/      缓存（波形、缩略图、渲染中间产物）
```

- **读取链**：`lastRequestedFileToOpen` → `readProject` → `loadProject`，版本过旧会抛 `"This project was created with too old version of..."`。
- **编辑**：`updateProject`（主进程持权威副本，渲染进程发 patch）。
- **最近项目**：`markAsRecent`、`projectsPathsFromFolder`。
- **导出**：渲染进程算帧 → 主进程 `ffmpeg`（`fluent-ffmpeg` + `ffprobe`，`setFfmpegPath` 指向内置二进制）→ `PassThrough` 落盘。导出后 `getTempClipboardExportsPath` 支持"复制到剪贴板"。
- **转写/字幕**：`getTranscript` / `updateTranscript` / `exportTranscriptAsSRT` / `generateAll` / `generateMissing`，配合 `speech.voices`、`supportedLocales`。`mp4-wasm` 说明部分封装在 WASM 里做。
- **分享**：`share.prepareShareableLink` → 上传 → `share.finalizeShareableLink`，中间态用 `share.newShareableLinkId`。

---

## 7. 更新与遥测

- `electron-updater`，feed `https://screen.studio/api/app-update/v2`，带 `channel` 头；`electron-dl` 负责下载进度 UI。
- 版本策略函数 `i3t()`：`gte(current, newestInstalled) ? 'forced' : 'manual'` —— 有"强制更新"概念（`devForceUpdates` 可强制为 `1.0.0` 便于测试）。
- `@sentry/electron 4.9.0` + `@sentry/integrations 7.61.1`，`annonymousId` 作为匿名标识，启动即 `Sentry.init`，主进程日志通过 `AppBridge:` 前缀同步到渲染端。

---

## 8. 从这份还原里能学到什么

1. **electron-trpc 把 IPC 做成类型安全 API** —— 值得抄的架构决策。
2. **授权的 fail-open 取舍** —— 离线可用 vs 可被 hosts 绕过，是一个真实的商业权衡样本。
3. **macOS 屏幕采集的正确姿势** —— ScreenCaptureKit 能力探测 + 旧系统回退 + 权限引导。
4. **Vite 代码分割在 Electron 里怎么用** —— 72 个 chunk 的分法本身就是教材。
5. **混淆不是保护** —— 字符串数组混淆在 VM 执行 + 结构扫描面前基本透明。真正的护城河只能是服务端。

---

## 附：这份文档的边界

文中所有行为描述均来自**静态阅读反混淆产物**，未做动态调试验证（除启动流程外）。标注"推断"的地方请以代码为准：

```bash
grep -n "锚点" src/main/index.deobfuscated.js | head
```
