# D12：市长工人分配帮助（2026-11-12，1.1.2 候选）

基线为独立仓库 main `d206705`；编辑前成功 fetch，新建 `codex/d12-decision-help`。平台验证从 `main@1c70c2d` 的隔离工作区执行，保留原目录和 D11 待审查内容。

## 实现

原清空岗位后仅提示“请尽可能填满所有岗位”。320px 的新增用例首先在“还需安排 2 人”断言失败，确认现版缺少精确指导。现在显示必须上岗数、工人/岗位总数、缺少或超配人数及单岗整数要求。确认旁增加未提交产能预览：玉米只看种植园，其他货物取上岗种植园与加工岗位的较小值，明确未来实际生产受供给和行动顺序限制。人数提示和预览与输入关联，支持键盘；手机预览跟随原确认区并单独换行。双端简图见 [方案](../design/worker-help-1.1.2.md)。

游戏 **1.1.1 → 1.1.2（PATCH）**，只改善既有分配说明与预览。经典规则、`contentVersion=1.0.0`、资源 `1.1.0`、View/动作格式与平台契约保持；旧版本不覆盖，无平台运行代码或 SDK 更新。README、包说明与游戏指南同步候选版本。

CI check runner 固定 Ubuntu 24.04：D11 已确认 Playwright 1.55 不支持 ubuntu-latest 当前的 Ubuntu 26.04，本仓库使用同一锁定浏览器版本。不升级依赖，不修改发布条件；合入 main 将按既有工作流验证并自动发布新版本，本轮只提交 PR。

## 实际验证

pnpm 命令均带 `--config.verify-deps-before-run=false`，依赖先按冻结锁安装。

| 命令 / 范围 | 结果 |
| --- | --- |
| `pnpm test` | 16/16，无 skip；含真实受限 QuickJS 的 3/4/5 人完整脚本局及逐步恢复 |
| `pnpm build` | 最终 ZIP 1,557,813 字节，解压 2,087,271 字节，原 2 MiB 限制通过 |
| `pnpm test:ui` | 最终 12/12，无 skip，1440×900、1280×800、390×844、320×740；两主题、键盘、移动触摸仿真、减少动态效果、草稿/提交锁、输入异常、恢复与 iframe cookie 隔离 |
| `pnpm verify` | 最终 1/1；三文件格式、最小/最大人数、真实运行时、序列化及精确版本附件清单通过 |
| `node --test tests/publish-release.test.mjs` | 1/1，无 skip |
| 平台全工作区 `pnpm typecheck` / `pnpm lint` | 通过，含 20 个源码目录 AST 分层及原格式检查；最终测试变更的定向 ESLint 通过 |
| 浏览器脚本 / TS 测试定向 ESLint | 使用平台既有规则与实际浏览器/共享常量 globals 通过；探索时直接套 Node globals 的错误不计为通过 |
| 平台真实三账号 E2E | 最终候选 1440/390/320px 3/3，无 skip；实际上传审核、建房/加入/准备、键盘或触摸手动分配、三人完成市长阶段、revision 0→4、刷新恢复及对手筹码/结果隐私 |
| 平台来源锁 / 差异 | 10 仓库、154 集成文件未漂移；最终源码与已验证 ZIP 规则/桌面字节一致，两仓库 `git diff --check` 通过 |

平台候选命令：

```sh
PUERTO_RICO_TEST_VERSION=1.1.2 PUERTO_RICO_TEST_WORKER_HELP=true \
  pnpm --config.verify-deps-before-run=false test:e2e tests/e2e/puerto-rico.spec.ts \
  --config .data/d12/e2e.config.ts --grep 'three signed-in' --output .data/d12/e2e-verified
```

平台 E2E 的默认版本仍为锁定 1.0.0，新增帮助断言须明确开启，不能因当前副本尚未引入而悄悄跳过候选检查。正式验证始终显式开启该标志。候选使用 PostgreSQL 17 回环 15441 的新库 `playboard_d12_final_test_20261112`，与开发库 `playboard_d1_scratch` 及生产库分离，原 prepare/migrate/sync/seed/run 链完整执行，清库命令串行。缺本机 TTS 时原种子安装原创 SVG，不声称验证外部图包。

检查过程：沙箱 Chromium 启动受限后在外层运行；新增规则产能断言最初未等待异步提交，改为等待权威规则产能后最终四视口通过，未改规则。release 验证首次因构建目录同时存在本轮基线 1.1.1 和候选 1.1.2 而拒绝；将本轮生成的基线 ZIP 移至 `dist/baseline` 后原检查通过。平台 E2E 首轮三项在旧 256px 头像假设失败，改为从实际包 PNG 读取宽高，保留成功解码检查；第二轮因旧专用库已装入早期候选、同版本字节变化而拒绝，保留不可变保护和旧库，改用上述全新独立库后 3/3 通过。成功退出时 Vite 曾记录关闭连接的 ECONNRESET，测试无失败。

实际查看最终 320px 亮色和 1440px 暗色产能预览截图，以及真实联机 320px 阶段结束画面。独立 UI 画面在 `test-results/`，平台证据在 `/tmp/playboard-d12-puerto-help/.data/d12/`，不提交会话、数据库、ZIP 或生成物。固定父窗口 UI 检查和真实 session/API/WS 验收分别记录，不将设备仿真说成物理手机。

## 兼容、登记与发布边界

**登记已核对，无需改动**：平台 catalog、独立 `release.config.json`、manifest 的仓库、名称、`online.puerto-rico` 和 `puerto-rico` 前缀一致。平台来源锁未导入本候选，旧版本仍由原安装/精确版本恢复；候选可作为新版本与旧包共存。游戏沿用 SOURCE.json 的 SDK 兼容快照，本轮另在平台 **1.2.6** 的真实运行时验证，无新增最低版本能力。

生产本轮只读核对 current.json、实际 API cwd 和运行 package.json，仍为 **1c70c2d / 1.2.6**，服务 active/running、NRestarts=0。未合并、打标、发布 Release、主动订阅安装、重启或修改生产数据。未来需审查并获准合并游戏 PR，等待原 main 自动验证/发布，核对新标签、ZIP、release.json 与 SHA256SUMS，再由平台按既有已启用订阅或管理员审核流程安装；发布后才更新平台正式版本清单，不先改来源锁。

未验收物理手机、Safari/WebKit、完整屏幕阅读器或真实模型；未重复全平台构建、全库业务集成/E2E。本轮未扩展仓储/角色规则或后续每日任务。PR 与远程检查实际状态在交付后补记。
