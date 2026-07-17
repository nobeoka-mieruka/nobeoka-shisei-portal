import type { CityGuideDepartment } from "../../types/cityGuide";
import { GlobeIcon } from "../icons";

interface ResultCardProps {
  department: CityGuideDepartment;
  onRestart: () => void;
  onShowList: () => void;
}

export function ResultCard({ department, onRestart, onShowList }: ResultCardProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e2 sm:p-6">
        <p className="text-sm font-semibold text-on-primary-container">あなたの相談先はこちら</p>
        <h2 className="mt-2 text-2xl font-bold leading-tight text-on-primary-container sm:text-3xl">
          {department.name}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-on-primary-container/90">{department.shortDescription}</p>

        {department.mainTasks.length > 0 && (
          <p className="mt-3 text-sm leading-relaxed text-on-primary-container/90">
            <span className="font-medium">担当内容：</span>
            {department.mainTasks.join("、")}
          </p>
        )}

        {(department.location ||
          department.phone ||
          department.hours ||
          (department.itemsToBring && department.itemsToBring.length > 0)) && (
          <dl className="mt-4 grid gap-x-4 gap-y-1 text-sm text-on-primary-container/90 sm:grid-cols-2">
            {department.location && (
              <div className="flex gap-1">
                <dt className="font-medium">場所：</dt>
                <dd>
                  {department.location}
                  {department.floor ? `（${department.floor}）` : ""}
                </dd>
              </div>
            )}
            {department.phone && (
              <div className="flex gap-1">
                <dt className="font-medium">電話：</dt>
                <dd>{department.phone}</dd>
              </div>
            )}
            {department.hours && (
              <div className="flex gap-1">
                <dt className="font-medium">受付時間：</dt>
                <dd>{department.hours}</dd>
              </div>
            )}
            {department.itemsToBring && department.itemsToBring.length > 0 && (
              <div className="flex gap-1">
                <dt className="font-medium">持ち物：</dt>
                <dd>{department.itemsToBring.join("、")}</dd>
              </div>
            )}
          </dl>
        )}

        {department.notes && (
          <p className="mt-3 text-xs leading-relaxed text-on-primary-container/80">{department.notes}</p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-on-primary-container/80">
          相談内容によっては、別の課をご案内する場合があります。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-on-primary transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          最初からやり直す
        </button>
        <button
          type="button"
          onClick={onShowList}
          className="rounded-full bg-secondary-container px-5 py-3 text-sm font-medium text-on-secondary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          一覧から探す
        </button>
        {department.officialUrl && (
          <a
            href={department.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${department.name}の公式ページを新しいタブで開く`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-5 py-3 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <GlobeIcon className="h-4 w-4" />
            公式ページを見る
          </a>
        )}
      </div>
    </div>
  );
}
