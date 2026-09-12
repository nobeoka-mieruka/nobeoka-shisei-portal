#!/usr/bin/env node
/**
 * Phase253：GitHub Actionsワークフローの「ブランチを増やさない」運用ルールを回帰テストする。
 *
 * 【背景（実ログで確認した事実）】
 * auto-update-dryrun.yml は差分検出時に「ブランチ作成 → commit → push → gh pr create」を
 * 行っていたが、リポジトリ設定でActionsによるPR作成が許可されていないため
 *   GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)
 * で必ず失敗し、pushだけが成功して誰も読まないブランチが毎日1本ずつ増えていた。
 * 設定はワークフローからは変更できないため、「設定が無効でもブランチが増えない」ことを
 * ワークフロー側の性質として固定し、ここで回帰テストする。
 *
 * 【このテストが守るルール】
 *  1. dry-runワークフローは、既定でブランチもcommitも作らない（明示的なopt-in時のみ作る）。
 *  2. ブランチを作るステップは、PR作成に失敗したときに自分が作ったブランチを後始末する。
 *     その削除は「リモートのHEADが、たった今pushしたSHAと一致する」場合に限る。
 *  3. どのワークフローも --force / -f でのpush、リモートブランチの一括削除を行わない。
 *  4. dry-runワークフローは main へ直接pushしない。
 *  5. 差分の有無にかかわらず、結果がジョブ要約とArtifactに残る（ブランチを読む必要がない）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW_DIR = ".github/workflows";
const DRYRUN_WORKFLOW = "auto-update-dryrun.yml";
const OPT_IN_EXPRESSION = "vars.BOT_PULL_REQUESTS_ENABLED == 'true'";

let checks = 0;
let failures = 0;
function ok(label, condition) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  [FAIL] ${label}`);
  }
}

/**
 * ワークフローYAMLを「ステップ単位」に粗く分解する。
 * YAMLパーサを新たに依存に追加しないため、`      - name:` の行を区切りとして扱う
 * （このリポジトリのワークフローはすべてこのインデントで書かれている）。
 */
function splitSteps(text) {
  const lines = text.split(/\r?\n/);
  const steps = [];
  let current = null;
  for (const line of lines) {
    if (/^ {6}- name:/.test(line)) {
      if (current) steps.push(current);
      current = { name: line.replace(/^ {6}- name:\s*/, "").trim(), lines: [line] };
    } else if (current) {
      // 次のジョブ/トップレベルキーに入ったらステップの並びは終わり。
      if (/^ {0,4}\S/.test(line) && line.trim() !== "") {
        steps.push(current);
        current = null;
      } else {
        current.lines.push(line);
      }
    }
  }
  if (current) steps.push(current);
  return steps.map((s) => ({ ...s, body: s.lines.join("\n") }));
}

console.log("[test-workflow-branch-policy] 開始");

const workflowFiles = readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
ok("ワークフローファイルが見つかる", workflowFiles.length > 0);

/* --- ルール3：全ワークフロー共通の禁止事項 --- */
for (const file of workflowFiles) {
  const text = readFileSync(join(WORKFLOW_DIR, file), "utf8");
  ok(`${file}: git push に --force を使っていない`, !/git push[^\n]*--force/.test(text));
  ok(`${file}: git push に -f を使っていない`, !/git push[^\n]*\s-f(\s|$)/.test(text));
  ok(
    `${file}: リモートブランチを一括削除していない`,
    !/ls-remote[\s\S]{0,200}?(xargs|while read)[\s\S]{0,200}?--delete/.test(text),
  );
  ok(`${file}: ブランチ削除は --delete のみ（refspec形式の :branch を使わない）`, !/git push\s+origin\s+:/.test(text));
}

/* --- ルール1（全ワークフロー共通）：ブランチを作る経路はすべてopt-in変数で保護されている --- */
for (const file of workflowFiles) {
  const text = readFileSync(join(WORKFLOW_DIR, file), "utf8");
  for (const step of splitSteps(text)) {
    const createsBranch = /git checkout -b|git push origin "\$BRANCH"/.test(step.body);
    if (!createsBranch) continue;
    ok(`${file}: ブランチ作成ステップ「${step.name}」がopt-in変数で保護されている`, step.body.includes(OPT_IN_EXPRESSION));
  }
  if (/git checkout -b/.test(text)) {
    // ブランチを作らない場合でも検出結果が失われないこと。
    // 書き方は2通りある：(a) PR無効時だけ動く通知ステップ、(b) PR設定に関係なく常にジョブ要約へ出す。
    const hasDisabledPathNotice = /BOT_PULL_REQUESTS_ENABLED != 'true'[\s\S]{0,1200}?GITHUB_STEP_SUMMARY/.test(text);
    const hasUnconditionalSummary = splitSteps(text).some(
      (s) => /GITHUB_STEP_SUMMARY/.test(s.body) && !s.body.includes(OPT_IN_EXPRESSION),
    );
    ok(`${file}: ブランチを作らない場合でも検出結果がジョブ要約に残る`, hasDisabledPathNotice || hasUnconditionalSummary);
  }
}

/* --- dry-runワークフロー個別 --- */
const dryrunPath = join(WORKFLOW_DIR, DRYRUN_WORKFLOW);
const dryrunText = readFileSync(dryrunPath, "utf8");
const dryrunSteps = splitSteps(dryrunText);
ok(`${DRYRUN_WORKFLOW}: ステップを分解できる`, dryrunSteps.length > 5);

/* ルール4：mainへ直接pushしない */
ok(
  `${DRYRUN_WORKFLOW}: main へ直接pushしない`,
  !/git push\s+origin\s+HEAD:main/.test(dryrunText) && !/git push\s+origin\s+main/.test(dryrunText),
);

/* ルール1：ブランチを作る・pushするステップは必ずopt-inで保護されている */
const branchCreatingSteps = dryrunSteps.filter((s) => /git checkout -b|git push origin "\$BRANCH"/.test(s.body));
ok(`${DRYRUN_WORKFLOW}: ブランチを作るステップは1つだけ`, branchCreatingSteps.length === 1);
for (const step of branchCreatingSteps) {
  ok(
    `${DRYRUN_WORKFLOW}: ブランチ作成ステップ「${step.name}」がopt-in変数で保護されている`,
    step.body.includes(OPT_IN_EXPRESSION),
  );
  /* ルール2：PR作成に失敗したら、自分がpushしたブランチをSHA一致確認のうえ削除する */
  ok(
    `${DRYRUN_WORKFLOW}: PR作成失敗時にpushしたSHAを記録している`,
    /PUSHED_SHA=/.test(step.body) && /REMOTE_SHA=/.test(step.body),
  );
  ok(
    `${DRYRUN_WORKFLOW}: リモートSHAが一致する場合だけブランチを削除する`,
    /if\s+\[\s+"\$REMOTE_SHA"\s+=\s+"\$PUSHED_SHA"\s+\][\s\S]{0,200}?git push origin --delete/.test(step.body),
  );
  ok(
    `${DRYRUN_WORKFLOW}: SHAが一致しない場合は削除せず警告する`,
    /else[\s\S]{0,300}?::warning::[\s\S]{0,200}?削除しませんでした/.test(step.body),
  );
}

/* opt-in変数が未設定なら、ブランチを作る経路が存在しないこと */
const unguardedBranchSteps = dryrunSteps.filter(
  (s) => /git checkout -b|git push origin "\$BRANCH"/.test(s.body) && !s.body.includes(OPT_IN_EXPRESSION),
);
ok(`${DRYRUN_WORKFLOW}: opt-inで保護されていないブランチ作成が存在しない`, unguardedBranchSteps.length === 0);

/* ルール5：差分の有無にかかわらず結果が残る */
ok(
  `${DRYRUN_WORKFLOW}: 差分ありの結果をジョブ要約へ出す`,
  dryrunSteps.some((s) => /steps\.diff\.outputs\.changed == 'true'/.test(s.body) && /GITHUB_STEP_SUMMARY/.test(s.body)),
);
ok(
  `${DRYRUN_WORKFLOW}: 差分なしの場合もジョブ要約へ記録する`,
  dryrunSteps.some((s) => /steps\.diff\.outputs\.changed != 'true'/.test(s.body) && /GITHUB_STEP_SUMMARY/.test(s.body)),
);
ok(
  `${DRYRUN_WORKFLOW}: レポートを常にArtifactとして保存する（if: always()）`,
  dryrunSteps.some((s) => /upload-artifact/.test(s.body) && /if:\s*always\(\)/.test(s.body)),
);

/* 会議録公開監視（Phase252）が日次ワークフローへ組み込まれていること */
const dailyText = readFileSync(join(WORKFLOW_DIR, "update-council-documents.yml"), "utf8");
ok(
  "update-council-documents.yml: 会議録公開監視を実行している",
  dailyText.includes("scripts/check-question-transcript-publication.mjs"),
);
ok(
  "update-council-documents.yml: 監視が失敗してもワークフローを止めない",
  /check-question-transcript-publication\.mjs[\s\S]{0,200}?continue-on-error:\s*true/.test(dailyText),
);

console.log(`[test-workflow-branch-policy] ${checks} checks, ${failures} failures`);
if (failures > 0) process.exit(1);
