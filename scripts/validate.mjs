/**
 * 技能包校验器（开源仓 CI 用）。
 *
 *   node scripts/validate.mjs
 *
 * **为什么这里是一份独立的实现**：这个仓是给外部贡献者用的，他们不会装法脉的
 * TypeScript 工具链。所以校验器只用 Node 内置模块，`git clone` 完就能跑。
 *
 * **它和法脉应用里的校验器怎么保持一致**：靠测试而不是靠复制。法脉主仓的
 * `tests/skills-repo.test.ts` 会拿这个脚本去跑本仓全部技能、再跑一组已知的坏样本，
 * 两边判定不一致就红。手工同步两份规则是迟早分叉的写法。
 *
 * 校验的是**安全边界**，不只是格式：
 * - 下载/导入来源的技能**不许用内置公式**（那是绕过白名单解释器的后门）；
 * - 公式里的变量必须先声明（拼错一个名字不能静默当 0）；
 * - 必须带法规出处（没有出处的「算法」在法庭上没有价值）。
 */
import fs from "node:fs";
import path from "node:path";

const SKILLS_DIR = path.join(process.cwd(), "skills");
const SCHEMA_VERSION = 1;
const KINDS = ["calculator", "playbook", "template", "prompt", "routine"];
const ID_PATTERN = /^[a-z][a-z0-9-]{2,47}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const LAW_REF_PATTERN = /^.+-\d{1,4}$/;

/** 白名单节点。新增一种就是给解释器开一个口子，必须显式加在这里。 */
const EXPR_OPS = new Set([
  "num",
  "var",
  "add",
  "sub",
  "mul",
  "div",
  "min",
  "max",
  "round",
  "ceil",
  "floor",
  "abs",
  "if",
  "bracket",
  "table",
]);

function collectVars(node, into = new Set()) {
  if (!node || typeof node !== "object") {
    return into;
  }
  switch (node.op) {
    case "var":
      into.add(node.name);
      break;
    case "add":
    case "sub":
    case "mul":
    case "div":
      collectVars(node.left, into);
      collectVars(node.right, into);
      break;
    case "min":
    case "max":
      (node.args ?? []).forEach((arg) => collectVars(arg, into));
      break;
    case "round":
    case "ceil":
    case "floor":
    case "abs":
      collectVars(node.arg, into);
      break;
    case "if":
      collectCondVars(node.cond, into);
      collectVars(node.then, into);
      collectVars(node.else, into);
      break;
    case "bracket":
      collectVars(node.value, into);
      break;
    case "table":
      collectVars(node.key, into);
      break;
    default:
      break;
  }
  return into;
}

function collectCondVars(cond, into) {
  if (!cond || typeof cond !== "object") {
    return;
  }
  if ("match" in cond) {
    into.add(cond.match?.name);
    return;
  }
  if ("logic" in cond) {
    if (cond.logic === "not") {
      collectCondVars(cond.item, into);
      return;
    }
    (cond.items ?? []).forEach((item) => collectCondVars(item, into));
    return;
  }
  collectVars(cond.left, into);
  collectVars(cond.right, into);
}

/** 递归查有没有白名单之外的节点。 */
function findBadOps(node, bad = []) {
  if (!node || typeof node !== "object") {
    return bad;
  }
  if (typeof node.op === "string" && !EXPR_OPS.has(node.op)) {
    bad.push(node.op);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach((item) => findBadOps(item, bad));
    } else if (value && typeof value === "object") {
      findBadOps(value, bad);
    }
  }
  return bad;
}

export function validateSkill(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return ["不是一个 JSON 对象"];
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion 必须是 ${SCHEMA_VERSION}`);
  }
  if (typeof raw.id !== "string" || !ID_PATTERN.test(raw.id)) {
    errors.push("id 只能用小写字母、数字与连字符，3–48 字符，且以字母开头");
  }
  for (const field of ["name", "summary", "version", "author", "license"]) {
    if (typeof raw[field] !== "string" || !raw[field].trim()) {
      errors.push(`缺少必填字段 ${field}`);
    }
  }
  if (typeof raw.version === "string" && raw.version && !VERSION_PATTERN.test(raw.version)) {
    errors.push("version 必须是 x.y.z 形式");
  }
  if (!KINDS.includes(raw.kind)) {
    errors.push(`kind 只能是 ${KINDS.join(" / ")}`);
  }
  if (!Array.isArray(raw.scene) || raw.scene.some((item) => typeof item !== "string")) {
    errors.push("scene 必须是字符串数组");
  }
  if (!Array.isArray(raw.lawRefs) || raw.lawRefs.length === 0) {
    errors.push("lawRefs 不能为空：没有法规出处的算法在法庭上没有价值");
  } else {
    for (const ref of raw.lawRefs) {
      if (typeof ref !== "string" || !LAW_REF_PATTERN.test(ref)) {
        errors.push(`法规出处「${ref}」格式不对：应形如 诉讼费用交纳办法-0013`);
      }
    }
  }
  if (!raw.body || typeof raw.body !== "object") {
    errors.push("缺少 body");
    return errors;
  }

  if (raw.kind === "calculator") {
    const inputs = Array.isArray(raw.body.inputs) ? raw.body.inputs : [];
    const outputs = Array.isArray(raw.body.outputs) ? raw.body.outputs : [];
    if (!inputs.length) {
      errors.push("计算器必须声明至少一个输入项");
    }
    if (!outputs.length) {
      errors.push("计算器必须声明至少一个输出项");
    }
    const declared = new Set();
    for (const field of inputs) {
      if (!field || typeof field.name !== "string" || !field.name) {
        errors.push("输入项缺少 name");
        continue;
      }
      declared.add(field.name);
      if (field.type === "enum" && !(Array.isArray(field.options) && field.options.length)) {
        errors.push(`输入项 ${field.name} 是枚举，必须给出 options`);
      }
    }
    const checkFormula = (formula, where) => {
      if (!formula || typeof formula !== "object") {
        errors.push(`${where} 缺少 formula`);
        return;
      }
      if (formula.kind === "builtin") {
        // 这个仓里的技能一律是「下载来源」，内置公式只给随应用分发的那些。
        errors.push(`${where} 用了内置公式（builtin）：社区技能只能用表达式`);
        return;
      }
      if (formula.kind !== "expr" || !formula.ast) {
        errors.push(`${where} 的 formula.kind 只能是 expr`);
        return;
      }
      const bad = findBadOps(formula.ast);
      if (bad.length) {
        errors.push(`${where} 用了不允许的节点：${[...new Set(bad)].join("、")}`);
      }
      const missing = [...collectVars(formula.ast)].filter((name) => !declared.has(name));
      if (missing.length) {
        errors.push(`${where} 用到了未声明的变量：${missing.join("、")}`);
      }
    };
    for (const entry of raw.body.lets ?? []) {
      if (!entry || typeof entry.name !== "string") {
        errors.push("中间量缺少 name");
        continue;
      }
      checkFormula(entry.formula, `中间量 ${entry.name}`);
      declared.add(entry.name);
    }
    for (const output of outputs) {
      if (!output || typeof output.name !== "string" || typeof output.label !== "string") {
        errors.push("输出项缺少 name 或 label");
        continue;
      }
      if (typeof output.explain !== "string" || !output.explain.trim()) {
        errors.push(`输出项 ${output.name} 缺少 explain：算出一个数却不说怎么算的，没法核对`);
      }
      checkFormula(output.formula, `输出项 ${output.name}`);
    }
  }

  if (raw.kind === "playbook") {
    const items = Array.isArray(raw.body.items) ? raw.body.items : [];
    if (!items.length) {
      errors.push("审查清单必须至少有一条检查项");
    }
    for (const item of items) {
      if (!item || typeof item.title !== "string" || !item.title.trim()) {
        errors.push("检查项缺少标题");
      }
    }
  }

  return errors;
}

export function listSkillFiles(dir = SKILLS_DIR) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name, "skill.json"))
    .filter((file) => fs.existsSync(file));
}

function main() {
  const files = listSkillFiles();
  if (!files.length) {
    // 空结果即报错：目录空着和校验通过是两回事。
    console.error("skills/ 下一个技能都没有：确认目录结构是 skills/<id>/skill.json");
    process.exit(1);
  }
  let failed = 0;
  const seen = new Set();
  for (const file of files) {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (error) {
      console.error(`✗ ${file}：不是合法 JSON（${error.message}）`);
      failed += 1;
      continue;
    }
    const errors = validateSkill(raw);
    // 目录名必须等于 id，否则目录索引与安装路径会对不上。
    const dirName = path.basename(path.dirname(file));
    if (raw.id !== dirName) {
      errors.push(`目录名「${dirName}」与 id「${raw.id}」不一致`);
    }
    if (seen.has(raw.id)) {
      errors.push(`id 重复：${raw.id}`);
    }
    seen.add(raw.id);
    if (errors.length) {
      failed += 1;
      console.error(`✗ ${dirName}`);
      for (const error of errors) {
        console.error(`    ${error}`);
      }
    } else {
      console.log(`✓ ${dirName}（${raw.kind}）`);
    }
  }
  console.log(`\n共 ${files.length} 个技能，${failed} 个有问题。`);
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
