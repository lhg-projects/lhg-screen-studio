# 还原方法与可信度

## 流水线

```
Screen Studio.app/Contents/Resources/app.asar
        │  npx @electron/asar extract
        ▼
dist-electron/index.js    7,484,678 B   ← 混淆态
dist-electron/preload.js    573 KB
dist/*.js                    72 chunks
        │  tools/deobfuscate.cjs（提取字符串数组 → VM 执行解码器 → 回填字面量）
        ▼
index.deobfuscated.js     7,476,897 B   替换 80,221 处字符串
preload.deobfuscated.js                 替换  5,890 处
renderer/*.js                           替换 26,623 处（首个 chunk）
        │  tools/analyze.cjs + tools/fingerprint.cjs
        ▼
538 个顶层代码块 → 按 node_modules 源码指纹归属到 28 个 npm 包
        │  tools/make-slices.cjs
        ▼
23 个按功能锚点切出的可读切片
```

## 反混淆原理

产物是 `javascript-obfuscator` 的标准三件套：

1. **字符串数组函数** `_0x35cc()` —— 800 KB 的巨型字面量数组，存放所有字符串
2. **解码器** `_0x36ae(i)` —— `return arr[i - 0x10F]`，纯下标偏移
3. **轮转 IIFE** —— 启动时把数组旋转 N 位，所以静态下标对不上，必须真正执行

工具的做法：把三段抽出来丢进 `node:vm` 执行一次，拿到可用的解码器；再用平衡括号扫描避开它们的字节区间，对全文所有 `_0x36ae(0x…)` 和 11,303 个本地别名调用做替换。非字符串返回值（数字、对象）一律跳过，避免破坏语义。

**校验**：
- 反混淆产物 `node --check` 通过
- 文件头 1039 字节与原文件逐字节一致（数组/解码器/轮转三段完好未动）
- 解码器输出与运行时实际值抽样比对一致

## 归属分析（认祖归宗）

主进程 7.1 MB 是单文件、5370 个顶层语句，没有 sourcemap、没有 `// node_modules/` 注释（打包后被混淆器剥了）。所以用了个间接办法：

1. 遍历 `node_modules/` 里 132 个包的源码，抽取字符串字面量（每包上限 6000 条），建立 `string → package` 倒排索引
2. 对 bundle 里每个顶层块，统计其字符串命中哪些包，取最高分
3. 命中 ≥4 条即判为该包

结果：

```
@sentry        2,359,889 B
APP            1,328,093 B   ← 应用自身代码
qs             1,075,693 B
get-intrinsic    513,000 B
readable-stream  336,522 B
mime-db          202,011 B
ajv               98,324 B
conf              62,451 B
...
```

**应用自身代码只有 1.33 MB**，这个数字决定了阅读策略：值得读的东西占 19%。

> 局限：没有源码的小包会被误判为 APP。已知误判包括 punycode 的 IDNA 表、systeminformation 的 OUI 数据库、部分 cli-table 输出。这些块的特征是"巨型字面量数组 + 无业务语义"。

## 可信度分级

| 产物 | 可信度 | 说明 |
|---|---|---|
| 字符串字面量 | ★★★★★ | 机械还原，可逐条验证 |
| 控制流 / 函数结构 | ★★★★★ | 混淆器不改结构，只改名字 |
| 属性名 | ★★★★★ | 混淆器默认不动属性名 |
| 23 个功能切片 | ★★★★☆ | 锚点定位准确，边界是 ±30KB 的人工窗口 |
| 第三方包归属 | ★★★★☆ | 指纹匹配，误判集中在无源码的小包 |
| 原始文件划分 | ★★☆☆☆ | 只能近似。想看"作者当初怎么分文件的"，得靠语义判断 |
| 本地变量名 | ★☆☆☆☆ | 永久丢失 |

## 已知坑

- **`ELECTRON_RUN_AS_NODE=1`**：在 Electron 宿主派生的 shell 里直接跑二进制，Electron 会退化成纯 Node 立刻退出。用 `env -u ELECTRON_RUN_AS_NODE open -a ...` 绕开。
- **`index.deobfuscated.js` 不能直接跑**：ESM/CJS 混合 + 原生模块依赖，只用于阅读。
- **渲染 chunk 之间共享模块**：Vite 把 react 等拆到独立 chunk，单独读一个 chunk 会看到大量 `import` 指向别的哈希文件名——正常的代码分割，不是缺失。
- **切片起点可能是语句中间**：已做分号边界吸附，但极长的单行代码里仍可能切到表达式中间。用 ▼ANCHOR 标记定位真实锚点。

## 一句话

**逻辑全在，命名回不来。** 学算法、学架构、学 IPC 契约、学状态流转——够用；想还原成能 `git blame` 的仓库——做不到。
