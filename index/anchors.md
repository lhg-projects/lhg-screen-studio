# 锚点表 — 想找什么，grep 什么

在 `src/main/index.deobfuscated.js` 里搜索这些字符串，能直接落到对应功能代码。

| 功能 | 锚点字符串 | 位置提示 |
|---|---|---|
| token 持久化 | `auth-persistance` | 授权 |
| token 结构校验 | `decodeIfValid` / `Incorrect auth token` | 授权 |
| token payload schema | `legacy-license-key` / `appActivation` | 授权 |
| 启动校验 | `auth.isTokenValid` | 授权 |
| 激活状态 | `activation.status` / `Invalid activation status` | 授权 |
| license 校验 | `license.verify` / `Failed to verify license` | 授权 |
| 服务端探活 | `healthz` / `Blocked licensing server access` | 授权 |
| tRPC 客户端 | `x-screen-studio-app-version` | 网络 |
| 条款 | `auth.terms.lastAcceptedByUser` | 授权 |
| 设备指纹 | `x-screen-studio-machine-id` | 授权 |
| 未完成录音 | `unfinishedRecordings` | 录音 |
| 屏幕采集能力 | `ScreenCaptureKit` | 录音 |
| 可录窗口 | `capturableWindows` | 录音 |
| 录音生命周期 | `preRecordingCheck` / `tryToRecoverRecording` | 录音 |
| 时间轴缩放 | `zoomRanges` | 项目模型 |
| 剪辑片段 | `slicePlaybackLinks` / `startSourceTimeMs` | 项目模型 |
| 场景 | `timeScale` / `volume` / `scene` | 项目模型 |
| 项目读取 | `readProject` / `too old version` | 项目 IO |
| 项目保存 | `updateProject` | 项目 IO |
| 最近项目 | `markAsRecent` | 项目 IO |
| ffmpeg | `setFfmpegPath` / `setFfprobePath` | 导出 |
| 导出 | `exportTranscriptAsSRT` / `generateMissing` | 导出 |
| 分享 | `share.prepareShareableLink` | 网络 |
| 更新 | `autoUpdater` / `app-update/v2` | 更新 |
| 强制更新策略 | `forced` / `devForceUpdates` | 更新 |
| 窗口管理 | `browser-window-created` / `ready-to-show` | 窗口 |
| 菜单 | `setApplicationMenu` | 菜单 |
| 托盘 | `Tray` | 菜单 |
| 权限 | `node-mac-permissions` | 系统 |
| 桌面图标隐藏 | `hide-desktop-icons` / `wallpaper` | 录音 |
| 遥测 | `Sentry.init` / `annonymousId` | 遥测 |
| 渲染桥 | `AppBridge` | IPC |
| 日志 | `blockThread` / `diagnosticData` | 诊断 |

## 渲染进程常用锚点

在 `src/renderer/*.js` 里搜：

| 功能 | 锚点 |
|---|---|
| 条款状态机 | `TermsStore` |
| 授权 store | `Auth store` |
| 应用启动 | `App boot` / `The app bootstrap finished` |
| tRPC 链路 | `TRPC Link` |
| 更新状态 | `Electron Updater` |
| 未完成录音 | `UnfinishedRecordingsStore` |
| 架构探测 | `Detected hardware architecture by sysctl` |
| 服务端地址 | `Frontend & API URL` |
