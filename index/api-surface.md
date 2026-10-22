# 主进程能力清单（渲染进程可见的 API）

来源：对 `index.deobfuscated.js` 做 AST 扫描，提取所有 `<router>.query("name")` / `.mutation("name")` 调用，再按业务归组。

> ⚠️ 提取是机械的，混入了少量非 tRPC 的同名调用（`all` / `get` / `check` / `home` / `context` / `ping` 等），下面已剔除。真实 procedure 共 **~150** 个。

图例：`q` = query（读、可缓存），`m` = mutation（写、有副作用）。

---

## 1. 授权 / 激活 `~20`

```
q  auth.isTokenValid            服务端校验当前 token
q  activation.status            → { type: 'valid' | ... }
q  auth.terms.lastUpdatedAt     条款最新版本时间
q  auth.terms.lastAcceptedByUser  当前用户接受条款的时间
q  hasToken                     本地是否有 token
q  token                        原始 JWT 字符串
q  authPayload                  解析后的 JWT payload
q  readLicenseKeyFromClipboard  从剪贴板读 license key
q  machineId                    设备指纹
q  canRegister                  UI 是否展示注册入口
m  setToken                     写入 token（持久化）
m  logout                       清 token + 重置状态
m  auth.terms.accept            标记已接受最新条款
m  auth.terms.reset             重置条款接受状态
m  auth.authorize.app.tryToUpgradeToken
m  auth.authorize.app.requestTokenAfterRecentOrder
m  updateTokenAfterRecentOrder
q  license.verify               （服务端）校验 license key + instanceId
q  teams.getBlockedFeatures     团队套餐被禁用的功能位
q  blockedFeatures              同上（本地缓存副本）
```

## 2. 项目生命周期 `~18`

```
q  lastRequestedFileToOpen      启动时要打开的项目（Finder 双击 / 命令行）
q  projectsPathsFromFolder      扫描某目录下所有项目
q  readProject                  读 project.json
q  openProject                  打开项目（可能弹选择框）
q  loadProject                  加载进内存，返回完整模型
q  newProjectFileName           生成不重名的新项目文件名
q  defaultPath                  默认项目根目录
q  loadFile / checkIfFileExists / getFileStat / getMimeTypeExtension
m  updateProject                保存修改（主进程持权威副本）
m  copyProject                  复制整个项目目录
m  removeProject
m  moveProject
m  copyFileToProject            往项目里塞素材
m  markAsRecent                 维护最近项目列表
m  createZipFromProjectAndCopyToClipboard
```

## 3. 录音采集 `~14`

```
q  unfinishedRecordings         磁盘上未收尾的录音清单
q  getUnfinishedRecordingInfo   单项详情（崩溃恢复弹窗用）
q  recorderVersion              采集模块版本
q  isScreenCaptureKitSupported  能力探测（macOS 13+）
q  capturableWindows            可录窗口列表
q  capturableWindowById
m  preRecordingCheck            开录前体检（权限 / 空间 / 设备）
m  start / cancel / finish      录音生命周期
m  pause / resume
m  addMarker                    录制中打时间点标记
m  tryToRecoverRecording        崩溃恢复
m  removeUnfinishedRecordingFromStore
m  extractRawRecordingFiles     拆出原始视频/音频轨
```

## 4. 项目素材与编辑 `~12`

```
q  backgrounds / backgroundPath  背景素材库
q  cursorSets / cursorSize       鼠标光标样式
q  builtInTracks                 内置音轨
q  mouseClickSoundPath           点击音效
q  waveform                      音频波形数据
q  durationMsOfAudioFile
q  faceBounds                    人脸区域（摄像头画中画自动定位）
q  hasAccessToPresetsPath        预设目录权限
```

## 5. 导出 / 字幕 `~12`

```
q  getTranscript                 时间轴转写数据
q  getTempClipboardExportsPath   临时导出目录
q  getTempQaExportsPath
q  supportedLocales              转写支持的语言
q  speech.voices                 TTS/转写音色
q  isGeneratorSupported          生成能力探测
m  updateTranscript
m  exportTranscriptAsSRT        导出 .srt
m  generateAll / generateMissing 批量 / 增量生成字幕
q  userNameForExport / 导出进度相关
```

## 6. 分享 `3`

```
q  share.newShareableLinkId
m  share.prepareShareableLink
m  share.finalizeShareableLink
```

## 7. 窗口 / 应用 / 系统 `~20`

```
q  version / osVersion / isDev
q  appDataFolderPath / userLibraryPath
q  memoryInfo / freeStorageSpace / freeDiskSpace
q  diagnosticData                一键导出诊断包
q  canReachAPI                   连通性探测
q  annonymousId                  匿名标识
q  waitForReady                  渲染端等待主进程就绪
m  resizeSystemWindow
m  bringWindowToFront / focus
m  setProgressBar                Dock 进度条
m  quit / restart / openDashboard
m  showMessageBox / showErrorBox
m  playSoundAsset
m  blockThread                   （测试用）阻塞主线程
```

## 8. 更新 `1`

```
q  updates.checkForUpdates      → 触发 electron-updater
```

## 9. 开发者专用 `3`

```
m  dev.test / dev.throw / throwError
```

---

## 与远程服务的边界

下表区分**本地能力**（主进程自己实现）和**远程代理**（主进程只是转发到 `https://screen.studio/api/trpc`）：

| 远程代理（需联网） | 本地实现（离线可用） |
|---|---|
| `auth.isTokenValid`、`activation.status`、`license.verify` | 全部项目管理 |
| `auth.terms.*`、`teams.getBlockedFeatures` | 全部录音采集 |
| `updates.checkForUpdates`、`share.*` | 全部导出与转写 |
| `speech.*`、`qa.addExportOutputs` | 窗口/系统信息/诊断 |

**这个分界线就是破解面所在**：断掉上表左列的域名，右列功能完全不受影响——所以 `/etc/hosts` 一行 `127.0.0.1 screen.studio` 就能让应用长期可用（前提是它选择 fail-open）。
