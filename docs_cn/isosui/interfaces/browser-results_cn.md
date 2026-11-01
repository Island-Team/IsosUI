# 浏览器原语结果客户端——R07 UI 契约

[English](../../../docs/isosui/interfaces/browser-results.md) · [设计](../design-browser-results_cn.md) · [首次使用](../usage_cn.md) · EOS 所有者契约：`Island-eos/docs_cn/eos/interfaces/control_cn.md` 中的 R07 章节

**目标 UI 契约；本设计提交尚未实现 IsosUI R07 客户端。** IsOS 拥有保存图、活动修订、部署运行身份和 Stop。EOS 拥有活动绑定、准入、日志结果和实时状态。IsosUI 可以显示浏览器本地发送状态，但只有与命令关联的 EOS `DispatchResult` 能确定结果。图连线只声明一个绑定目标，不执行浏览器命令。MuJoCo 运动控件必须等 R06 物理停止验证后才能开放。

## 类型化边界

`src/services/eos/` 客户端只通过本地或托管构建配置的已验证回环地址调用 `POST http://127.0.0.1:16020/api/eos/v2/control`。请求使用 JSON、`credentials: omit`、无 Authorization 标头和现有四秒客户端超时。浏览器不发送 `authority_grant`、私有 `primitive_result`、原始 Dispatcher 操作或结果查询中的硬件目标。桥接层校验 Host 与允许的 Origin，并自行添加运行范围内的操作员授权。浏览器 `op: "result"` 只读，桥接层改写为私有操作。U04 活动绑定计划仅用现有 `primitive_typed` 发送运动。

| 客户端字段 | JSON 类型／单位 | 用途、默认值与校验 |
| --- | --- | --- |
| `op` | 固定值 `result`／— | 必填且严格匹配；无默认值。 |
| `command_id` | 字符串／命令身份 | 必须与提交的 `primitive_typed` 命令头及 EOS 首次响应关联，UTF-8 长度为 1–128 字节；无默认值。 |
| `active_revision` | 字符串／保存图 SHA-256 | 必填 64 位小写十六进制，取自当前 IsOS 活动修订；每次读取时须与保存图修订相等；无默认值。 |
| `result.command_id` | 字符串／命令身份 | 必须等于本地跟踪的命令 ID；不符属于协议错误，不是命令结果。 |
| `result.status` | 枚举／— | 必须严格为 `Completed`、`Failed`、`Cancelled`、`Rejected`、`InProgress` 或 `OutcomeUnknown`；未知状态属于协议错误。 |
| `result.reason` | 字符串或 null／UTF-8 文本 | EOS 报告的解释，最多 512 UTF-8 字节；只当文本显示，不渲染 HTML，也不用于控制决策。 |

```json
{"op":"result","command_id":"move-1","active_revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
```

服务层在 fetch 前校验请求，只接受 `{"ok":true,"result":{"command_id":...,"status":...,"reason":...}}`，且 ID 相符、字段有界。EOS 将整个成功响应限制为 4 KiB。成功响应损坏、未知状态、ID 不符或响应过大均显示为协议错误，绝不能显示为 `Completed`。所有者固定错误仍是错误：请求无效（`400 invalid result request`）、Origin 或 Host 无效（`403`）、操作员授权不可用（`503 operator control unavailable`）、私有授权拒绝（`operator control grant required`）、修订过期（`stale active revision`）、其他运行／角色／入口／类型或不存在 ID 的统一不透明错误（`unknown command ID`）、有界结果不可用（`result unavailable`）以及 IPC 离线（`502 runtime unavailable`）。UI 不能根据 `unknown command ID` 猜测隐藏原因。

## 运行与修订围栏

首次类型化发送之前，读取 IsOS 图和 `process-status`，要求：图支持编辑、无未保存草稿、`state:running`、已知当前 `run_id`、64 位十六进制保存修订与图文档修订及活动修订相同、活动绑定严格且只有一个兼容目标、EOS 就绪且目标健康。每次结果读取前重新获取 IsOS 进程状态，要求已知运行 ID 和活动修订与发送时记录相同、`state:running`，且保存修订不变；绑定或健康变化不抹除已准入的命令。IsOS 无法证明运行身份、状态不可用、新运行或新活动修订出现时，停止自动读取，把旧命令标记为**本运行无法获取结果**。保留最后一个所有者状态和命令 ID 供排查，但不带入新运行，也不改成 `Completed`。草稿修改或图只读变化禁止新发送，不能为已有命令造出终态。

命令记录键为 `(run_id, active_revision, binding_path, command_id)`：`run_id` 是 IsOS 当前部署运行精确 ID，`active_revision` 是 64 位十六进制摘要，`binding_path` 是活动图节点路径，`command_id` 每次调用只生成一次。只有当前选中的记录能更新其可见状态。页面卸载、绑定选择变化、运行／修订变化或 Stop 时取消未完成的浏览器读取，并用代际标记忽略迟到响应。旧代响应不能覆盖新命令。不能在浏览器存储中把命令 ID 或结果保存为权威；当前运行日志使用 IsOS 自己的游标和关联 ID。

## 可见状态与 Stop

`sending` 只是浏览器本地状态，不触发成功脉冲。EOS 响应 ID 匹配后改为精确所有者状态。`InProgress` 不是终态；`Completed`、`Failed`、`Cancelled`、`Rejected`、`OutcomeUnknown` 是显示终态。`Failed` 显示明确失败标签和原因。`OutcomeUnknown` 显示明确不确定标签，绝不触发运动命令重试。发送超时或桥接断开且没有关联响应时显示**提交结果不可用**，保留生成的 ID 供排查；状态／修订／运行恢复后只能进行受保护的读取，不能重发命令。后续读取遇到不透明 ID 或离线时显示**结果不可用**，保留上次已知的 `InProgress`，不改成终态。

结果读取每条命令最多一个进行中请求，一秒后开始；连续读取错误退避，上限十秒；自动轮询满六十秒或十二次（先到者）即停止。文档隐藏时暂停，恢复时先复查 IsOS 运行与修订；手动刷新也执行相同检查。UI 显示已暂停的 `InProgress` 记录和刷新操作，不能暗示完成。切换页面和 Stop 会中止读取。这些限制只适用于只读结果查询，绝不用于再次提交运动。

部署 **Stop** 即使 EOS 离线、图只读、活动修订不符、结果未知或客户端暂停，也要通过 IsOS `/api/isos/v1/process-control` 保持可见可用。点击 Stop 只是待处理意图，直到 IsOS 报告其受治理的终态或未知结果；UI 不能把命令 `Cancelled` 等同物理停止。EOS 面板必须提供到 IsOS Stop 的路径；U03/U04 将安置持续可见的控件。此 R07 部分定义客户端及状态边界，不包含完整 U04 原语表单或图信息卡。
