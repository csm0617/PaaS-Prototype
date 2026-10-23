# PaaS-Prototype

CloudForge 云边协同发布闭环原型，采用单文件 HTML 实现，包含统一终端登录、会话审批和命令审计。

## 使用

直接在浏览器中打开：

`CloudForge_PaaS_云边协同发布闭环增强版.html`

## 测试

```powershell
node --test tests/release-domain.test.mjs tests/browser-smoke.test.mjs tests/terminal-domain.test.mjs tests/terminal-browser.test.mjs tests/gateway-workbench.test.mjs tests/cloud-edge-workbench.test.mjs tests/sidebar-navigation.test.mjs tests/core-layout.test.mjs
```

测试包含发布状态机、版本对账、流量基线恢复、边缘重连自治、结构化审计、Pod/边缘节点/云主机终端权限、危险命令阻断、网关主从工作台、云边节点工作台、可展开侧边导航、核心资源页统一布局，以及 Chrome 无头浏览器端到端冒烟验证。
