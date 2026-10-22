# Screen Studio 3.7.5 架构（一页纸）

## 一句话

macOS 屏幕录制 → 自动/手动生成"缩放区间" → 渲染成带背景、光标平滑、点击音效的成片。核心价值不在录制，在**后期自动化的那套时间曲线**。

## 进程拓扑

```
┌─────────────────────────────────────────────────────────┐
│ Main Process (Electron 39, 单 bundle 7.1MB)             │
│                                                          │
│  tRPC router  ←─ 150 procedures ─→  渲染进程            │
│    ├ 项目 CRUD      ├ 录音控制      ├ 导出/字幕         │
│    ├ 素材库         ├ 窗口/系统     └ 授权(远程代理)    │
│                                                          │
│  electron-store 持久化 · ffmpeg 子进程 · electron-updater│
│  @sentry/electron 遥测 · keytar 钥匙串 · node-mac-perm   │
└───────────────────┬─────────────────────────────────────┘
                    │ electron-trpc over IPC (类型安全, 非裸 ipcMain)
┌───────────────────┴─────────────────────────────────────┐
│ Renderer (Vite, 72 chunks)                              │
│  React UI · 项目状态 store · 时间轴编辑器 · 画布渲染     │
└─────────────────────────────────────────────────────────┘
                    │ HTTPS /api/trpc (Bearer JWT)
                    ▼
           https://screen.studio  授权/分享/更新/语音
```

## 五个关键设计决策

**1. IPC 用 electron-trpc，不用手写通道**
主进程能力 = 一棵 tRPC router，渲染进程直接 `trpc.project.readProject.query()`。换来类型安全 + 批量 + 订阅，代价是通道名框架内部生成、无法静态枚举。

**2. 主进程持权威项目副本，渲染进程发 patch**
`readProject → loadProject → updateProject(每次改动)`。避免多窗口编辑冲突，也让崩溃恢复有据可依。

**3. 授权 fail-open**
本地 JWT 只做 `decode + zod schema`，**不验签**；判定全靠服务端。网络异常时 `catch → assuming correct → allow`。断网可用是硬需求，代价是"阻断域名 = 永久激活"。

**4. 录音的崩溃恢复是一等公民**
`unfinishedRecordings` 磁盘清单 + `tryToRecoverRecording` 启动提示。录制中断不能丢素材——这是录屏工具的生死线。

**5. 所有重活给 ffmpeg，自己只算参数**
`fluent-ffmpeg` + 内置 ffprobe。应用自己不碰编码器，只负责算"这一帧该缩放多少、光标在哪、背景什么样"。

## 数据模型（简化）

```ts
Project {
  scenes: Scene[]              // 一个项目可有多段
  clips: Clip[]                // 剪辑片段
  zoomRanges: ZoomRange[]      // ★ 核心：缩放区间
  layouts: Layout[]            // 画面布局（摄像头/画中画）
  transcripts: Transcript[]    // 转写
  config: {
    alwaysKeepZoomedIn: boolean
    background, padding, cornerRadius, shadow  // ★ 视觉参数
  }
}

ZoomRange {
  type: 'auto' | 'manual'      // 自动识别 or 手动框选
  sourceStartTime, sourceEndTime
  isDisabled: boolean
  zoomRangesWithSystem        // 叠加系统级缩放
}
```

## 录制生命周期

```
preRecordingCheck (权限/空间/设备)
   → start → [pause | resume | addMarker] → finish
                │
                └ 崩溃 → unfinishedRecordings → tryToRecoverRecording
   → extractRawRecordingFiles (拆原始轨道)
   → 进入 Project 编辑
```

## 能力分界（决定能不能离线用）

| 本地实现（离线可用） | 远程代理（需联网） |
|---|---|
| 项目管理、录制采集、导出、转写、素材、系统信息 | 授权校验、条款、分享链接、更新检查、团队套餐 |

**这条线就是所有"hosts 破解"能生效的根本原因。**

## 源码位置速查

| 想看 | 去哪 |
|---|---|
| 全量反混淆代码 | `reconstructed/src/main/index.deobfuscated.js` |
| 授权链路 | `slices/03-licensing-activation-status.js` |
| 录屏采集 | `slices/08-recording-capture-kit.js` |
| 导出流水线 | `slices/13-export-pipeline.js` |
| 项目模型 | `slices/09-recording-model.js`、`10-project-model-zoom.js` |
| 能力全表 | `index/api-surface.md` |
