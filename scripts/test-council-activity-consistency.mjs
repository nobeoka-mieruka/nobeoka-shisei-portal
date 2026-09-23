/**
 * 議会活動の表示値・内部計算値・詳細記録の件数が、現職議員全員で一致することの検査。
 *
 * 他の検査はソースの書き方を見るものが多いが、ここでは実際の算定関数を動かし、
 * 実際の画面（プリレンダリングと同じ renderApp）を描画して、画面に出た数字を確かめる。
 *
 * 確かめること（全議員）：
 * 1. レーダーの軸の値（割合・分子・分母）が、記録の一覧の値と同じ（二重計算していない）。
 * 2. 討論の分子・分母が、個別の討論記録から数え直した値と同じ。
 *    記録の件数（根拠の一覧）が、表示している「根拠の記録：N件」と同じ。
 * 3. 一般質問の分子・分母が、会期ごとの内訳から数え直した値と同じ。
 * 4. 全議員に同じ期間・同じ除外条件を適用している（議長を務めた会期だけが、その議員の分母から外れる）。
 * 5. 値が無いものを0として扱っていない（null の値に「確認済み」「0件」の状態を付けていない）。
 * 6. 個人ページ（/members/:id）と一覧（/council-activity）に表示された数字が、内部の値と同じ。
 *
 * 使い方: node scripts/test-council-activity-consistency.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "vite";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

/** HTMLから、指定した属性を持つ要素の中身を、画面に出る文字だけにして取り出す。 */
function elementText(html, attr, value, closeTag) {
  const at = html.indexOf(`${attr}="${value}"`);
  if (at < 0) return null;
  const end = html.indexOf(closeTag, at);
  return html
    .slice(at, end < 0 ? undefined : end)
    .replace(/<!--.*?-->/gs, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;|&#\d+;/g, " ");
}

const server = await createServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const b = await server.ssrLoadModule("/src/lib/councilActivityBarometer.ts");
  const p = await server.ssrLoadModule("/src/lib/councilActivityProfile.ts");
  const { renderApp } = await server.ssrLoadModule("/src/entry-server.tsx");
  const members = (await server.ssrLoadModule("/src/data/members.json")).default;
  const chairTerms = b.councilLeadershipTerms.filter((t) => t.role === "議長");

  console.log(`\n議会活動の表示値・内部計算値・詳細記録の件数（現職${members.length}名）`);

  const internal = new Map();
  for (const m of members) {
    const record = b.getMemberActivityRecord(m);
    const axes = p.buildCouncilActivityProfile(m, record, b.activityTargetPeriodLabel(), members.length, b.debateTargetPeriodLabel());
    const value = (key) => record.values.find((v) => v.key === key);
    internal.set(m.id, { record, axes, value, debate: b.getMemberDebateSessions(m.id) });
  }

  check("レーダーの軸の値が、記録の一覧の値と同じ（全議員）", () => {
    for (const m of members) {
      const { axes, value } = internal.get(m.id);
      for (const [axisKey, recordKey] of [
        ["monitoring", "asked-rate"],
        ["member-debate", "debate-rate"],
      ]) {
        const axis = axes.find((a) => a.key === axisKey);
        const v = value(recordKey);
        if (v.value === null) {
          assert.equal(axis.measurement, null, `${m.name}：${axisKey} は記録に値が無いのに、図に値があります`);
          continue;
        }
        assert.ok(axis.measurement, `${m.name}：${axisKey} は記録に値があるのに、図に値がありません`);
        assert.equal(axis.measurement.numerator, v.numerator, `${m.name}：${axisKey} の分子が食い違います`);
        assert.equal(axis.measurement.denominator, v.denominator, `${m.name}：${axisKey} の分母が食い違います`);
        assert.equal(axis.measurement.rate, v.value, `${m.name}：${axisKey} の割合が食い違います`);
        assert.equal(
          axis.measurement.rate,
          Math.round((v.numerator / v.denominator) * 100),
          `${m.name}：${axisKey} の割合が分子÷分母と一致しません`,
        );
        assert.ok(axis.measurement.rate >= 0 && axis.measurement.rate <= 100, `${m.name}：割合が0〜100の範囲外です`);
      }
    }
  });

  check("討論の分子・分母・記録件数が、個別の討論記録から数え直した値と同じ（全議員）", () => {
    for (const m of members) {
      const { value, debate } = internal.get(m.id);
      const v = value("debate-rate");
      const speeches = b.debateSpeechesFor(m.id);
      const recounted = new Set(
        speeches.map((d) => d.sessionId).filter((id) => debate.eligibleSessionIds.includes(id)),
      );
      assert.equal(v.items.length, speeches.length, `${m.name}：根拠の一覧の件数が討論記録の件数と違います`);
      if (debate.eligibleSessionIds.length === 0) {
        assert.equal(v.value, null, `${m.name}：分母が0なのに割合があります`);
        assert.equal(v.availability, "not-applicable", `${m.name}：分母が0の理由が対象外になっていません`);
        continue;
      }
      assert.equal(v.numerator, recounted.size, `${m.name}：討論の分子が記録から数え直した値と違います`);
      assert.equal(v.denominator, debate.eligibleSessionIds.length, `${m.name}：討論の分母が違います`);
      assert.equal(
        v.availability,
        recounted.size > 0 ? "available" : "confirmed-zero",
        `${m.name}：討論の確認状況が値と合っていません`,
      );
    }
  });

  check("一般質問の分子・分母が、会期ごとの内訳から数え直した値と同じ（全議員）", () => {
    for (const m of members) {
      const { record, value } = internal.get(m.id);
      const counted = record.sessions.filter((s) => s.countedInDenominator);
      const v = value("asked-rate");
      if (counted.length === 0) {
        assert.equal(v.value, null, `${m.name}：算定対象の会期が無いのに割合があります`);
        continue;
      }
      assert.equal(v.denominator, counted.length, `${m.name}：一般質問の分母が内訳と違います`);
      assert.equal(v.numerator, counted.filter((s) => s.asked).length, `${m.name}：一般質問の分子が内訳と違います`);
    }
  });

  check("全議員に同じ期間・同じ除外条件を適用している（違いは議長を務めた会期だけ）", () => {
    const chairIds = new Set(chairTerms.map((t) => t.memberId));
    const allQuestionSessions = new Set(
      internal.get(members[0].id).record.sessions.map((s) => s.sessionId),
    );
    for (const m of members) {
      const { record, debate } = internal.get(m.id);
      // 会期の一覧（分母に入れたもの＋外したもの）は全員同じ。
      assert.deepEqual(
        new Set(record.sessions.map((s) => s.sessionId)),
        allQuestionSessions,
        `${m.name}：対象期間の会期が他の議員と違います`,
      );
      // 討論：分母＋議長で外した会期＝討論が行われた会期（全員共通）。
      assert.deepEqual(
        [...debate.eligibleSessionIds, ...debate.chairSessionIds].sort(),
        [...b.debateHeldSessionIds].sort(),
        `${m.name}：討論の対象会期が他の議員と違います`,
      );
      if (!chairIds.has(m.id)) {
        assert.equal(debate.chairSessionIds.length, 0, `${m.name}：議長ではないのに会期を外しています`);
        assert.ok(
          record.sessions.every((s) => s.countedInDenominator || s.excludedReasonCode === "SOURCE_NOT_PUBLISHED"),
          `${m.name}：議長ではないのに一般質問の会期を外しています`,
        );
      }
      // 外した理由は、議長在任か会議録の未公開だけ。
      for (const s of record.sessions.filter((x) => !x.countedInDenominator)) {
        assert.ok(
          ["SPEAKER_TERM", "SOURCE_NOT_PUBLISHED"].includes(s.excludedReasonCode),
          `${m.name}：想定外の除外理由です（${s.excludedReasonCode}）`,
        );
      }
    }
  });

  check("値が無いものを0や確認済みとして扱っていない（全議員・全項目）", () => {
    for (const m of members) {
      const { record } = internal.get(m.id);
      for (const v of record.values) {
        if (v.kind !== "number") continue;
        if (v.value === null) {
          assert.notEqual(v.availability, "available", `${m.name}：${v.label} は値が無いのに「確認済み」になっています`);
          // 割合の元になる件数が確認済みの0件で、割合を算定できない場合だけ confirmed-zero を許す。
          // その場合は、0%ではないことを必ず言葉で添える。
          if (v.availability === "confirmed-zero") {
            assert.ok(v.availabilityNote, `${m.name}：${v.label} は値が無いのに、0件の理由の説明がありません`);
          }
        } else if (v.value === 0) {
          assert.equal(v.availability, "confirmed-zero", `${m.name}：${v.label} が0なのに、確認済みの0になっていません`);
        }
      }
    }
  });

  // --- 画面に出た数字 ---
  const memberHtml = new Map();
  for (const m of members) memberHtml.set(m.id, await renderApp(`/members/${m.id}`));

  check("個人ページのレーダー（軸の一覧）に出た数字が、内部の値と同じ（全議員）", () => {
    for (const m of members) {
      const html = memberHtml.get(m.id);
      for (const axis of internal.get(m.id).axes) {
        const text = elementText(html, "data-axis-key", axis.key, "</li>");
        assert.ok(text, `${m.name}：軸 ${axis.key} が画面にありません`);
        if (axis.measurement) {
          const { rate, numerator, denominator } = axis.measurement;
          assert.ok(text.includes(`${rate}%`), `${m.name}：軸 ${axis.key} の割合 ${rate}% が画面にありません（${text}）`);
          assert.ok(
            text.includes(`（${numerator}／${denominator}）`),
            `${m.name}：軸 ${axis.key} の分子・分母が画面と違います（${text}）`,
          );
        } else {
          assert.ok(!/\d+%/.test(text), `${m.name}：値の無い軸 ${axis.key} に割合が表示されています（${text}）`);
          assert.ok(text.includes(p.AXIS_STATUS_LABELS_JA[axis.status]), `${m.name}：軸 ${axis.key} の状態が表示されていません`);
        }
      }
    }
  });

  check("個人ページの記録の一覧に出た数字・件数が、内部の値と同じ（全議員）", () => {
    for (const m of members) {
      const html = memberHtml.get(m.id);
      for (const key of ["asked-rate", "asked-sessions", "debate-rate", "named-votes"]) {
        const v = internal.get(m.id).value(key);
        const text = elementText(html, "data-record-key", key, "</li>");
        assert.ok(text, `${m.name}：記録 ${key} が画面にありません`);
        if (v.value === null) {
          assert.ok(text.includes("―"), `${m.name}：値の無い ${key} が「―」になっていません（${text}）`);
        } else {
          assert.ok(text.includes(`${v.value}${v.unit}`), `${m.name}：${key} の値 ${v.value}${v.unit} が画面にありません（${text}）`);
        }
        if (v.numerator != null && v.denominator != null) {
          assert.ok(text.includes(`${v.numerator}／${v.denominator}`), `${m.name}：${key} の分子・分母が画面と違います`);
        }
        if (v.kind === "number" && v.evidenceKind === "items") {
          assert.ok(
            text.includes(`根拠の記録：${v.items.length}件`),
            `${m.name}：${key} の根拠の記録の件数が画面と違います（${text}）`,
          );
        }
      }
    }
  });

  const listHtml = await renderApp("/council-activity");
  check("一覧（/council-activity）の一般質問実施率が、個人の記録と同じ（全議員）", () => {
    for (const m of members) {
      const text = elementText(listHtml, "data-member-id", m.id, "</tr>");
      assert.ok(text, `${m.name}：一覧に行がありません`);
      const v = internal.get(m.id).value("asked-rate");
      if (v.value === null) {
        assert.ok(/対象外|未確認/.test(text), `${m.name}：値の無い実施率が状態で表示されていません`);
      } else {
        assert.ok(text.includes(`${v.value}%`), `${m.name}：一覧の実施率が ${v.value}% ではありません（${text}）`);
      }
      assert.ok(!/順位/.test(text), `${m.name}：一覧に順位が表示されています`);
    }
    assert.ok(!/TOP3|[0-9]+位/.test(listHtml.replace(/<[^>]+>/g, "")), "一覧に順位（TOP3・○位）が表示されています");
  });

  // 集計の要約（最終報告の根拠として出力する）。
  const summary = members.map((m) => {
    const { value } = internal.get(m.id);
    const q = value("asked-rate");
    const d = value("debate-rate");
    return `${m.id} 一般質問 ${q.numerator ?? "-"}/${q.denominator ?? "-"} 討論 ${d.numerator ?? "-"}/${d.denominator ?? "-"}（記録${d.items.length}件）`;
  });
  console.log(`\n${summary.join("\n")}`);
} finally {
  await server.close();
}

console.log(`\n${passCount}件成功\n`);
