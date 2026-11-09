/**
 * README 的技能清单与计数由脚本生成（FR-C6：**禁手改数字**）。
 *
 *   node scripts/build-readme.mjs          # 写回 README.md
 *   node scripts/build-readme.mjs --check  # 只校验，CI 用
 *
 * 为什么不让人手写：同一份语料同时对外报 1513 和 1524 那次事故，根因就是
 * 「数字在好几个地方各写一遍」。清单与计数只能有一个来源——`skills/` 目录本身。
 *
 * 同时生成 `catalog.json`：法脉应用内的技能目录（FR-C5）直接读它，
 * 「目录里有什么」与「仓里有什么」因此永远是一回事。
 */
import fs from "node:fs";
import path from "node:path";
import { listSkillFiles } from "./validate.mjs";

const START = "<!-- SKILLS:START -->";
const END = "<!-- SKILLS:END -->";

const KIND_LABELS = {
  calculator: "计算器",
  playbook: "审查清单",
  template: "文书模板",
  prompt: "提示词",
  routine: "定时任务",
};

function loadSkills() {
  return listSkillFiles()
    .map((file) => JSON.parse(fs.readFileSync(file, "utf-8")))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function renderTable(skills) {
  const byKind = new Map();
  for (const skill of skills) {
    byKind.set(skill.kind, (byKind.get(skill.kind) ?? 0) + 1);
  }
  const counts = [...byKind.entries()]
    .map(([kind, count]) => `${KIND_LABELS[kind] ?? kind} ${count} 个`)
    .join("、");
  const rows = skills.map(
    (skill) =>
      `| [\`${skill.id}\`](skills/${skill.id}/skill.json) | ${skill.name} | ${
        KIND_LABELS[skill.kind] ?? skill.kind
      } | ${skill.scene.join("、")} | ${skill.version} | ${skill.author} |`,
  );
  return [
    START,
    "",
    `当前共 **${skills.length}** 个技能（${counts}）。本节与下表由 \`node scripts/build-readme.mjs\` 生成，**不要手改数字**。`,
    "",
    "| id | 名称 | 类型 | 适用场景 | 版本 | 作者 |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    END,
  ].join("\n");
}

function buildCatalog(skills) {
  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    skills: skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      kind: skill.kind,
      summary: skill.summary,
      version: skill.version,
      author: skill.author,
      scene: skill.scene,
      path: `skills/${skill.id}/skill.json`,
    })),
  };
}

function main() {
  const skills = loadSkills();
  if (!skills.length) {
    console.error("skills/ 下一个技能都没有，不生成空清单。");
    process.exit(1);
  }
  const readmePath = path.join(process.cwd(), "README.md");
  const readme = fs.readFileSync(readmePath, "utf-8");
  const startAt = readme.indexOf(START);
  const endAt = readme.indexOf(END);
  if (startAt < 0 || endAt < 0) {
    console.error(`README.md 里找不到 ${START} / ${END} 标记。`);
    process.exit(1);
  }
  const next = readme.slice(0, startAt) + renderTable(skills) + readme.slice(endAt + END.length);
  const catalog = `${JSON.stringify(buildCatalog(skills), null, 2)}\n`;
  const catalogPath = path.join(process.cwd(), "catalog.json");

  if (process.argv.includes("--check")) {
    const catalogSame = fs.existsSync(catalogPath) && fs.readFileSync(catalogPath, "utf-8") === catalog;
    if (next !== readme || !catalogSame) {
      console.error("README.md 或 catalog.json 与 skills/ 对不上：跑一次 node scripts/build-readme.mjs 再提交。");
      process.exit(1);
    }
    console.log(`✓ README 与 catalog 与 skills/ 一致（${skills.length} 个）`);
    return;
  }

  fs.writeFileSync(readmePath, next);
  fs.writeFileSync(catalogPath, catalog);
  console.log(`已更新 README.md 与 catalog.json（${skills.length} 个技能）`);
}

main();
