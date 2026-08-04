/**
 * フェーズ10C：外部AIプロバイダーの抽象化。
 *
 * 特定のAIサービス（Anthropic・OpenAI等）に密結合しないよう、インターフェースのみを
 * ここで定義する。実際のAPIキー読み込み・HTTP呼び出しはNode専用の処理のため、
 * scripts/run-archive-ai-processor.mjs（CI実行スクリプト）側で行う
 * （このファイルはsrc/lib配下でブラウザ向けビルドにも含まれうるため、process.envの
 * APIキーや実際のfetchをここに書かない）。
 *
 * 既定では`DisabledAiProvider`を使う。有効なプロバイダーは、APIキーが実際に設定され、
 * かつ`ARCHIVE_AI_ENABLED=true`が明示された場合にのみscripts側で選択される。
 * APIキー未設定・エラー時は例外を投げず、呼び出し側がArchiveAiJob.status="skipped"として
 * 記録できるよう、`AiProviderUnavailableError`を投げる。
 */
import type { ArchivePolicyCategory, ArchiveRelationType, ArchiveSearchDocumentType } from "../../types/historicalArchive";

export class AiProviderUnavailableError extends Error {
  constructor(reason: string) {
    super(`AIプロバイダーを利用できません: ${reason}`);
    this.name = "AiProviderUnavailableError";
  }
}

export interface AiSummaryResult {
  summary: string;
  keyPoints: string[];
}

export interface AiCategoryResult {
  categoryId: string;
  /** 0〜1。 */
  confidence: number;
  reason: string;
  evidenceText: string;
}

export interface AiRelationCandidateInput {
  targetEntityType: ArchiveSearchDocumentType;
  targetEntityId: string;
  /** 判定材料として渡す、比較先の本文（タイトル・要約等）。 */
  targetText: string;
}

export interface AiRelationResult {
  targetEntityType: ArchiveSearchDocumentType;
  targetEntityId: string;
  relationType: ArchiveRelationType;
  confidence: number;
  reason: string;
}

export interface AiKnownEntity {
  id: string;
  name: string;
}

export interface AiEntityResult {
  rawName: string;
  /** 一致した既存マスタのID。一致が無ければ空配列（推測でIDを割り当てない）。 */
  candidateIds: string[];
}

/** src/lib/ai/archiveAiProcessor.tsが依存する、AIプロバイダーの最小インターフェース。 */
export interface ArchiveAiProvider {
  readonly name: string;
  summarize(text: string): Promise<AiSummaryResult>;
  classifyCategories(text: string, categories: ArchivePolicyCategory[]): Promise<AiCategoryResult[]>;
  findRelations(text: string, candidates: AiRelationCandidateInput[]): Promise<AiRelationResult[]>;
  extractEntities(text: string, knownEntities: AiKnownEntity[]): Promise<AiEntityResult[]>;
}

/**
 * 既定のプロバイダー。すべてのメソッドが`AiProviderUnavailableError`を投げる
 * （APIキー未設定・AI無効時の安全な既定動作）。
 */
export class DisabledAiProvider implements ArchiveAiProvider {
  readonly name = "disabled";
  private readonly reason: string;

  constructor(reason = "AI処理が無効です（ARCHIVE_AI_ENABLEDが設定されていません）") {
    this.reason = reason;
  }

  async summarize(): Promise<AiSummaryResult> {
    throw new AiProviderUnavailableError(this.reason);
  }

  async classifyCategories(): Promise<AiCategoryResult[]> {
    throw new AiProviderUnavailableError(this.reason);
  }

  async findRelations(): Promise<AiRelationResult[]> {
    throw new AiProviderUnavailableError(this.reason);
  }

  async extractEntities(): Promise<AiEntityResult[]> {
    throw new AiProviderUnavailableError(this.reason);
  }
}
