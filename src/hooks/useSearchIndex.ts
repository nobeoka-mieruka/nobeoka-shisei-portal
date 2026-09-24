import { useEffect, useState } from "react";
import type { SearchEntryType, SearchIndexEntry } from "../types";

/**
 * サイト内検索の索引を、/search を開いたときだけ読み込むフック。
 *
 * 索引はビルド時に public/search-index/ へ種類ごとに分けて書き出している
 * （scripts/generate-search-index.mjs）。JSのバンドルには含めず fetch で取得するため、
 * トップページなど他のページの読み込み量には影響しない。
 *
 * 1. manifest.json と本文なしの軽いファイルを読み込み、タイトル・概要・キーワードで検索できる状態にする
 * 2. 続けて本文ファイル（会議録の要約・議案の概要など）を読み込み、「本文に一致」の結果を追加する
 *
 * サーバー側の事前描画（プリレンダリング）では読み込まず、空の索引として扱う
 * （初回描画はクエリなしの内容で固定しているため、結果の不一致は起きない）。
 */

interface ManifestFile {
  type: SearchEntryType;
  file: string;
  count: number;
  hash: string;
  bodyFile?: string;
  bodyHash?: string;
}

interface SearchIndexManifest {
  entryCount: number;
  files: ManifestFile[];
}

export type SearchIndexStatus = "idle" | "loading" | "ready-light" | "ready" | "error";

export interface SearchIndexState {
  entries: SearchIndexEntry[];
  status: SearchIndexStatus;
  /** 本文ファイルまで読み込み済みか（false の間は「本文に一致」の結果がまだ出ない）。 */
  bodiesLoaded: boolean;
}

const BASE = "/search-index/";

let cache: Promise<SearchIndexEntry[]> | null = null;
let bodiesCache: Promise<SearchIndexEntry[]> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`search index fetch failed: ${path} (${res.status})`);
  return (await res.json()) as T;
}

let manifestPromise: Promise<SearchIndexManifest> | null = null;
function loadManifest(): Promise<SearchIndexManifest> {
  if (!manifestPromise) {
    manifestPromise = fetchJson<SearchIndexManifest>(`${BASE}manifest.json`).catch((e) => {
      manifestPromise = null;
      throw e;
    });
  }
  return manifestPromise;
}

function loadLight(): Promise<SearchIndexEntry[]> {
  if (!cache) {
    cache = loadManifest()
      .then((manifest) =>
        Promise.all(manifest.files.map((f) => fetchJson<SearchIndexEntry[]>(`${BASE}${f.file}?v=${f.hash}`))),
      )
      .then((lists) => lists.flat())
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

function loadWithBodies(): Promise<SearchIndexEntry[]> {
  if (!bodiesCache) {
    bodiesCache = Promise.all([loadManifest(), loadLight()])
      .then(async ([manifest, light]) => {
        const bodyMaps = await Promise.all(
          manifest.files
            .filter((f) => f.bodyFile)
            .map((f) => fetchJson<Record<string, string>>(`${BASE}${f.bodyFile}?v=${f.bodyHash}`)),
        );
        const bodies = Object.assign({}, ...bodyMaps) as Record<string, string>;
        return light.map((e) => (bodies[e.id] ? { ...e, content: bodies[e.id] } : e));
      })
      .catch((e) => {
        bodiesCache = null;
        throw e;
      });
  }
  return bodiesCache;
}

export function useSearchIndex(enabled = true): SearchIndexState {
  const [state, setState] = useState<SearchIndexState>({ entries: [], status: "idle", bodiesLoaded: false });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((s) => (s.status === "idle" ? { ...s, status: "loading" } : s));
    loadLight()
      .then((entries) => {
        if (!cancelled) setState((s) => (s.bodiesLoaded ? s : { entries, status: "ready-light", bodiesLoaded: false }));
        return loadWithBodies();
      })
      .then((entries) => {
        if (!cancelled) setState({ entries, status: "ready", bodiesLoaded: true });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, status: s.entries.length > 0 ? s.status : "error" }));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
