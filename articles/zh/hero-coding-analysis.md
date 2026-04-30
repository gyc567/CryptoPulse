# hero-coding：多Agent编码工厂的极简MVP——小模型不是"笨"，而是需要你当好监工

你试过用Agent写代码吗？

token烧了几百块，出来的代码还得自己改三遍。

**hero-coding** 换了个思路：不卷大脑智商，卷流水线设计。你写一句需求，它自动改代码、写测试、commit——不用盯、不用调、不烧钱。400行TypeScript，不挑显卡、不绑平台、不烧钱——这是它的核心承诺。

---

## 背景：为什么大家都在卷智商，但都在翻车？

大多数人聊Agent都爱卷"大脑智商"：更大模型、更复杂规划、更长的Chain of Thought。结果呢？token烧得飞起，速度慢如龟爬，生产环境一上线就翻车。

**hero-coding** 反其道而行之。它是一个**最小可行性全自动编码Agent**：

> 你往 `inbox/` 扔一个用户故事（user story），半天后回来看 git log，代码已经改好、测试通过、commit 整整齐齐。

整个系统只有 **400 行 TypeScript** 就把现成的 pi-coding-agent 包装成工厂流水线。核心理念只有一句话：

**非思考小模型 + 极简 harness（护栏）= 又快又省又稳。**

作者 LawrenceW_Zen 本想验证"非思考小模型在多Agent里更省钱"的反直觉猜想，结果数据把他自己打脸了：**不是单纯小模型赢，而是"分工明确 + harness 兜底"赢**。

- Ling-2.6-flash（小模型）负责快速执行
- Ling-2.5-1T（大非思考模型）负责规划理解
- 某思考大模型反而成了最贵的"表演型选手"

---

## 一、项目介绍：从猜想到极简工厂

**全自动 coding agent 的定义**：扔一个需求进去，系统自己读代码库、改文件、跑测试、commit，最后告诉你"搞定"。不需要你全程盯着。

hero-coding 三个核心组件全是**无状态一次性进程**（每次任务独立运行，互不干扰）：

- **Dispatcher（调度器）**：文件夹监控员，盯着 inbox/ 目录，有新需求就往流水线上下发，一次只处理一件，绝不同时干两件事。
- **Worker（工人）**：调用 pi-coding-agent 执行具体代码修改，每次改动都原子 commit（避免一锅乱）。
- **Judge（裁判）**：读 git log + diff，给出 PASS/FAIL + 理由，像 QA 工程师。

所有状态靠 **git + 文件系统** 持久化，不依赖任何数据库或内存队列。这设计极其优雅——长任务其实就是短任务串成长链，出了问题随时能重跑某一段。

**User Story 用 markdown + frontmatter 写**，格式如下：

```yaml
---
id: us-001
title: 给 formatDate 加时区参数
priority: normal
max_retries: 3
---
## Goal
给 src/utils.ts 里的 formatDate 加可选 timezone 参数，默认 UTC。

## Acceptance Criteria
- 函数签名支持 timezone?: string
- 老调用方式不变
- 新增3个测试用例
- npm test 全过

## Out of Scope
- 改其他文件
- 改格式风格
```

**Out of Scope 比 Goal 更重要**——这就是给非思考小模型戴的"紧箍咒"。小模型爱自由发挥，这一节直接把边界锁死。

---

## 为什么 flash 会卡死，而 1T 不会？

作者一开始全用 flash 结果卡死循环，后来改成 **Ling-1T 做大脑规划 + flash 做执行手**，完美解决。

原因很简单：

- **flash 的问题**：执行太快但缺乏全局规划，容易在细节里打转——死循环就是这样来的。
- **1T 的作用**：1M 上下文能一次看全貌，先规划再动手，两者的节奏刚好互补。

这才是真正的"多Agent协同"——不是堆模型，是**分工 + 50 行 harness**。

---

## 二、详细教程：20 分钟从零跑通

1. **克隆仓库**
   ```bash
   git clone https://github.com/lawrencewzen/hero-coding.git
   cd hero-coding
   npm install
   ```

2. **配置 .env**（最关键一步）
   复制 `.env.example` 为 `.env`，填入：
   - `TARGET_REPO`：你要改的目标代码库路径（推荐用 examples/target-repo-pristine 这个带 bug 的 demo）
   - `WORKER_*` 和 `JUDGE_*`：分别配置 Worker 和 Judge 的模型（OpenAI 兼容协议）
     - 示例：Ling-flash 做 Worker（快）、Ling-1T 做 Judge（准）
   - API Key、Base URL 都填对应提供商的

3. **扔需求**
   ```bash
   cp examples/stories/us-001.md inbox/
   ```
   （或者自己新建 markdown 文件，按上面的模板写）

4. **启动观察**
   ```bash
   npm run watch
   ```
   终端会实时滚动 Worker 的 tool call（你会看到它一步步读文件、改代码、跑测试）。成功后 story 自动移到 `done/`，git log 里全是干净 commit。

**高级技巧（作者实战总结）**：
- 用 `pi-config/models.json` 快速切换模型
- harness 里的**循环检测**（~10 行）和**Auto-rescue commit**（dispatcher 自动 commit）是救命代码——小模型最爱忘 commit 或死循环，这两招直接秒杀 90% 翻车场景
- 想扩展？pi-coding-agent 官方故意不做 sub-agent 和 plan mode，就是留给你自己搭 harness 的

整个流程**无服务器、无持久 Agent**，本地跑就行，成本低到离谱。

---

## 三、实测评测：数据说话，谁赢谁输？

作者用同一 harness、同一个 bug 项目、同一个 Judge 跑了三组对照，结果一目了然：

| 任务类型 | 模型组合 | 时间 | Token 用量 | 胜负对比 |
|----------|----------|------|------------|----------|
| 加功能+写测试 | 某思考大模型 | 205s | 120K | 基线 |
| 加功能+写测试 | Ling-2.5-1T | 130s | **13K** | **11% token、63% 时间** |
| Bug 修复 | 某思考大模型 | 131s | - | 基线 |
| Bug 修复 | Ling-2.6-flash | **90s** | - | **快 31%** |
| 加输入校验 | 某思考大模型 | 86s | 13K | 基线 |
| 加输入校验 | Ling-2.5-1T | **58s** | **5K** | **33% 更快、40% token** |

**犀利结论**：

- **Flash 在高频小任务（补全、快速修复）是王者**：调用次数多但每次极快，完美适配"编辑器补全、批量改写"场景
- **1T 大非思考模型在规划类任务碾压**：上下文 1M 能一次塞整个仓库 + git history，思考克制，token 全花在输出上
- **思考大模型反而最贵**：隐式 reasoning 把 context 反复带入，token 雪崩
- **最重要**：**没有 harness，小模型必翻车**（作者亲测5次死循环）。有 harness 后，Ling 系列全胜 30-36%

数据公开在仓库 runs/*.json，全部可复现，不玩虚的。

---

## 四、综合评价：为什么这是 2026 年最被低估的 Agent 思路？

**独到观点一**：Agent 卷智商是伪命题，**卷 harness 才是真生产力**。50 行护栏代码（循环检测 + 自动 commit）比 5000 行 sub-agent 框架更值钱。它把"非思考模型的坑"直接堵死，让小模型敢用、能用、好用。

**独到观点二**：**小模型不是替代大模型，而是分工革命**。就像工厂里设计师（大模型规划）+ 熟练工（小模型执行）+ 质检员（Judge）。Ling-1T + flash 组合把 token 成本打到原来的 1/10，速度反而更快——这才是 Agent Economy 的工业化路径。

**独到观点三**：当前 99% 的开源 Agent 框架都在"把简单问题复杂化"。hero-coding 反向操作：**极简 + 现成工具 + 明确分工**，400 行就跑通生产级编码 Agent。

**优点**：
- 极致省钱省时（实测 30-89% 优化）
- 完全本地化、可复现、无 vendor lock-in
- 架构干净，扩展性强（想加多 Agent 直接改 dispatcher 就行）
- 适合高频低延迟场景（IM 助手、code review、批量重构）

**缺点**（坦率说）：
- 目前还是 MVP，只能处理单个 story 的线性任务（复杂依赖的多 story 需手动串联）
- 依赖 git 作为状态机，对非代码项目（比如纯文档）适配需额外开发
- 小模型在极端模糊需求上仍需更强的 Out of Scope 约束

**适用人群**：
- 独立开发者/小团队：想用 Agent 提效但不想烧钱
- AI 爱好者：想亲手验证"分工 > 堆智商"的实战派
- 企业内部工具开发者：需要可控、低成本、可审计的编码 Agent

**什么场景用，什么场景不用**：

| 场景 | 推荐度 |
|------|--------|
| 每天 3 个以上小改动（改 bug、加测试、批量重构） | ⭐⭐⭐⭐⭐ |
| 复杂多 story 协作的功能开发 | ⭐⭐ |
| 纯文档类任务 | ⭐ |

---

## 结论

下次你想用 Agent 写代码，别急着买最大最贵的模型。

**先问自己三个问题**：
1. 任务能不能拆？
2. 边界有没有锁死（Out of Scope 写清楚）？
3. 护栏有没有（harness 兜底）？

搞定这三点，Ling-flash 就能跑赢那些"聪明"的大模型。

想自己试？20 分钟跑通：

```bash
git clone https://github.com/lawrencewzen/hero-coding.git
cd hero-coding
npm install && npm run watch
```

仓库就在这里：https://github.com/lawrencewzen/hero-coding

跑一次，看着 Worker 实时滚动 tool call，你会瞬间明白：**这才是 Agent 该有的样子。**

---

*实测数据来源：仓库 runs/*.json，全部可复现。*
