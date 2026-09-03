/**
 * Phase204：市政年表（/timeline・/timeline/:year）の出典継承テスト。
 *
 * 目的：
 * `/timeline` の各イベントに表示される出典（CompareSourceNotice）は、必ず元データ
 * （generalQuestions.json・archiveCouncilDocuments.json・archiveMayorTerms.json 等）が
 * 既に持っている一次資料参照を「継承」したものでなければならない。
 * このテストは次の2方向を同時に固定する。
 *
 *   1. 元データに出典がある → 年表イベントにも同じ出典が現れる（取りこぼさない）
 *   2. 元データに出典が無い → 年表イベントも出典0件＝「出典未登録」のまま（勝手に補わない）
 *
 * 2 は「出典未登録をゼロにするために、それらしいURLを後から付ける」ことを防ぐための
 * 回帰テストであり、意図的に「出典未登録が残ること」を正しい状態として固定している。
 *
 * 実行方法の都合：
 * src/lib/archiveTimeline.ts はJSON importを持たないが、拡張子なしの相対import
 * （"../config/site" 等）をNode ESM単体では解決できない。既存の scripts/test-activity-radar.mjs
 * と同じ方式で、一時ディレクトリへ依存モジュールごと複製し、相対importへ .ts を補ってから
 * 読み込む（src配下の元ファイルは書き換えない）。
 *
 * 使い方: node --experimental-strip-types scripts/test-timeline-source-inheritance.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");
const readJson = (relPath) => JSON.parse(readSrc(relPath));

// archiveTimeline.ts と、それが値としてimportする依存モジュール（いずれもJSON importを持たない）。
const MODULE_FILES = [
  "src/config/site.ts",
  "src/lib/archiveFinance.ts",
  "src/lib/archiveFinanceMetrics.ts",
  "src/lib/archiveCouncilDocuments.ts",
  "src/lib/billVotes.ts",
  "src/lib/archiveTimeline.ts",
];

const tmpDir = mkdtempSync(join(tmpdir(), "timeline-source-test-"));
for (const relPath of MODULE_FILES) {
  // Windowsのcore.autocrlf対策でLFへ正規化してから加工する（元ファイルは変更しない）。
  const source = readSrc(relPath).replace(/\r\n/g, "\n");
  const patched = source.replace(/from "(\.\.?\/[^".]*)"/g, 'from "$1.ts"');
  const dest = join(tmpDir, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, patched);
}
const timeline = await import(pathToFileURL(join(tmpDir, "src/lib/archiveTimeline.ts")));

const {
  buildMayorTermEvents,
  buildMemberTermEvents,
  buildFinanceMetricEvents,
  buildGeneralQuestionEvents,
  buildCouncilDocumentEvents,
  buildPolicyEvents,
  generalQuestionSourceRefs,
} = timeline;

const archiveMayors = readJson("src/data/archiveMayors.json");
const archiveMayorTerms = readJson("src/data/archiveMayorTerms.json");
const archiveMemberProfiles = readJson("src/data/archiveMemberProfiles.json");
const archiveMemberTerms = readJson("src/data/archiveMemberTerms.json");
const archiveFiscalYears = readJson("src/data/archiveFiscalYears.json");
const generalQuestions = readJson("src/data/generalQuestions.json");
const archiveCouncilDocuments = readJson("src/data/archiveCouncilDocuments.json");
const archivePolicies = readJson("src/data/archivePolicies.json");

// TimelinePage.tsx と同じ組み立て順・同じ入力で年表全件を再現する。
const eventsByCategory = {
  mayorTerm: buildMayorTermEvents(archiveMayors, archiveMayorTerms),
  memberTerm: buildMemberTermEvents(archiveMemberProfiles, archiveMemberTerms),
  finance: buildFinanceMetricEvents(archiveFiscalYears),
  generalQuestion: buildGeneralQuestionEvents(generalQuestions),
  councilDocument: buildCouncilDocumentEvents(archiveCouncilDocuments),
  policy: buildPolicyEvents(archivePolicies),
};
const allEvents = Object.values(eventsByCategory).flat();

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}`);
    console.error(`    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log("Phase204: 市政年表の出典継承テスト");

// ---------------------------------------------------------------------------
// 1. 実データ：元データに出典がある年表イベントは、必ず出典を持つ
// ---------------------------------------------------------------------------

test("年表イベントを1件以上生成できている（TimelinePage.tsxと同じ6カテゴリ）", () => {
  assert.equal(Object.keys(eventsByCategory).length, 6);
  // 件数はデータ追加で増えるため下限のみ固定する（Phase204時点の実測は606件）。
  assert.ok(allEvents.length >= 600, `年表イベント数が想定より少ない: ${allEvents.length}`);
});

test("一般質問イベントは generalQuestions.json と1対1で対応する", () => {
  assert.equal(eventsByCategory.generalQuestion.length, generalQuestions.length);
  const ids = new Set(eventsByCategory.generalQuestion.map((e) => e.id));
  assert.equal(ids.size, generalQuestions.length, "一般質問イベントのidが重複している");
});

test("元データに出典URLがある一般質問は、年表イベントでも出典が0件にならない", () => {
  const missing = [];
  for (const q of generalQuestions) {
    const hasSourceInData = Boolean(
      q.sourceUrl || q.noticeUrl || q.noticePdf || q.transcriptUrl || q.transcriptPdfUrl || q.newsletterUrl,
    );
    if (!hasSourceInData) continue;
    const event = eventsByCategory.generalQuestion.find((e) => e.id === `question-${q.id}`);
    assert.ok(event, `イベントが見つからない: ${q.id}`);
    if (event.sourceRefs.length === 0) missing.push(q.id);
  }
  assert.deepEqual(missing, [], `出典を継承できていない一般質問: ${missing.join(", ")}`);
});

test("一般質問イベントの出典URLは、すべて元データ由来のURLである（新規URLを生成していない）", () => {
  for (const q of generalQuestions) {
    const event = eventsByCategory.generalQuestion.find((e) => e.id === `question-${q.id}`);
    const allowed = new Set(
      [q.sourceUrl, q.noticeUrl, q.noticePdf, q.transcriptUrl, q.transcriptPdfUrl, q.newsletterUrl].filter(Boolean),
    );
    for (const ref of event.sourceRefs) {
      assert.ok(
        ref.sourceUrl && allowed.has(ref.sourceUrl),
        `${q.id}: 元データに無いURLが年表へ現れている: ${ref.sourceUrl}`,
      );
    }
  }
});

test("令和8年6月定例会・令和8年9月定例会（質問通告書ベースの予定を含む）の一般質問が出典を持つ", () => {
  const targets = generalQuestions.filter(
    (q) => q.sessionName === "令和8年6月定例会" || q.sessionName === "令和8年9月定例会",
  );
  assert.ok(targets.length > 0, "対象会期の一般質問データが見つからない");
  for (const q of targets) {
    const event = eventsByCategory.generalQuestion.find((e) => e.id === `question-${q.id}`);
    assert.ok(event.sourceRefs.length > 0, `${q.id}（${q.sessionName}）の出典が継承されていない`);
    assert.ok(
      event.sourceRefs.some((r) => r.sourceUrl === q.sourceUrl),
      `${q.id}: 主たる出典（sourceUrl）が継承されていない`,
    );
  }
});

test("議案・条例・請願・陳情イベントは元データの sourceRefs をそのまま継承する", () => {
  for (const d of archiveCouncilDocuments) {
    const event = eventsByCategory.councilDocument.find((e) => e.id === `document-${d.id}`);
    assert.ok(event, `議案イベントが見つからない: ${d.id}`);
    assert.deepEqual(event.sourceRefs, d.sourceRefs, `${d.id}: sourceRefsが元データと一致しない`);
  }
});

test("市長任期イベントは元データ（archiveMayorTerms.json）の sourceRefs をそのまま継承する", () => {
  for (const term of archiveMayorTerms) {
    const events = eventsByCategory.mayorTerm.filter((e) => e.id === `${term.id}-start` || e.id === `${term.id}-end`);
    for (const event of events) {
      assert.deepEqual(event.sourceRefs, term.sourceRefs, `${term.id}: sourceRefsが元データと一致しない`);
    }
  }
});

test("政策イベントは元データ（archivePolicies.json）の sourceRefs をそのまま継承する", () => {
  for (const event of eventsByCategory.policy) {
    const policy = archivePolicies.find((p) => event.id.startsWith(`policy-${p.id}-`));
    assert.ok(policy, `政策イベントの元データが特定できない: ${event.id}`);
    assert.deepEqual(event.sourceRefs, policy.sourceRefs, `${policy.id}: sourceRefsが元データと一致しない`);
  }
});

test("すべての年表イベントで、完全に同一の出典が二重に並ばない", () => {
  // 同じURLでも参照箇所（pageNumber）や表題が異なる場合は別々の出典として正当に並ぶ
  // （例：財政年度データの「延岡市史」歳入表と歳出表は同一コマURLでページが異なる）。
  // したがって全フィールドが一致する完全重複だけを禁止する。
  const duplicated = [];
  for (const event of allEvents) {
    const seen = new Set();
    for (const ref of event.sourceRefs) {
      const key = JSON.stringify(ref);
      if (seen.has(key)) duplicated.push(event.id);
      else seen.add(key);
    }
  }
  assert.deepEqual(duplicated, [], `完全に同一の出典が重複しているイベント: ${duplicated.join(", ")}`);
});

test("一般質問イベントでは、同じ sourceUrl が二重に並ばない（通告書URLの重複継承を防ぐ）", () => {
  const duplicated = [];
  for (const event of eventsByCategory.generalQuestion) {
    const urls = event.sourceRefs.map((r) => r.sourceUrl).filter(Boolean);
    if (new Set(urls).size !== urls.length) duplicated.push(event.id);
  }
  assert.deepEqual(duplicated, [], `出典URLが重複している一般質問イベント: ${duplicated.join(", ")}`);
});

test("すべての年表イベントの出典に verificationStatus が設定されている", () => {
  const allowed = new Set(["verified", "partiallyVerified", "needsReview", "sourceUnavailable"]);
  for (const event of allEvents) {
    for (const ref of event.sourceRefs) {
      assert.ok(allowed.has(ref.verificationStatus), `${event.id}: 不正なverificationStatus: ${ref.verificationStatus}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. 合成データ：出典が無い場合は「出典未登録」のまま維持する
// ---------------------------------------------------------------------------

/** 出典フィールドを一切持たない一般質問レコード（テスト専用の合成データ）。 */
const questionWithoutSource = {
  id: "test-no-source",
  councilYear: "令和8年",
  fiscalYear: "令和8年度",
  sessionName: "テスト定例会",
  sessionType: "定例会",
  questionType: "一般質問",
  questionDate: "2026-06-23",
  memberId: "m00",
  memberName: "テスト 議員",
  title: "テスト質問",
  summary: "テスト用の合成レコード。",
  topics: [],
  questionItems: [],
  sourceTitle: "",
  sourceOrganization: "",
  sourceUrl: "",
  lastVerified: "",
};

test("元データに出典が無い一般質問は、出典0件（＝「出典未登録」）のまま維持される", () => {
  assert.deepEqual(generalQuestionSourceRefs(questionWithoutSource), []);
  const [event] = buildGeneralQuestionEvents([questionWithoutSource]);
  assert.equal(event.sourceRefs.length, 0, "出典が無いのに年表へ出典が付与されている");
});

test("元データに出典が無い議案は、出典0件（＝「出典未登録」）のまま維持される", () => {
  const [event] = buildCouncilDocumentEvents([
    { id: "test-doc", documentType: "bill", title: "テスト議案", fiscalYear: 2026, sourceRefs: [] },
  ]);
  assert.equal(event.sourceRefs.length, 0, "出典が無いのに年表へ出典が付与されている");
});

test("sourceUrl と noticeUrl が同一PDFを指す場合、出典は1件にまとめられる", () => {
  const url = "https://example.invalid/notice.pdf";
  const refs = generalQuestionSourceRefs({
    ...questionWithoutSource,
    sourceUrl: url,
    sourceTitle: "質問通告書",
    sourceOrganization: "延岡市議会",
    noticeUrl: url,
    noticeTitle: "質問通告書（同一PDF）",
    lastVerified: "2026-07-14",
  });
  assert.equal(refs.length, 1);
  assert.equal(refs[0].sourceUrl, url);
  assert.equal(refs[0].sourceTitle, "質問通告書");
  assert.equal(refs[0].sourceOrganization, "延岡市議会");
  assert.equal(refs[0].accessedAt, "2026-07-14");
});

test("市議会だより等の別URLは、質問通告書と別の出典として並ぶ（取りこぼさない）", () => {
  const refs = generalQuestionSourceRefs({
    ...questionWithoutSource,
    sourceUrl: "https://example.invalid/notice.pdf",
    sourceTitle: "質問通告書",
    sourceOrganization: "延岡市議会",
    noticeUrl: "https://example.invalid/notice.pdf",
    newsletterUrl: "https://example.invalid/newsletter.pdf",
    newsletterTitle: "のべおか市議会だより第108号",
    newsletterCheckedAt: "2026-08-15",
    lastVerified: "2026-07-14",
  });
  assert.equal(refs.length, 2);
  const newsletter = refs.find((r) => r.sourceUrl === "https://example.invalid/newsletter.pdf");
  assert.ok(newsletter, "市議会だよりの出典が継承されていない");
  assert.equal(newsletter.sourceTitle, "のべおか市議会だより第108号");
  assert.equal(newsletter.accessedAt, "2026-08-15");
  // 号の目次・見出しレベルの確認にとどまるため、verifiedへ昇格させない。
  assert.equal(newsletter.verificationStatus, "partiallyVerified");
});

test("会議録が未確認の質問通告書は verified へ昇格しない（予定を実績として扱わない）", () => {
  const [ref] = generalQuestionSourceRefs({
    ...questionWithoutSource,
    sourceUrl: "https://example.invalid/notice.pdf",
    sourceTitle: "質問通告書",
    trustLevel: "PRIMARY",
  });
  assert.equal(ref.verificationStatus, "partiallyVerified");
  assert.equal(ref.trustLevel, "PRIMARY", "元データのtrustLevelが継承されていない");
});

test("会議録が確認できている質問は verified になり、会議録URLも出典に並ぶ", () => {
  const refs = generalQuestionSourceRefs({
    ...questionWithoutSource,
    sourceUrl: "https://example.invalid/notice.pdf",
    sourceTitle: "質問通告書",
    transcriptUrl: "https://example.invalid/minutes.html",
    lastVerified: "2026-07-14",
  });
  assert.equal(refs.length, 2);
  assert.ok(refs.every((r) => r.verificationStatus === "verified"));
  assert.ok(refs.some((r) => r.sourceUrl === "https://example.invalid/minutes.html"));
});

test("trustLevel・sourceOrganization が元データに無い場合、推測で補われない", () => {
  const [ref] = generalQuestionSourceRefs({
    ...questionWithoutSource,
    sourceUrl: "https://example.invalid/notice.pdf",
  });
  assert.equal("trustLevel" in ref, false, "trustLevelが推測で補われている");
  assert.equal("sourceOrganization" in ref, false, "sourceOrganizationが推測で補われている");
  assert.equal("sourceTitle" in ref, false, "sourceTitleが推測で補われている");
  assert.equal("accessedAt" in ref, false, "accessedAtが推測で補われている");
});

// ---------------------------------------------------------------------------
// 3. 表示側：出典0件のときの「出典未登録」表示が残っていること
// ---------------------------------------------------------------------------

test("CompareSourceNotice に出典0件時の「出典未登録」表示が残っている", () => {
  const src = readSrc("src/components/compare/CompareSourceNotice.tsx");
  assert.match(src, /sourceRefs\.length === 0 && .*出典未登録/);
});

test("TimelinePage が年表イベントごとに CompareSourceNotice で出典を表示している", () => {
  const src = readSrc("src/pages/TimelinePage.tsx");
  assert.match(src, /<CompareSourceNotice[\s\S]*sourceRefs: event\.sourceRefs/);
});

console.log(`\n${passed} checks passed`);
if (process.exitCode) {
  console.error("一部のチェックに失敗しました。");
}
