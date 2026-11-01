# R07 浏览器结果客户端与工作台状态

[English](../../docs/isosui/design-browser-results.md) · [UI 契约](interfaces/browser-results_cn.md) · [首次使用](usage_cn.md)

**本分支仅定义设计。** 当前 `src/services/eos/control.ts` 提供通用 `eosRequest`；`EosWorkbench.tsx` 仍渲染旧版 `manual`、`primitive` 和 `skill_*` 控件，并把 JSON 字符串当作最近结果。它还没有类型化 `primitive_typed` 发送方或经授权的 `result` 读取方。R07 增加一个最小活动绑定类型化发送方、关联结果读取方和状态模型；U04 后续扩展完整的每绑定 UI。旧控件不能变成另一条运动路径。[EOS 所有者 R07 契约](interfaces/browser-results_cn.md)规定线路和错误；IsOS 拥有修订、运行和 Stop。

## 客户端与状态边界

新增 `src/services/eos/primitive-command.ts` 作为狭窄的 `base.velocity` 发送方，`src/services/eos/primitive-result.ts` 作为受保护读取方，二者沿用已验证回环地址与请求选项。发送方接收已解析的活动绑定、其唯一图连线目标、活动修订、已校验的 `body_velocity` 参数、EOS 单调时间、正序号和新命令 ID；它只生成公开 `primitive_typed` 封包，以 `TextEncoder` 计算紧凑 JSON 的 `payload_length_bytes`，拒绝不安全时钟／期限数值。它不接受自由目标或私有授权。结果客户端只接受 `{commandId, activeRevision}`，生成恰好 `op`、`command_id`、`active_revision` 三个公开键，解析六状态 `DispatchResult`，核对命令 ID，并把有界传输／所有者／协议错误映射为可辨识结果。两个客户端共用解码器，使首次发送与后续查询的状态语义相同。组件不能直接调用 `fetch`。HTTP 拒绝或 `ok:false` 响应是错误，不能强行转成命令的 `Rejected` 状态。服务超时或损坏的成功响应是不可用，不是 `OutcomeUnknown`，因为只有 EOS 能赋予命令该状态。

新增纯状态模型 `src/components/isos/primitive-result-state.ts`，由 `EosWorkbench` 使用。记录包含发送时捕获的 IsOS `runId`、`activeRevision`、活动绑定路径、生成的 `commandId`、最后一个所有者 `DispatchResult` 或 null、浏览器阶段（`sending`、`following`、`terminal`、`paused`、`unavailable`）、最后的安全错误及请求代际。只有 EOS 返回关联的 `Completed`、`Failed`、`Cancelled`、`Rejected` 或 `OutcomeUnknown`，状态才可转为 `terminal`；`InProgress` 保持 `following` 或 `paused`。`Failed` 要区别于 `Rejected` 和传输错误。遇到错误时仍显示命令 ID。发送超时或不确定结果绝不启动第二次 `primitive_typed` 提交。

R07 呈现一个最小活动 base 绑定卡，显示图解析目标及四个有界 SI 字段，由操作员点击 Invoke。模拟适配器可用于这张卡的验证，不能因此在 R06 前开放 MuJoCo 运动。发送前解析精确的活动图绑定与目标，检查 `saved_revision === graph.revision === active_revision`、`run_id_state:known`、`state:running`、无未保存草稿、EOS 就绪以及所有者报告的目标运动可用。只捕获一次运行／修订／绑定／命令 ID，取得 EOS 单调时间，在发送前立即复查 IsOS 围栏，然后只提交一次。状态模型在每次后续读取之前、页面重新可见之后重新读取 IsOS `process-status`，比较当前 `run_id` 和修订。IsOS 状态读取失败或 `run_id_state:unavailable` 时暂停后续查询并标为不可用。运行停止、运行 ID 或修订变化时取消未完成读取，并把记录封存为旧运行／不可用。浏览器请求代际与 `AbortController` 防止选择变化、Stop、卸载或运行改变之后的迟到回复更新当前卡片。即使选中相同绑定，新命令也建立新记录。UI 不能从草稿或命令响应推断活动修订。

结果轮询一次只读一个请求，遵循 UI 契约中的一秒初始延迟、十秒错误退避上限、六十秒／十二次上限及隐藏页暂停。达到上限时 `InProgress` 仍可见；手动刷新先重新检查 IsOS，再执行一次读取。终态停止读取。若首次发送响应丢失，UI 只能用生成的 ID 进行这种受保护的结果读取，把 `unknown command ID` 视为不透明不可用。服务层绝不重发 `primitive_typed`。Vision 仍使用独立的只读 WebSocket 和修订围栏。结果卡显示命令 ID、活动修订、绑定路径、精确所有者状态或不可用解释和最近更新时间。只有 EOS 所有者事件提供对应的有效 `correlation_id`，才可预填日志筛选；否则打开无筛选的当前运行日志。不能假设命令 ID 就是日志关联 ID，也不能用 Graph 连线动画当作运动释放证明。

## 与当前工作台集成

现有 `EosWorkbench` 每五秒刷新 IsOS 状态，可显示修订警告；后续读取必须在每次请求前获取新状态，缓存的 React 状态不足以判定。通用 `eosRequest` 目前对非 2xx 响应抛出未分类消息，所以新的类型化客户端应明确分类安全错误，同时维持相同的已验证地址、CORS 模式及无凭证策略。桥接失败时保留命令卡并标记不可用；后台刷新不能用 `setResult('')` 清除它。六种状态均以文本及适当的 `role=status` 或 `role=alert` 呈现，中英文文案同步。`Failed`、`Rejected`、`OutcomeUnknown`、旧 ID 不透明错误及桥接离线要区分显示；不能只靠颜色。R07 卡旁放置由 `controlProcesses('stop')` 支持的 IsOS Stop 操作，独立于 EOS 桥接、`active`、图可编辑性和结果轮询状态。显示 IsOS 返回的停止状态；R06 拥有物理停止回执。完整活动绑定列表、丰富的类型化参数表单、信息卡和浮动面板布局仍属 U04/U03。

## 审查与验证门槛

[夹具矩阵](../../tests/fixtures/browser_results/cases.json)固定类型化发送、结果读取、所有者结果、运行／修订、离线、日志入口与 Stop 转换。实现测试须用模拟 EOS 桥接和 IsOS 状态服务验证精确公开请求体、无授权、唯一活动绑定与目标、载荷字节长度、安全单调期限、六种状态、运行变更后的迟到响应、首次发送超时但不重发运动、一次仅一个读取、隐藏页暂停、六十秒上限、`unknown command ID` 不透明、桥接 502/503、修订过期、损坏结果及 IsOS Stop 可用性。浏览器组件测试须证明 EOS 离线且活动修订不符时 Stop 仍可用。本地与托管构建均须通过 `npm test` 和 `npm run build`。跨所有者首次使用重放须使用受管理的模拟适配器 IsOS 保存／活动运行、EOS 桥接、真实 `primitive_typed` 响应及 `InProgress` 后续查询，随后 Stop 并查看当前运行日志。真实 MuJoCo 运动仍由 R06 把关。R07 与 U04 须待各自证据及独立实现审查后才能关闭。

此修订设计运行 `python3 tests/fixtures/browser_results/check.py`，46 个唯一发送／读取／状态用例与六种状态均通过；相对链接检查覆盖十二个修改的中英文设计及夹具页面；`git diff --check` 也通过。完整输出位于被 Git 忽略的 `logs/test/20261102-r07-isosui-design-revision/`。实现前仍需独立设计审查。
