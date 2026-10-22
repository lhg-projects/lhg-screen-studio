# 能力 → 实现 → 关键点

14 项核心能力。每项给出：目标、实现要点、学它的价值、去哪看源码。

---

## 1. 屏幕采集

**目标**：把屏幕/窗口录成视频流，macOS 13+ 用 ScreenCaptureKit。

**实现要点**
- 能力探测：`isScreenCaptureKitSupported` → UI 决定走新 API 还是 `desktopCapturer` 回退
- 内置 Electron 特性开关（从进程参数可见）：`ScreenCaptureKitPickerScreen`、`ScreenCaptureKitStreamPickerSonoma`
- 权限：`node-mac-permissions` 查"屏幕录制"和"辅助功能"，缺权限就弹引导窗（对应那句 "Welcome to Screen Studio!..."）
- 采集参数：帧率、目标窗口 ID、是否录系统音频

**学它值不值**：★★★★★ 这是整个产品的地基，也是最容易踩权限坑的地方。

**源码**：`slices/08-recording-capture-kit.js`、`slices/18-permissions.js`

---

## 2. 可录对象枚举

**目标**：列出所有窗口 + 显示器，供用户选。

**实现要点**
- `capturableWindows` / `capturableWindowById`：主进程枚举，带缩略图
- 显示器变化监听：`display-added`、`display-removed`、`display-metrics-changed`（拔外接屏不能崩）
- 窗口列表要实时刷新（用户可能中途切窗口）

**学它值不值**：★★★★☆ 细节多，容易漏。

**源码**：`slices/16-window-management.js`

---

## 3. 录制状态机 + 崩溃恢复

**目标**：录制中断不丢素材。

**实现要点**
- 状态机：`preRecordingCheck → start → (pause|resume|addMarker)* → finish | cancel`
- 每次状态变化把"当前录制包"登记进 `unfinishedRecordings`（磁盘 JSON）
- 启动时若清单非空 → 提示"发现未完成录音，是否恢复" → `tryToRecoverRecording`
- 录制中打标记（`addMarker`）用于后续剪辑定位

**学它值不值**：★★★★★ 别人都是"崩了就没了"，这条是产品的信任基础。

**源码**：`slices/07-recording-unfinished-store.js`

---

## 4. 项目模型与持久化

**目标**：可增量保存、可版本兼容。

**实现要点**
- 项目 = 目录 + `project.json` + 素材 + 缓存
- 读取链：`lastRequestedFileToOpen`（Finder 双击/命令行）→ `readProject` → `loadProject`
- 版本检查：项目文件版本过旧 → 明确报错 `"This project was created with too old version of..."`，不静默损坏
- 写：`updateProject` 全量 patch，主进程持权威副本
- 最近项目：`markAsRecent` + `projectsPathsFromFolder`

**学它值不值**：★★★★☆ 决定你的软件能不能被信任来存创作成果。

**源码**：`slices/11-project-read.js`、`slices/12-project-recent.js`

---

## 5. ★ 缩放区间（产品灵魂）

**目标**：自动判断"用户此刻在关注屏幕的哪一块"，平滑放大地呈现。

**实现要点**
- 数据结构：`ZoomRange { type: 'auto'|'manual', sourceStartTime, sourceEndTime, isDisabled }`
- 自动识别：靠光标位置 + 停留时长 + 点击事件推断注意力焦点
- 手动：用户框选区域（"You can manually pick part of the video that will be zoomed in"）
- 叠加逻辑：`zoomRangesWithSystem`、`alwaysKeepZoomedIn` 决定系统级缩放和用户缩放如何合成
- 时间轴映射：源时间 ↔ 播放时间（有剪辑时二者不同），`recordingTimeToSessionMediaTime` 做换算
- 缓动：进入/退出缩放的曲线与时长（这是"看起来高级"和"看起来很廉价"的分界线）

**学它值不值**：★★★★★ **这是 Screen Studio 值钱的全部。** 其余都是工程量。

**源码**：`slices/10-project-model-zoom.js`、`slices/09-recording-model.js`

**注意**：具体数值参数（缩放倍率范围、缓动曲线控制点、触发阈值）需要定向考古，见 `03-PROMPT-CARDS.md` 卡 5。

---

## 6. 光标处理

**目标**：光标不抖、不飘、点击有反馈。

**实现要点**
- 光标轨迹平滑（原始鼠标事件是抖的，要滤波）
- 运动模糊 / 拖影（`motionBlur` 相关配置，45 处引用）
- 点击高亮：点击时画圈/波纹
- 点击音效：`clickSound` 与点击时刻对齐（17 处引用）
- 光标尺寸可调（`cursorSize`）

**学它值不值**：★★★★☆ 观感提升巨大，实现不难但调参费时间。

**源码**：`slices/09-recording-model.js`

---

## 7. 视觉合成

**目标**：录屏画面套上背景、圆角、阴影、内边距，变成"作品"而不是"截图"。

**实现要点**
- 参数：`background`（纯色/渐变/图片）、`padding`、`cornerRadius`、`shadow`
- 背景素材库：`backgrounds` / `backgroundPath`
- 阴影要多层叠加才自然（单层阴影一定假）
- 输出分辨率与内边距要做比例换算，不能硬编码像素

**学它值不值**：★★★★☆ 审美 + 参数，没有算法难点。

**源码**：`slices/09-recording-model.js`、`slices/10-project-model-zoom.js`

---

## 8. 摄像头画中画

**目标**：摄像头画面自动定位，不挡内容。

**实现要点**
- `faceBounds`：检测人脸位置，把画中画放到不遮脸、不遮焦点的角落
- `layouts`：预设布局（角落/并排/隐藏）
- 与缩放区间联动：放大某区域时画中画要让位

**学它值不值**：★★★☆☆ 差异化功能，做好很加分。

---

## 9. 音频波形

**目标**：时间轴上显示波形，便于对齐剪辑。

**实现要点**
- `waveform` / `durationMsOfAudioFile`：主进程算峰值，渲染端画
- 长音频要降采样 + 分块加载

**学它值不值**：★★★☆☆ 标准工程量。

---

## 10. 导出

**目标**：稳定输出高质量 MP4。

**实现要点**
- `fluent-ffmpeg` + 内置 ffprobe，`setFfmpegPath` 指向随包二进制
- 渲染端算帧 → `PassThrough` 流 → ffmpeg 编码
- 编码参数（`bitrate`、`frameRate`）按目标分辨率/平台调
- 导出完成支持"复制到剪贴板"（`getTempClipboardExportsPath`）
- 进度上报：`setProgressBar`（Dock 进度条）

**学它值不值**：★★★★☆ 坑多（色彩空间、可变帧率、音频同步）。

**源码**：`slices/13-export-pipeline.js`、`slices/14-ffmpeg-bridge.js`

---

## 11. 转写 / 字幕

**目标**：自动生成字幕，可编辑、可导出 SRT。

**实现要点**
- `getTranscript` / `updateTranscript` / `exportTranscriptAsSRT`
- 批量 `generateAll` vs 增量 `generateMissing`
- 多语言：`supportedLocales`、`speech.voices`

**学它值不值**：★★★☆☆ 现在接个 Whisper 就能做。

**源码**：`slices/20-captions.js`

---

## 12. 分享

**目标**：一键生成链接。

**实现要点**
- 三步：`newShareableLinkId` → `prepareShareableLink` → `finalizeShareableLink`
- 中间态要能续传/重试

**学它值不值**：★★☆☆☆ 取决于你有没有服务端。

**源码**：`slices/19-sharing.js`

---

## 13. 更新

**目标**：静默更新 + 强制更新。

**实现要点**
- `electron-updater`，feed `api/app-update/v2`，带 channel
- 策略：`gte(current, newestInstalled) ? 'forced' : 'manual'`
- `electron-dl` 做下载进度

**学它值不值**：★★★☆☆ 上线必备。

**源码**：`slices/15-updater.js`

---

## 14. 授权

**目标**：卖 license，且离线可用。

**实现要点**（详见 `01-ARCHITECTURE-1PAGE.md` 决策 3）
- 本地只验结构
- 三道闸：启动 / 窗口聚焦 / 输入 key
- 网络异常 fail-open

**学它值不值**：★★★☆☆ 想清楚取舍再抄，抄错方向等于送破解。

**源码**：`slices/01`–`06`、`16`
