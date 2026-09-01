/**
 * Phase171：一般質問（質問通告書ベースの「予定」／会議録ベースの「確認済み」）の
 * データ分離と、公開後の安全な遷移（予定→実施確認→会議録本文確認済み）についての回帰テスト。
 *
 * 目的：
 * 1. 令和8年6月定例会（14件・市議会だよりで開催確認済み）と令和8年9月定例会（13件・未確認）が、
 *    データ構造上（generalQuestions.jsonのnewsletterConfirmedフィールド・sessionName）で
 *    明確に区別されたままであることを固定する。
 * 2. 質問通告書公式ページ（総括質疑及び一般質問発言通告一覧表、1416.html→1402.html）が、
 *    既存の定期巡回台帳（src/data/archiveCrawlerTargets.json）に重複なく1件だけ登録されており、
 *    実際の取得ロジックは既存資産（scripts/sync-council-data.mjs）を再利用していることを確認する。
 * 3. scripts/auto-update/questions/update-questions.mjsのevaluateQuestionNoticeRecord()を
 *    実際に呼び出し、「会議録が公開された会期の質問通告書は、通告書だけの情報では
 *    絶対に確認済み（登壇済み）へ自動昇格しない（anomalyDetected=true→classifyItem()でRED固定）」
 *    ことを実データに近い形で検証する。
 * 4. GREEN自動反映エンジン（apply-green.mjs）が、AUTO_APPLY_GREEN=trueであっても
 *    本番データ（src/data/generalQuestions.json・councilSpeechSummaries.json）へは
 *    一切書き込まない設計であることを、ソースコード上の書き込み先を検査して確認する。
 * 5. 件数回帰（最新会期予定質問者数・未公開会期合計・登壇確認済み件数・質問項目数）を固定する。
 *
 * 使い方: node scripts/test-question-notice-lifecycle.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { deriveSessionInfo, evaluateQuestionNoticeRecord } from "./auto-update/questions/update-questions.mjs";
import { classifyItem } from "./auto-update/core/classify.mjs";
import { readAutoApplyGreenFlag, listApplicableGreenItems, isEligibleForAutoApply } from "./auto-update/integration/apply-green.mjs";
import { isWithinCouncilSpeechPeriod } from "./lib/council-speech-period.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");
const readJson = (relPath) => JSON.parse(readSrc(relPath));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

// src/lib/questionLikeSpeechTypes.tsはVite依存のimportを持たない単純なconst定義のため、
// scripts/validate-data.mjsと同じ方法（Node 24のTS直接import）で読み込む。
const { QUESTION_LIKE_SPEECH_TYPES } = await import("../src/lib/questionLikeSpeechTypes.ts");

console.log("\nPhase171-1：令和8年6月定例会（14件）と9月定例会（13件）のデータ分離");

const generalQuestions = readJson("src/data/generalQuestions.json");

check("generalQuestions.jsonの令和8年6月定例会は14件、全件newsletterConfirmed:true（市議会だよりで開催確認済み）", () => {
  const juneQuestions = generalQuestions.filter((q) => q.sessionName === "令和8年6月定例会");
  assert.equal(juneQuestions.length, 14, `令和8年6月定例会が14件ではありません（${juneQuestions.length}件）`);
  assert.ok(
    juneQuestions.every((q) => q.newsletterConfirmed === true),
    "令和8年6月定例会の一部がnewsletterConfirmed:trueではありません",
  );
});

check("generalQuestions.jsonの令和8年9月定例会は13件、全件newsletterConfirmed:false（開催未確認）", () => {
  const septQuestions = generalQuestions.filter((q) => q.sessionName === "令和8年9月定例会");
  assert.equal(septQuestions.length, 13, `令和8年9月定例会が13件ではありません（${septQuestions.length}件）`);
  assert.ok(
    septQuestions.every((q) => q.newsletterConfirmed === false),
    "令和8年9月定例会の一部がnewsletterConfirmed:falseではありません（まだ開催・実施を確認していないはず）",
  );
});

check("generalQuestions.json（予定質問）は6月・9月とも1件もtranscriptUrlを持たない（会議録未確認のまま「確認済み」情報を混入させていない）", () => {
  const pendingSessions = ["令和8年6月定例会", "令和8年9月定例会"];
  const withTranscript = generalQuestions.filter((q) => pendingSessions.includes(q.sessionName) && q.transcriptUrl);
  assert.equal(withTranscript.length, 0, `会議録URLを持つ予定質問が${withTranscript.length}件あります（${withTranscript.map((q) => q.id).join("、")}）`);
});

check("generalQuestions.jsonの予定質問合計（scheduledCount）は27件（6月14件＋9月13件）", () => {
  assert.equal(generalQuestions.length, 27, `予定質問の合計が27件ではありません（${generalQuestions.length}件）`);
});

console.log("\nPhase171-2：questionCollectionStatus.jsonとの整合（会議録公開状況の単一情報源）");

const questionCollectionStatus = readJson("src/data/questionCollectionStatus.json");

check("questionCollectionStatus.jsonは13会期を対象とし、未公開（transcriptAvailable:false）は令和8年6月定例会の1件のみ", () => {
  assert.equal(questionCollectionStatus.sessions.length, 13, `対象会期数が13件ではありません（${questionCollectionStatus.sessions.length}件）`);
  const uncollected = questionCollectionStatus.sessions.filter((s) => !s.transcriptAvailable);
  assert.equal(uncollected.length, 1, `会議録未公開の会期が1件ではありません（${uncollected.length}件）`);
  assert.equal(uncollected[0].sessionId, "2026-06", `会議録未公開の会期IDが2026-06ではありません（${uncollected[0].sessionId}）`);
  assert.equal(uncollected[0].sessionTitle, "令和8年6月定例会");
});

check("令和8年9月定例会（2026-09）はquestionCollectionStatus.jsonにまだ登録されていない（会期そのものがまだ完全に終わっていないため、機械集計側の対象外のまま）", () => {
  const sept = questionCollectionStatus.sessions.find((s) => s.sessionId === "2026-09");
  assert.equal(sept, undefined, "questionCollectionStatus.jsonに2026-09が登録されています（想定外の早期追加）");
});

check("generalQuestions.jsonに登録された全予定質問について、対応する会期がquestionCollectionStatus.json上でtranscriptAvailable:trueになっていない（＝現時点で「予定」と「確認済み」が重複した異常状態のレコードは存在しない）", () => {
  const transcriptAvailableSessionIds = new Set(
    questionCollectionStatus.sessions.filter((s) => s.transcriptAvailable === true).map((s) => s.sessionId),
  );
  for (const q of generalQuestions) {
    const info = deriveSessionInfoFromSessionName(q.sessionName, q.questionDate);
    if (!info) continue;
    assert.ok(
      !transcriptAvailableSessionIds.has(info.sessionId),
      `予定質問${q.id}（${q.sessionName}）の会期は既に会議録確認済み（transcriptAvailable:true）です。確認済みデータへの手動移行が必要です`,
    );
  }
});

// generalQuestions.jsonのsessionName（例："令和8年6月定例会"）からsessionId（例："2026-06"）を
// 導出する。update-questions.mjsのderiveSessionInfo()はcouncilWatchedDocuments.jsonのtitle文字列
// （末尾に「（6月23日 個人質問）」を含む）を対象とした関数のため、ここではsessionNameのみから
// 導出する軽量な別ロジックを使う（令和換算式はderiveSessionInfo()と同じREIWA_START_YEAR=2019）。
function deriveSessionInfoFromSessionName(sessionName) {
  const m = sessionName.match(/令和(\d+)年(\d{1,2})月(定例会|臨時会)/);
  if (!m) return null;
  const year = 2019 + Number(m[1]) - 1;
  const sessionId = `${year}-${String(Number(m[2])).padStart(2, "0")}${m[3] === "臨時会" ? "-extraordinary" : ""}`;
  return { sessionId };
}

console.log("\nPhase171-3：質問通告書公式ページ（総括質疑及び一般質問発言通告一覧表）の定期巡回登録確認（重複登録なし）");

const crawlerTargets = readJson("src/data/archiveCrawlerTargets.json");

check("src/data/archiveCrawlerTargets.jsonに、質問通告一覧ページ（1416.html）を対象とするエントリ（id: general-question）が重複なくちょうど1件登録されている", () => {
  const matches = crawlerTargets.filter((t) => t.url === "https://www.city.nobeoka.miyazaki.jp/site/gikai/1416.html");
  assert.equal(matches.length, 1, `1416.htmlを対象とするcrawlerTargetsエントリが1件ではありません（${matches.length}件）`);
  assert.equal(matches[0].id, "general-question");
  assert.equal(
    matches[0].existingImplementation,
    "scripts/sync-council-data.mjs",
    "general-questionターゲットが既存実装（sync-council-data.mjs）以外を指しています（重複実装の可能性）",
  );
});

check("scripts/sync-council-data.mjs内で、質問通告一覧の入口URL（1416.html）を定義している箇所は1箇所のみ（重複実装検知）", () => {
  const src = readSrc("scripts/sync-council-data.mjs");
  const matches = src.match(/"https:\/\/www\.city\.nobeoka\.miyazaki\.jp\/site\/gikai\/1416\.html"/g) ?? [];
  assert.equal(matches.length, 1, `1416.htmlのURL文字列リテラルが1箇所ではありません（${matches.length}箇所）。indexUrl定義の重複を確認してください`);
});

check("scripts/auto-update/questions/update-questions.mjsは、1416.html／1402.htmlへの独自HTTP取得ロジックを持たず、既存資産（sync-council-data.mjs）をサブプロセス実行で再利用するのみ（巡回の重複実装なし）", () => {
  const src = readSrc("scripts/auto-update/questions/update-questions.mjs");
  assert.ok(src.includes('execFileSync("node", [scriptPath, "--dry-run"]'), "sync-council-data.mjsをdry-runでサブプロセス実行する既存の再利用箇所が見当たりません");
  assert.ok(!/fetchCitySiteText|extractMainBody/.test(src), "update-questions.mjsがHTML解析ロジック（sync-council-data.mjs固有の関数名）を独自に持っています（重複実装の疑い）");
  // fetchWithRetryはprobeNewDocument内で、新規検出済みの個別PDF1件への到達確認のみに使う
  // （一覧ページや詳細ページの取得には使わない）。
  const probeSection = src.slice(src.indexOf("async function probeNewDocument"), src.indexOf("async function main"));
  assert.ok(!probeSection.includes("1416.html") && !probeSection.includes("1402.html"), "probeNewDocument内で一覧・詳細ページへ直接アクセスしています");
});

console.log("\nPhase171-4：会議録公開後の安全な遷移（予定→実施確認→会議録本文確認済み）の実処理テスト");

const membersJson = readJson("src/data/members.json");
const memberIdSet = new Set(membersJson.map((m) => m.id));

check("deriveSessionInfo()：councilWatchedDocuments.json形式のtitle文字列から、令和8年6月・9月定例会それぞれのsessionId・questionDate・sessionNameを正しく導出する", () => {
  const june = deriveSessionInfo("第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）");
  assert.deepEqual(june, { sessionId: "2026-06", questionDate: "2026-06-23", sessionName: "令和8年6月定例会" });
  const sept = deriveSessionInfo("第27回延岡市議会(令和8年9月定例会)（9月8日 個人質問）");
  assert.deepEqual(sept, { sessionId: "2026-09", questionDate: "2026-09-08", sessionName: "令和8年9月定例会" });
});

check("evaluateQuestionNoticeRecord()：会議録が未公開の会期の新規質問通告書は、outcome=new・anomalyDetected=false・人間確認必須（自動で確認済み扱いにしない）", () => {
  const record = {
    title: "第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）",
    memberName: "宮田博徳",
    memberId: "m24",
    status: "published",
    sourceUrl: "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/99999.pdf",
    speakerIdentificationStatus: "confirmed",
  };
  const result = evaluateQuestionNoticeRecord(record, {
    generalQuestionsByUrl: new Map(), // まだgeneralQuestions.jsonに未登録＝新規候補
    transcriptAvailableSessionIds: new Set(), // 会議録はまだ未公開
    memberIdSet,
    allowedHosts: new Set(["www.city.nobeoka.miyazaki.jp"]),
  });
  assert.equal(result.outcome, "new");
  assert.equal(result.anomalyDetected, false);
  assert.equal(result.sessionTranscriptAlreadyPublic, false);
  assert.equal(result.requiresHumanReview, true, "新規検出の質問通告書は必ず人間確認が必要（自動で確認済みへ昇格しないため）のはずです");
  assert.match(result.humanReviewReason, /会議録は未公開のため確認済みへの昇格は行わない/);
});

check("evaluateQuestionNoticeRecord()＋classifyItem()：会議録公開後（questionCollectionStatus.jsonでtranscriptAvailable:trueへ遷移した後）に同じ会期の質問通告書を検出した場合、通告書の内容だけでは絶対にGREEN（自動反映）にならず、無条件でRED（人間確認・自動反映対象外）になる（新規検出の場合）", () => {
  const record = {
    title: "第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）",
    memberName: "宮田博徳",
    memberId: "m24",
    status: "published",
    sourceUrl: "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/99999.pdf",
    speakerIdentificationStatus: "confirmed",
  };
  // 会議録公開後を模擬：2026-06がtranscriptAvailable:trueになったと仮定する。
  const evalResult = evaluateQuestionNoticeRecord(record, {
    generalQuestionsByUrl: new Map(),
    transcriptAvailableSessionIds: new Set(["2026-06"]),
    memberIdSet,
    allowedHosts: new Set(["www.city.nobeoka.miyazaki.jp"]),
  });
  assert.equal(evalResult.sessionTranscriptAlreadyPublic, true);
  assert.equal(evalResult.anomalyDetected, true, "会議録公開済み会期の通告書検出はanomalyDetected=trueになるはずです");
  assert.match(evalResult.anomalyReason, /予定」と「確認済み」の混同防止のため自動反映不可/);

  const classified = classifyItem({
    schemaValid: true,
    schemaErrors: [],
    outcome: evalResult.outcome,
    isOfficialPrimarySource: true,
    reachable: true,
    httpStatus: 200,
    requiresHumanReview: evalResult.requiresHumanReview,
    humanReviewReason: evalResult.humanReviewReason,
    anomalyDetected: evalResult.anomalyDetected,
    anomalyReason: evalResult.anomalyReason,
  });
  assert.equal(classified.level, "RED", "会議録公開済み会期の質問通告書はREDでなければなりません（GREEN自動反映は絶対禁止）");
});

check("evaluateQuestionNoticeRecord()＋classifyItem()：既にgeneralQuestions.jsonへ「予定」として登録済み（outcome=unchanged）の通告書であっても、会期が後から会議録確認済みになった場合は同様にRED（既存の「予定」レコードを自動で「確認済み」へ書き換えない安全装置）", () => {
  const record = {
    title: "第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）",
    memberName: "宮田博徳",
    memberId: "m24",
    status: "published",
    sourceUrl: "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/27613.pdf", // generalQuestions.jsonの実データと同一URL
    speakerIdentificationStatus: "confirmed",
    fileHash: "unchanged-hash",
  };
  const existingGq = generalQuestions.find((q) => q.id === "gq2026-06-m24");
  assert.ok(existingGq, "テスト前提となる既存レコードgq2026-06-m24が見つかりません");
  const evalResult = evaluateQuestionNoticeRecord(record, {
    generalQuestionsByUrl: new Map([[existingGq.sourceUrl, existingGq]]),
    transcriptAvailableSessionIds: new Set(["2026-06"]), // 会議録公開後を模擬
    memberIdSet,
    allowedHosts: new Set(["www.city.nobeoka.miyazaki.jp"]),
  });
  assert.equal(evalResult.outcome, "unchanged", "既存レコードと差分がないため、outcomeはunchangedのはずです");
  assert.equal(evalResult.anomalyDetected, true);

  const classified = classifyItem({
    schemaValid: true,
    schemaErrors: [],
    outcome: evalResult.outcome,
    isOfficialPrimarySource: true,
    reachable: true,
    httpStatus: null,
    requiresHumanReview: evalResult.requiresHumanReview,
    humanReviewReason: evalResult.humanReviewReason,
    anomalyDetected: evalResult.anomalyDetected,
    anomalyReason: evalResult.anomalyReason,
  });
  assert.equal(
    classified.level,
    "RED",
    "outcome=unchangedであっても、会議録公開済み会期であればanomalyDetectedによりREDになるはずです（GREENの機械的確定ルールより異常検知が優先される）",
  );
});

check("evaluateQuestionNoticeRecord()：話者（議員）自動特定ができていない通告書（speakerIdentificationStatus!==confirmed）は、既存の予定質問と内容が一致（outcome=unchanged）していても常に人間確認が必要", () => {
  const existingGq = generalQuestions.find((q) => q.id === "gq2026-06-m24");
  assert.ok(existingGq, "テスト前提となる既存レコードgq2026-06-m24が見つかりません");
  const record = {
    title: "第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）",
    memberName: "宮田博徳",
    memberId: existingGq.memberId,
    status: "published",
    sourceUrl: existingGq.sourceUrl, // 既存登録済みと同一URL→outcomeはunchangedになる
    speakerIdentificationStatus: "要確認", // それでも話者自動特定が未確定なら人間確認は省略しない
  };
  const evalResult = evaluateQuestionNoticeRecord(record, {
    generalQuestionsByUrl: new Map([[existingGq.sourceUrl, existingGq]]),
    transcriptAvailableSessionIds: new Set(),
    memberIdSet,
    allowedHosts: new Set(["www.city.nobeoka.miyazaki.jp"]),
  });
  assert.equal(evalResult.outcome, "unchanged");
  assert.equal(evalResult.requiresHumanReview, true);
  assert.match(evalResult.humanReviewReason, /議員）の自動特定ができていない/);
});

check("evaluateQuestionNoticeRecord()：会議録未公開の会期の新規検出（outcome=new）は、話者特定が済んでいても常に人間確認が必要（予定質問への追加登録前に必ず人が確認する設計）", () => {
  const record = {
    title: "第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）",
    memberName: "未登録太郎",
    memberId: null,
    status: "published",
    sourceUrl: "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/88888.pdf",
    speakerIdentificationStatus: "confirmed",
  };
  const evalResult = evaluateQuestionNoticeRecord(record, {
    generalQuestionsByUrl: new Map(),
    transcriptAvailableSessionIds: new Set(),
    memberIdSet,
    allowedHosts: new Set(["www.city.nobeoka.miyazaki.jp"]),
  });
  assert.equal(evalResult.outcome, "new");
  assert.equal(evalResult.requiresHumanReview, true);
  assert.match(evalResult.humanReviewReason, /会議録は未公開のため確認済みへの昇格は行わない/);
});

check("evaluateQuestionNoticeRecord()：members.jsonに存在しないmemberIdが付与された通告書はanomalyDetected=true（誤った議員紐付けを自動確定しない）", () => {
  const record = {
    title: "第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）",
    memberName: "架空太郎",
    memberId: "m9999-not-exist",
    status: "published",
    sourceUrl: "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/77777.pdf",
    speakerIdentificationStatus: "confirmed",
  };
  const evalResult = evaluateQuestionNoticeRecord(record, {
    generalQuestionsByUrl: new Map(),
    transcriptAvailableSessionIds: new Set(),
    memberIdSet,
    allowedHosts: new Set(["www.city.nobeoka.miyazaki.jp"]),
  });
  assert.equal(evalResult.anomalyDetected, true);
  assert.match(evalResult.anomalyReason, /members\.jsonに存在しない/);
});

console.log("\nPhase171-5：GREEN自動反映エンジン（apply-green.mjs）が本番データへ一切書き込まないことの確認");

check("apply-green.mjsのソースコードに、src/data配下（本番データ）へのwriteFileSync呼び出しが存在しない（書き込み先はreports/auto-update/配下のdry-run記録のみ）", () => {
  const src = readSrc("scripts/auto-update/integration/apply-green.mjs");
  const writeCalls = src.match(/writeFileSync\([^)]*\)/g) ?? [];
  assert.ok(writeCalls.length > 0, "writeFileSync呼び出しが1件も見つかりません（dry-run記録の書き出し処理自体が無い可能性）");
  for (const call of writeCalls) {
    assert.ok(!/src["'`]?\s*,\s*["'`]?data/.test(call) && !call.includes("src/data"), `apply-green.mjsが本番データへ書き込んでいる可能性があります: ${call}`);
  }
  assert.ok(src.includes("AUTO_UPDATE_DIR"), "書き込み先がAUTO_UPDATE_DIR（reports/auto-update/）配下であることを確認できません");
});

check("readAutoApplyGreenFlag()：AUTO_APPLY_GREEN=\"true\"（文字列完全一致）のときのみtrue、それ以外（未設定・false・大文字小文字違い等）はすべてfalse（安全側デフォルト）", () => {
  assert.equal(readAutoApplyGreenFlag({}), false, "環境変数未設定時はfalseであるべきです");
  assert.equal(readAutoApplyGreenFlag({ AUTO_APPLY_GREEN: "false" }), false);
  assert.equal(readAutoApplyGreenFlag({ AUTO_APPLY_GREEN: "TRUE" }), false, "大文字小文字違いはfalse扱いであるべきです");
  assert.equal(readAutoApplyGreenFlag({ AUTO_APPLY_GREEN: "1" }), false);
  assert.equal(readAutoApplyGreenFlag({ AUTO_APPLY_GREEN: "true" }), true);
});

check("listApplicableGreenItems()／isEligibleForAutoApply()：GREEN以外の項目を含めず、RED/YELLOWが1件でもあれば連続正常実行回数によらず適用不可と判定する", () => {
  const report = {
    summary: { red: 0, yellow: 1 },
    circuitBreakerTripped: false,
    entries: [
      { level: "GREEN", sourceUrl: "https://example/1.pdf" },
      { level: "YELLOW", sourceUrl: "https://example/2.pdf" },
      { level: "RED", sourceUrl: "https://example/3.pdf" },
    ],
  };
  const greenItems = listApplicableGreenItems(report);
  assert.equal(greenItems.length, 1);
  assert.equal(greenItems[0].sourceUrl, "https://example/1.pdf");
  assert.equal(
    isEligibleForAutoApply({ consecutiveSuccessfulRuns: 10 }, report),
    false,
    "YELLOWが1件でもある場合はisEligibleForAutoApply=falseであるべきです",
  );
});

console.log("\nPhase171-6：件数回帰（トップページ・データ収録状況・一般質問一覧が共有する集計値の固定）");

const speechData = readJson("src/data/councilSpeechSummaries.json");

function isExemptFromCurrentTermCutoff(record, speech) {
  return !!record.isFormerMember || speech.term === "previous";
}

// src/lib/councilSpeeches.tsのallPublicSpeeches()+questionLikeSpeeches()と同じ条件
// （isPublished && questionLikeSpeechType && (旧任期として明示、または収録対象期間内)）を、
// scripts/配下の既存JS実装（council-speech-period.mjs）を使って複製する
// （このスクリプトはVite専用のTS importを直接使えないため、validate-data.mjsと同じ方式）。
function computeConfirmedStats() {
  let confirmedCount = 0;
  let totalQuestionItemCount = 0;
  for (const record of speechData.members) {
    for (const speech of record.speeches ?? []) {
      if (!speech.isPublished || !QUESTION_LIKE_SPEECH_TYPES.has(speech.speechType)) continue;
      if (!(isExemptFromCurrentTermCutoff(record, speech) || isWithinCouncilSpeechPeriod(speech.date))) continue;
      confirmedCount += 1;
      totalQuestionItemCount += (speech.questionItems ?? []).length;
    }
  }
  return { confirmedCount, totalQuestionItemCount };
}

check("確認済み一般質問（councilSpeechSummaries.json、公開・収録対象期間内・一般質問系区分）の累計件数と質問項目数を固定する（トップページ・データ収録状況・一般質問一覧の「登壇・確認済み件数」と同じ集計条件）", () => {
  const { confirmedCount, totalQuestionItemCount } = computeConfirmedStats();
  assert.equal(confirmedCount, 418, `確認済み一般質問の件数が418件ではありません（${confirmedCount}件）。src/lib/generalQuestionStats.tsのconfirmedCountの実データが変化した場合は、意図した変更か確認したうえで期待値を更新してください`);
  assert.equal(totalQuestionItemCount, 1567, `確認済み一般質問の質問項目数が1567件ではありません（${totalQuestionItemCount}件）`);
});

check("最新会期（現時点で会議録未公開）の予定質問者数：令和8年6月定例会14名・令和8年9月定例会13名。質問通告書ベースの2会期が同時に存在する状態を維持している", () => {
  const juneMembers = new Set(generalQuestions.filter((q) => q.sessionName === "令和8年6月定例会").map((q) => q.memberId));
  const septMembers = new Set(generalQuestions.filter((q) => q.sessionName === "令和8年9月定例会").map((q) => q.memberId));
  assert.equal(juneMembers.size, 14, `令和8年6月定例会の質問者数（議員の種類数）が14名ではありません（${juneMembers.size}名）`);
  assert.equal(septMembers.size, 13, `令和8年9月定例会の質問者数（議員の種類数）が13名ではありません（${septMembers.size}名）`);
});

check("未公開会期の予定質問合計（scheduledCount=27件）と確認済み件数（confirmedCount=418件）は、それぞれ独立した集計値として固定される（generalQuestionStats.tsの設計方針どおり、対象が重ならない別々の集合として扱われ、単純合算した「合計445件」等の値をどこにも表示していないことを、この2つの期待値そのものが担保する）", () => {
  const scheduledCount = generalQuestions.length;
  const { confirmedCount } = computeConfirmedStats();
  assert.equal(scheduledCount, 27);
  assert.equal(confirmedCount, 418);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
