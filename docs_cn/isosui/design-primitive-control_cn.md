# U04 实现设计与证据

[English](../../docs/isosui/design-primitive-control.md) · [所有者接口](interfaces/primitive-control_cn.md)

R07 结果客户端继续作为唯一浏览器命令路径。U04 将单个模拟底盘卡扩展为每个精确活动 `@v0.1` 底盘／机械臂绑定各一张卡。纯绑定解析器在呈现前验证唯一目标和声明的模式。组件在 EOS 时间读取与提交前后重新检查 IsOS 图／运行身份，并沿用现有的关联结果状态机。`Failed` 是所有者终态结果，浏览器传输丢失则显示不可用。Stop 独立调用 IsOS，并在等待响应前对当前运行的所有卡片设置围栏。不会暴露旧版图定义技能序列。

图节点在 portal 中呈现信息卡，使其浮于重叠 React Flow 节点之上。悬停、聚焦和触摸信息按钮打开卡片；Escape 和关闭按钮退出。卡片非模态，打开与视口尺寸变化时限制位置；所有者读取不可用时不声称实时健康。端口单位来自节点目录数据模式。portal 中的信息控件使用 `nodrag` 与 `nowheel`。可见的已打开卡片每两秒读取 EOS，失败或超过五秒的样本标为过期。

验证：`npm ci --no-audit --no-fund`；`npm test`（143 个测试通过，包括精确底盘／机械臂绑定、歧义、过期运行、结果跟进、Stop 失败及视口限制）；`npm run typecheck`；`npm run build`；`git diff --check`。完整日志位于本地 `logs/test/20261102-u04-primitive-control/`。使用受支持的 Node 22.23.4／npm 10.9.9。浏览器视觉检查与 M5 洁净主目录重放仍属独立验收门槛。
