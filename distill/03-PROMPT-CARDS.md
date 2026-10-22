# 任务卡 — 直接粘贴给 AI 编程助手

五张卡，按依赖顺序。每张都能独立执行。

**通用前置**：把 `01-ARCHITECTURE-1PAGE.md` 和 `02-CAPABILITY-MAP.md` 一起给它（合计约 7 KB，任何现代模型都吃得下）。

---

## 卡 1：搭骨架（半天）

```
角色：Electron 架构师。

任务：搭一个 macOS 录屏剪辑应用的最小骨架，不要实现具体功能。

技术要求：
- Electron 39+，TypeScript，Vite 构建渲染进程
- 主进程能力用 tRPC router 暴露（用 electron-trpc），不要手写裸 ipcMain.handle
- router 按域分组：project / recorder / export / assets / system
- 渲染进程用 React + zustand，只放一个空壳页面
- 打包用 electron-builder，target dmg

验收标准：
1. npm run dev 能起窗口
2. 渲染进程能调用 trpc.system.ping.query() 并拿到 'pong'
3. 目录结构清晰：src/main/{router,services,store}、src/renderer/{pages,components,stores}

不要做的：不要实现录屏、不要实现导出、不要抄任何现成项目代码。
```

---

## 卡 2：录屏采集 + 崩溃恢复（1–2 天）

```
角色：macOS 系统编程工程师。

任务：在现有 Electron 项目里实现屏幕录制，重点是不丢素材。

必须实现：
1. 权限检查（屏幕录制 + 辅助功能），缺权限弹引导页，说明如何到系统设置授权
2. macOS 13+ 优先用 ScreenCaptureKit；启动时探测能力，不支持则回退 desktopCapturer
3. 可录对象枚举：所有窗口（带缩略图）+ 所有显示器，监听 display-added/removed 事件实时刷新
4. 录制状态机：preCheck → start → (pause|resume|mark) → finish|cancel
5. ★ 崩溃恢复：录制开始即把 {sessionId, outputPath, startedAt, state} 写入磁盘清单；
   每次状态变化更新；启动时若清单非空，提示"发现未完成录音，是否恢复"；
   finish 成功后从清单移除

验收标准：
1. 直接 kill -9 主进程，重启后能看到恢复提示，且已录的素材可读
2. 拔掉外接显示器，录制不中断
3. 拒绝权限后，UI 给出明确的下一步指引而不是空白

不要做的：不要做剪辑、不要做导出。
```

---

## 卡 3：★ 缩放引擎（3–5 天，这是重点）

```
角色：视频算法工程师。

任务：实现"自动缩放"——让录屏在用户关注某区域时平滑放大。

数据结构：
ZoomRange {
  id: string
  type: 'auto' | 'manual'
  sourceStartTime: number   // ms
  sourceEndTime: number
  target: { x, y, w, h }    // 归一化 0..1 的聚焦矩形
  easing: { in: string, out: string, inMs: number, outMs: number }
  isDisabled: boolean
}

算法要求：
1. 采集输入：光标轨迹（t, x, y）、点击事件（t, x, y）、窗口/元素边界
2. 生成 zoomRange 的启发式：
   - 光标在某区域停留超过阈值 T1 且位移小于 D → 候选
   - 区域内发生点击 → 权重大幅提升
   - 连续候选合并，短间隔不重复缩放（避免抖动）
   - 输出前做平滑：对缩放中心做低通滤波，对倍率做限幅
3. 时间映射：源时间 → 播放时间（存在剪辑时两者不同），必须支持双向换算
4. 缓动：进入用 easeOutCubic，退出用 easeInCubic，默认时长 320-400ms
5. 叠加规则：系统级缩放 + 用户手动缩放要能合成，不能互相覆盖

验收标准：
1. 给一段 60 秒的真实录屏 + 光标轨迹，能自动产出 8-15 个 zoomRange
2. 播放时画面不抖、不跳、不突然拉回
3. 手动框选能覆盖自动结果

关键约束：
- 所有阈值必须做成可配置常量并集中在一个 config 文件里
- 单元测试覆盖：空轨迹、单点点击、高速移动、边界区域

不要做的：不要用现成的自动剪辑库，自己实现。
```

---

## 卡 4：视觉合成（2–3 天）

```
角色：图形工程师（Canvas / WebGL）。

任务：把录屏画面合成为"作品级"画面。

参数（全部可配）：
- background: 纯色 | 线性渐变 | 图片 | 模糊放大的自身画面
- padding: 画面到边缘的内边距（按输出分辨率的百分比，不是固定像素）
- cornerRadius: 圆角
- shadow: 多层阴影（至少 2 层：近距离细节 + 远距离扩散），单层阴影视觉上一定假

渲染要求：
1. 背景模糊放大版：把画面缩到 1/8，高斯模糊，放大铺满，加暗角
2. 阴影用 CSS box-shadow 多层叠加即可，但要按输出分辨率缩放
3. 输出分辨率与预览分辨率解耦：同一套参数在两处渲染结果必须一致

验收标准：
1. 1080p 和 4K 输出，视觉比例完全一致
2. 切换背景不重新编码

不要做的：不要做 3D 透视、不要做粒子特效。
```

---

## 卡 5：参数考古（半天，产出规格的钥匙）

```
角色：逆向工程师。

任务：从给定的混淆代码里挖出真实数值参数，输出参数表。

输入：
- 文件 A：reconstructed/src/renderer/5NxSBPmq.js（含 zoomRange / motionBlur 逻辑）
- 文件 B：reconstructed/src/renderer/D4qqfDv_.js（含 store / 默认配置）
- 文件 C：reconstructed/src/main/slices/10-project-model-zoom.js

方法：
1. 搜索关键词：zoomRange, zoomRanges, easing, spring, motionBlur, clickSound,
   padding, cornerRadius, shadow, bitrate, frameRate, cursorSize, alwaysKeepZoomedIn
2. 对每个命中点，取其前后 300-500 字符，找其中的数值常量
   （注意：混淆器把数字写成十六进制表达式，如 0x1f4-0x64 = 400，必须求值）
3. 判断这个数字属于哪个参数：看它被赋给了什么属性名，或参与了什么运算
4. 单位推断：毫秒/像素/百分比/倍率

输出格式（Markdown 表格）：
| 参数 | 值 | 单位 | 出现位置 | 置信度 | 推断依据 |

要求：
- 每个值必须给出"为什么是这个参数"的依据，不许猜
- 置信度分三档：高（属性名直接对应）/ 中（运算上下文对应）/ 低（仅数值接近）
- 无法确定的写"未确定"，不要编

交付：PARAMS.md，只含表格 + 置信度说明，不要解释代码。
```

---

## 使用顺序建议

```
卡1 骨架
  └→ 卡2 采集（能录了）
       └→ 卡4 合成（画面好看了）
            └→ 卡3 缩放（灵魂）
                 └→ 卡5 参数考古（把"能用"调到"高级"）
```

**卡 3 和卡 5 可以并行**：卡 5 挖出的真实参数直接喂回卡 3 的 config 文件。
