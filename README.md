# PaaS-Prototype

CloudForge 云边协同发布闭环原型，采用单文件 HTML 实现。

## 使用

直接在浏览器中打开：

`CloudForge_PaaS_云边协同发布闭环增强版.html`

## 测试

```powershell
node --test tests/release-domain.test.mjs tests/browser-smoke.test.mjs
```

测试包含发布状态机、版本对账、流量基线恢复、边缘重连自治、结构化审计，以及 Chrome 无头浏览器端到端冒烟验证。
