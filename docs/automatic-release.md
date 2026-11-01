# main 自动发布（2026-11-01）

此前 main 只生成短期 Actions artifact，正式 Release 必须额外推送版本标签；海港棋桌 1.1.0 合入 main 后仍只展示 1.0.0 Release。

本批在原工作流中增加 main 自动发布与 main 手动补发，仍先执行全部规则、打包、UI 和真实 QuickJS 发布验证。发布脚本读取本轮生成的 release.json，核对仓库、实际验证提交、游戏 ID、精确版本、文件名、ZIP 摘要和 SHA256SUMS，再创建指向该 SHA 的缺失标签及正式 Release。不依赖自动打标签再次触发工作流。PR 与其他分支的手动运行均不授予发布权限。

完整的正式 Release 会跳过，绝不重传旧附件；草稿、预发布、缺失附件或未发布标签指向其他提交均失败并等待核查。只有 GitHub 返回 404 才视为不存在；授权、网络和发布错误原样失败。发布 job 使用同一串行组，避免标签与 main 任务同时写入。

实际本地检查：`node --test tests/publish-release.test.mjs` **9/9 通过、无 skip**；`git diff --check` 通过。用临时包和模拟 GitHub 返回验证发布权限、幂等、不可变性和失败保护；这些回归不冒充真实上传。GitHub 上仍须执行原完整检查并在正式 main 运行后核验 Release 与附件。

平台 main 的官方目录、独立仓库 release.config.json 与现有规则 manifest 已核对：仓库 `PlayBoardgameTogether/playboard-game-puerto-rico`、名称「波多黎各」、ID `online.puerto-rico`、archive `puerto-rico` 和经典玩法一致，**登记已核对，无需改动**。平台来源锁与锁定集成副本保持原精确版本。仅开发/发布工具与内部说明变化，游戏/资源版本保持 1.1.0、contentVersion 保持 1.0.0，平台不升号。

订阅安装需要已部署订阅功能且管理员启用相应开关；本批没有生产管理员会话，未执行平台订阅同步/安装或服务器部署。正式发布后另在平台仓库清单记录实际版本；发布结果不等于生产已上架。
