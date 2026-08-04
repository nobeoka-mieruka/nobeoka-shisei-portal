/**
 * 5日ごと自動巡回（scripts/sync-council-data.mjs）の実行状態を管理する。
 *
 * 正常実行の判定は、原則としてGitHub Actions側（gh run list）が保持する実行履歴を
 * 「安全な保存領域」として使い、--last-success=<ISO日時> で本スクリプトへ渡す想定。
 * ローカル実行・テスト時など、それが渡されない場合のみ、このファイルが管理する
 * ローカル状態ファイル（scripts/_sync-state.json、Git管理外）を代替として使う。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
export const STATE_PATH = join(root, "scripts", "_sync-state.json");

export const MIN_HOURS_BETWEEN_RUNS = 120;

const MAX_HISTORY = 30;

/**
 * statePathを省略した場合は既存のscripts/_sync-state.json（sync-council-data.mjs用）を使う。
 * 他の巡回ジョブ（例：archive-crawler）が同じ仕組みを使う場合は、別のパスを渡して
 * 状態ファイルを分離すること（同じファイルを共有すると、120時間ゲートが混ざってしまうため）。
 */
export function loadLocalState(statePath = STATE_PATH) {
  if (!existsSync(statePath)) {
    return { lastSuccessfulRunAt: null, lastAttemptAt: null, history: [] };
  }
  try {
    const data = JSON.parse(readFileSync(statePath, "utf8"));
    return {
      lastSuccessfulRunAt: data.lastSuccessfulRunAt ?? null,
      lastAttemptAt: data.lastAttemptAt ?? null,
      history: Array.isArray(data.history) ? data.history : [],
    };
  } catch {
    return { lastSuccessfulRunAt: null, lastAttemptAt: null, history: [] };
  }
}

export function saveLocalState(state, statePath = STATE_PATH) {
  const trimmed = { ...state, history: state.history.slice(0, MAX_HISTORY) };
  writeFileSync(statePath, `${JSON.stringify(trimmed, null, 2)}\n`, "utf8");
}

export function hoursSince(isoString, now = new Date()) {
  if (!isoString) return null;
  const then = new Date(isoString);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60);
}

/**
 * 実行すべきかどうかを判定する。
 * @param {{force: boolean, lastSuccessfulRunAt: string|null, now?: Date}} params
 */
export function shouldRun({ force, lastSuccessfulRunAt, now = new Date() }) {
  if (force) return { run: true, reason: "force", hoursSinceLast: hoursSince(lastSuccessfulRunAt, now) };
  const hours = hoursSince(lastSuccessfulRunAt, now);
  if (hours === null) return { run: true, reason: "no-previous-record", hoursSinceLast: null };
  if (hours >= MIN_HOURS_BETWEEN_RUNS) return { run: true, reason: "interval-elapsed", hoursSinceLast: hours };
  return { run: false, reason: "too-soon", hoursSinceLast: hours };
}

export function appendHistory(state, entry) {
  state.history = [entry, ...state.history].slice(0, MAX_HISTORY);
  return state;
}
