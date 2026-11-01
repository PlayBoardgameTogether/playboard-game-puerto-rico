# PlayBoard · 波多黎各

独立游戏源码、测试和安装 ZIP 发布项目。平台主仓库：[PlayBoardgameTogether/PlayBoardgameTogether](https://github.com/PlayBoardgameTogether/PlayBoardgameTogether)。

## 本地构建

使用 Node.js 22 和 pnpm@11.15.1。项目包含独立锁文件，使用冻结安装：

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
pnpm build
pnpm test:ui
pnpm verify
```

安装 ZIP 在 `dist/game-packages/`；验证后的发布附件、`SHA256SUMS` 与 `release.json` 在 `dist/release/`。ZIP 不提交 Git。

## 独立发布

合入 `main` 后，GitHub Actions 自动完成规则测试、发布脚本回归、打包、双端 UI 检查和平台运行时验证；全部通过后读取包内版本，创建缺失的版本标签和正式 GitHub Release，附带安装 ZIP、`SHA256SUMS` 与 `release.json`。不再需要手动打标签。PR 只验证和生成临时构建附件，不发布。

在 main 手动运行工作流可补发或重试；其他分支手动运行只验证。仍支持推送以下精确版本标签触发发布：

- `puerto-rico-vMAJOR.MINOR.PATCH` 对应 `online.puerto-rico`。

标签必须与包内 manifest 的精确版本一致；版本来源为规则代码，根 package.json 的 0.0.0 仅为私有工具包占位号。同一游戏版本不得修改规则、桌面或美术后重新发布；已发布且附件齐全的正式 Release 会跳过，保留旧标签和附件。未发布的同名标签若指向其他提交、已有草稿/预发布或附件缺失则报错，需人工核查；网络和授权错误不会被当作“版本不存在”。发布任务串行执行，标签固定到本轮实际验证的 SHA。

管理员下载 Release 附件中的游戏 ZIP，核对 SHA256SUMS，再在平台游戏管理中检查和审核安装。GitHub 自动提供的 Source code.zip 不能直接安装。发布不会自动修改生产数据库或已开始的对局。

平台官方目录已登记 `online.puerto-rico` / `puerto-rico`，本次登记已核对，无需改动。已部署官方订阅且管理员启用对应开关时，平台可同步正式 Release；发布成功不代表已经安装或上架。自动发布改动不改变游戏 1.1.0、规则内容 1.0.0 或平台版本。

## 来源与兼容性

初始游戏和规则测试来自平台提交 `a7e36d32e2febeb5bd7013752f099d01d0502316`，路径及原始摘要记录在 SOURCE.json。`apps/api/src` 和 `packages/game-sdk/src` 仅包含测试所需的固定兼容性快照，不启动平台 API，也不依赖主仓库工作区。可在明确的平台版本升级时更新该快照；生产安装仍以平台自身审核为准。

玩法、素材和历史说明见 [游戏说明](game-packages/puerto-rico/README.md)。其中平台集成/E2E 命令需在平台主仓库运行；本仓库的独立验证命令以上文为准。

## 海港棋桌 1.1.0

采用独立透明徽章、加勒比海港横幅、23 种建筑、土地和货物图集。货船可直接预览合法装载，殖民所、工人船、贸易所与本人领地分区呈现。手机有岛屿/海港区域切换与装船确认栏；电脑并列比较海港与岛屿。物件可打开大图详情，工人仍可用键盘/数值分配。动画只表现获准的投影事件，保留减少动态效果和只读回放边界。

设计和双端草图见 [海港方案](design/harbor-plan.md)，素材来源、提示词及图集映射见 [美术说明](game-packages/puerto-rico/art/README.md)。仅桌面、展示美术和可选交互增强，经典规则与 contentVersion 仍为 1.0.0；独立游戏版本和资源版本升至 1.1.0，平台版本另行维护。历史安装 1.0.0 与既有对局不覆盖。

本批命令、实际结果与未验证范围见 [1.1.0 交付验证](docs/validation-1.1.0.md)。

## 许可证

Copyright (C) 2026 TheTopBoardgameAssociation

除另有声明的文件外，本项目采用 [GNU GPL v3.0](LICENSE)（`GPL-3.0-only`）开源协议，允许按协议使用、修改和分发。本软件不提供任何担保，具体条款见 LICENSE。

已有单独许可声明的素材、第三方代码和依赖继续遵循各自的许可与署名要求；例如标明 CC0-1.0 的资源仍按原许可分发。

## 玩家名称（2026-11-01，1.1.1）

桌面读取平台 `boardgame:view.playerNames` 的公开 seatId→昵称映射，玩家区、回合提示和结果优先显示昵称，本人附加“（你）”；未提供映射保留匿名标签。名称只作展示，使用 textContent，不参与规则或授权。需要平台名称桥接支持（平台 1.1.1）；旧平台仍可使用匿名回退。官方目录的仓库、ID、包名前缀与玩法已核对，无需改动。旧 ZIP 和旧局不覆盖，新版本须按原流程审核安装。

本轮实际验证与发布边界见 [昵称修复验证](docs/player-names-validation.md)。
