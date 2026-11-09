# 法脉技能库

[法脉](https://lttxzmj.github.io/lawpulse-site/)（面向中国执业律师的本地优先桌面法律研究工具）的开源技能仓。

技能是**材料，不是指令**：装一个技能不授予它任何权限。它不能联网、不能读你的文件、
也不能执行代码。计算器的公式走白名单解释器，只认加减乘除、分段累计、查表、条件判断
这几种节点——所以你可以放心装一个陌生人写的诉讼费计算器。

## 技能清单

<!-- SKILLS:START -->

当前共 **15** 个技能（计算器 11 个、审查清单 4 个）。本节与下表由 `node scripts/build-readme.mjs` 生成，**不要手改数字**。

| id | 名称 | 类型 | 适用场景 | 版本 | 作者 |
|---|---|---|---|---|---|
| [`calc-child-support`](skills/calc-child-support/skill.json) | 抚养费计算 | 计算器 | 婚姻家庭 | 1.0.0 | official |
| [`calc-court-fee`](skills/calc-court-fee/skill.json) | 诉讼费计算 | 计算器 | 民商事、婚姻家庭、劳动 | 1.0.0 | official |
| [`calc-delay-interest`](skills/calc-delay-interest/skill.json) | 迟延履行加倍利息 | 计算器 | 执行 | 1.0.0 | official |
| [`calc-execution-fee`](skills/calc-execution-fee/skill.json) | 执行申请费计算 | 计算器 | 执行 | 1.0.0 | official |
| [`calc-lawyer-fee`](skills/calc-lawyer-fee/skill.json) | 律师费（风险代理与计时） | 计算器 | 民商事、执业 | 1.0.0 | official |
| [`calc-lpr-interest`](skills/calc-lpr-interest/skill.json) | LPR 利息计算 | 计算器 | 民商事 | 1.0.0 | official |
| [`calc-penalty-adjust`](skills/calc-penalty-adjust/skill.json) | 违约金调整参考 | 计算器 | 民商事 | 1.0.0 | official |
| [`calc-personal-injury`](skills/calc-personal-injury/skill.json) | 人身损害赔偿计算 | 计算器 | 侵权、交通事故 | 1.0.0 | official |
| [`calc-preservation-fee`](skills/calc-preservation-fee/skill.json) | 保全费计算 | 计算器 | 民商事 | 1.0.0 | official |
| [`calc-private-lending-cap`](skills/calc-private-lending-cap/skill.json) | 民间借贷利率上限 | 计算器 | 民商事 | 1.0.0 | official |
| [`calc-work-injury`](skills/calc-work-injury/skill.json) | 工伤赔偿计算 | 计算器 | 劳动 | 1.0.0 | official |
| [`review-playbook-generic`](skills/review-playbook-generic/skill.json) | 通用合同审查清单 | 审查清单 | 民商事 | 1.0.0 | official |
| [`review-playbook-labor`](skills/review-playbook-labor/skill.json) | 劳动合同审查清单 | 审查清单 | 劳动 | 1.0.0 | official |
| [`review-playbook-lease`](skills/review-playbook-lease/skill.json) | 房屋租赁合同审查清单 | 审查清单 | 民商事、房地产 | 1.0.0 | official |
| [`review-playbook-sales`](skills/review-playbook-sales/skill.json) | 买卖合同审查清单 | 审查清单 | 民商事 | 1.0.0 | official |

<!-- SKILLS:END -->

## 怎么用

**在法脉里装**：技能页 →「导入技能」→ 选中某个 `skills/<id>/skill.json`。
应用内技能目录也会收录本仓的技能，更新不用等发版。

**本地校验**：

```bash
node scripts/validate.mjs        # 校验全部技能
node scripts/build-readme.mjs    # 重算 README 清单与 catalog.json
```

只用 Node 内置模块，`git clone` 完就能跑，不需要装任何依赖。

## 怎么写一个技能

一个技能就是一个 `skills/<id>/skill.json`。目录名必须等于 `id`。

```jsonc
{
  "schemaVersion": 1,
  "id": "calc-example",            // 小写字母、数字、连字符；分发文件名保持 ASCII
  "name": "示例计算",
  "kind": "calculator",            // calculator | playbook | template | prompt | routine
  "summary": "一句话说清它算什么、什么时候用。",
  "scene": ["民商事"],              // 案件夹按案由推荐时用它匹配
  "lawRefs": ["诉讼费用交纳办法-0013"],  // 法名-条号，必填
  "body": { /* 按 kind 定义，见下 */ },
  "version": "1.0.0",
  "author": "你的 GitHub 用户名",
  "license": "CC-BY-4.0"
}
```

### 计算器的 body

```jsonc
{
  "explain": "适用范围，以及**不适用**的情形。",
  "inputs": [
    { "name": "amount", "label": "诉讼请求金额", "type": "money", "unit": "元", "required": true }
  ],
  "lets": [ /* 可选，中间量，按顺序求值 */ ],
  "outputs": [
    {
      "name": "fee", "label": "案件受理费", "unit": "元",
      "formula": { "kind": "expr", "ast": { /* 表达式 */ } },
      "explain": "怎么算出来的。这一句会连同数字一起进分步明细。"
    }
  ]
}
```

可用的表达式节点：`num` `var` `add` `sub` `mul` `div` `min` `max` `round` `ceil`
`floor` `abs` `if` `bracket`（分段累计）`table`（查表）。没有函数调用、没有属性访问、
没有循环——这是故意的。

## 三条硬要求

1. **每个技能必须带法规出处**（`lawRefs` 非空，形如 `诉讼费用交纳办法-0013`）。
   没有出处的「算法」在法庭上没有价值，CI 会拒。
2. **每个输出项必须写 `explain`**。律师要拿这个数去交费、去写诉状，他必须看得见
   「50 + 9 万 ×2.5%」这一步。只给一个总数的计算器没人敢用。
3. **数字只能来自法条正文**。各省自定的幅度收费、每年变的统计数据（人均可支配收入、
   LPR、职工月平均工资）**一律做成输入项**，不要内置一个默认值冒充官方——
   编一个数字比不给这个计算器有害得多。

## 提 PR 要写什么

见 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)：法规出处、自测说明（至少 3 组
对官方算例的试算）、以及你跑过 `node scripts/validate.mjs` 的输出。

## 转正机制

社区技能满足下面两条之一，且通过人工质量复核，会在月度评审后**转正进法脉内置包**：

- 应用内 `skill_used` 周使用 ≥ 10 次；
- 应用内技能目录下载量进入 Top 5。

转正名单与评审标准在本节公示。转正后作者署名保留，许可仍按 `license` 字段。
至今转正名单：（暂无，首批评审在 0.11 发布 +30 天）

## 许可

技能文件各自按 `license` 字段；仓内脚本按 MIT。
