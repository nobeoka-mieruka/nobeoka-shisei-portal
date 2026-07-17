/**
 * 「延岡市役所 どこに行けばいい？診断」（/city-guide）の診断データ。
 *
 * 質問・選択肢・分岐・担当課情報はすべてこのファイルで管理する。ページ側のコンポーネントには
 * ロジックを直接書かず、ここに項目を追加・修正するだけで診断内容を変更できるようにしている。
 *
 * 電話番号・場所・階数・受付時間・持ち物・公式URLなど、公式資料でまだ確認できていない項目は
 * 省略（undefined）のままにすること。存在しない情報を推測して入力しないこと。
 * officialUrl が未設定の課は、結果画面・一覧画面のどちらでも「公式ページを見る」ボタンが自動的に非表示になる。
 */

import type {
  CityGuideCategory,
  CityGuideDepartment,
  CityGuideLifeEvent,
  CityGuideQuestion,
} from "../types/cityGuide";

export const cityGuideCategories: CityGuideCategory[] = [
  {
    id: "address",
    name: "住所・戸籍・証明書",
    description: "住民票、戸籍、印鑑証明、マイナンバーカードなど",
    icon: "document",
    firstQuestionId: "address-q1",
    order: 1,
  },
  {
    id: "tax",
    name: "税金・保険料",
    description: "市県民税、固定資産税、軽自動車税、納税相談など",
    icon: "yen",
    firstQuestionId: "tax-q1",
    order: 2,
  },
  {
    id: "childcare",
    name: "子育て・学校",
    description: "保育園、妊娠・出産、家庭相談、学校のことなど",
    icon: "child",
    firstQuestionId: "childcare-q1",
    order: 3,
  },
  {
    id: "elderly",
    name: "高齢者・介護",
    description: "介護保険、要介護認定、高齢者の見守りなど",
    icon: "heart",
    firstQuestionId: "elderly-q1",
    order: 4,
  },
  {
    id: "disability",
    name: "障がい・生活の相談",
    description: "障がい者手帳、福祉サービス、生活の困りごとなど",
    icon: "support",
    firstQuestionId: "disability-q1",
    order: 5,
  },
  {
    id: "garbage",
    name: "ごみ・環境",
    description: "ごみの分別・収集、生活環境の相談など",
    icon: "recycle",
    firstQuestionId: "garbage-q1",
    order: 6,
  },
  {
    id: "housing",
    name: "住宅・空き家・道路",
    description: "市営住宅、空き家、道路や側溝のことなど",
    icon: "house",
    firstQuestionId: "housing-q1",
    order: 7,
  },
  {
    id: "water",
    name: "水道・下水道",
    description: "水道・下水道に関する相談",
    icon: "droplet",
    firstQuestionId: "water-q1",
    order: 8,
  },
  {
    id: "work",
    name: "仕事・事業・農業",
    description: "仕事、企業支援、農業・林業・水産業のことなど",
    icon: "briefcase",
    firstQuestionId: "work-q1",
    order: 9,
  },
  {
    id: "disaster",
    name: "防災・災害",
    description: "災害、防災、避難のことなど",
    icon: "alert",
    firstQuestionId: "disaster-q1",
    order: 10,
  },
  {
    id: "unknown",
    name: "どれに当てはまるか分からない",
    description: "相談内容がはっきりしない場合はこちら",
    icon: "question",
    firstQuestionId: null,
    directResultDepartmentId: "general-info",
    order: 11,
  },
];

export const cityGuideQuestions: CityGuideQuestion[] = [
  // 1. 住所・戸籍・証明書
  {
    id: "address-q1",
    text: "住所変更や住民票の手続きですか？",
    choices: [
      { label: "はい", resultDepartmentId: "citizen-affairs" },
      { label: "いいえ", nextQuestionId: "address-q2" },
    ],
  },
  {
    id: "address-q2",
    text: "戸籍、印鑑証明、マイナンバーカードの手続きですか？",
    choices: [
      { label: "はい", resultDepartmentId: "citizen-affairs" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 2. 税金・保険料
  {
    id: "tax-q1",
    text: "市県民税や軽自動車税についてですか？",
    choices: [
      { label: "はい", resultDepartmentId: "resident-tax" },
      { label: "いいえ", nextQuestionId: "tax-q2" },
    ],
  },
  {
    id: "tax-q2",
    text: "固定資産税や土地・家屋についてですか？",
    choices: [
      { label: "はい", resultDepartmentId: "property-tax" },
      { label: "いいえ", nextQuestionId: "tax-q3" },
    ],
  },
  {
    id: "tax-q3",
    text: "税金の納付や納税相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "tax-collection" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 3. 子育て・学校
  {
    id: "childcare-q1",
    text: "保育園、認定こども園、入園についての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "childcare-services" },
      { label: "いいえ", nextQuestionId: "childcare-q2" },
    ],
  },
  {
    id: "childcare-q2",
    text: "妊娠、出産、乳幼児健診、子育てについての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "maternal-child-health" },
      { label: "いいえ", nextQuestionId: "childcare-q3" },
    ],
  },
  {
    id: "childcare-q3",
    text: "子どもや家庭の悩み、虐待、家庭相談についてですか？",
    choices: [
      { label: "はい", resultDepartmentId: "child-family-support" },
      { label: "いいえ", nextQuestionId: "childcare-q4" },
    ],
  },
  {
    id: "childcare-q4",
    text: "小学校や中学校についての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "education-board" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 4. 高齢者・介護
  {
    id: "elderly-q1",
    text: "介護保険や要介護認定についてですか？",
    choices: [
      { label: "はい", resultDepartmentId: "long-term-care-insurance" },
      { label: "いいえ", nextQuestionId: "elderly-q2" },
    ],
  },
  {
    id: "elderly-q2",
    text: "高齢者の見守り、介護予防、認知症などの相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "healthy-longevity" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 5. 障がい・生活の相談
  {
    id: "disability-q1",
    text: "障がい者手帳や障がい福祉サービスについての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "disability-welfare" },
      { label: "いいえ", nextQuestionId: "disability-q2" },
    ],
  },
  {
    id: "disability-q2",
    text: "生活費、生活保護、生活の困りごとについての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "life-welfare" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 6. ごみ・環境
  {
    id: "garbage-q1",
    text: "ごみの分別や収集についてですか？",
    choices: [
      { label: "はい", resultDepartmentId: "resource-management" },
      { label: "いいえ", nextQuestionId: "garbage-q2" },
    ],
  },
  {
    id: "garbage-q2",
    text: "生活環境、騒音、犬や猫などについての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "living-environment" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 7. 住宅・空き家・道路
  {
    id: "housing-q1",
    text: "市営住宅や住宅についての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "building-housing" },
      { label: "いいえ", nextQuestionId: "housing-q2" },
    ],
  },
  {
    id: "housing-q2",
    text: "空き家についての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "vacant-house-office" },
      { label: "いいえ", nextQuestionId: "housing-q3" },
    ],
  },
  {
    id: "housing-q3",
    text: "道路、側溝、河川などについての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "civil-engineering" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 8. 水道・下水道
  {
    id: "water-q1",
    text: "水道や下水道についての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "water-sewage" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 9. 仕事・事業・農業
  {
    id: "work-q1",
    text: "仕事、雇用、企業支援、商工業についての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "commerce-industry" },
      { label: "いいえ", nextQuestionId: "work-q2" },
    ],
  },
  {
    id: "work-q2",
    text: "農業、林業、水産業についての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "agriculture-forestry-fisheries" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },

  // 10. 防災・災害
  {
    id: "disaster-q1",
    text: "災害、防災、避難などについての相談ですか？",
    choices: [
      { label: "はい", resultDepartmentId: "disaster-prevention" },
      { label: "いいえ", resultDepartmentId: "general-info" },
    ],
  },
];

export const cityGuideDepartments: CityGuideDepartment[] = [
  {
    id: "citizen-affairs",
    name: "市民課",
    shortDescription: "転入・転出・転居、住民票、戸籍、印鑑登録、マイナンバーカードなどの手続き窓口です。",
    mainTasks: ["転入", "転出", "転居", "住民票", "戸籍", "印鑑登録", "印鑑証明", "マイナンバーカード"],
    categoryIds: ["address"],
  },
  {
    id: "resident-tax",
    name: "市民税課",
    shortDescription: "市県民税、軽自動車税に関する窓口です。",
    mainTasks: ["市県民税", "軽自動車税"],
    categoryIds: ["tax"],
  },
  {
    id: "property-tax",
    name: "資産税課",
    shortDescription: "固定資産税、土地・家屋の評価に関する窓口です。",
    mainTasks: ["固定資産税", "土地・家屋の評価"],
    categoryIds: ["tax"],
  },
  {
    id: "tax-collection",
    name: "納税課",
    shortDescription: "税金の納付、納税相談に関する窓口です。",
    mainTasks: ["税金の納付", "納税相談"],
    categoryIds: ["tax"],
  },
  {
    id: "childcare-services",
    name: "こども保育課",
    shortDescription: "保育園、認定こども園、入園に関する窓口です。",
    mainTasks: ["保育園", "認定こども園", "入園に関する相談"],
    categoryIds: ["childcare"],
  },
  {
    id: "maternal-child-health",
    name: "おやこ保健福祉課",
    shortDescription: "妊娠、出産、乳幼児健診、子育てに関する窓口です。",
    mainTasks: ["妊娠・出産の相談", "乳幼児健診", "子育て相談"],
    categoryIds: ["childcare"],
  },
  {
    id: "child-family-support",
    name: "こども家庭サポートセンター",
    shortDescription: "子どもや家庭の悩み、虐待、家庭相談に関する窓口です。",
    mainTasks: ["子どもや家庭の悩み相談", "虐待に関する相談", "家庭相談"],
    categoryIds: ["childcare"],
  },
  {
    id: "education-board",
    name: "教育委員会関係の案内",
    shortDescription: "小学校・中学校に関する相談は、教育委員会の関係課にご案内します。",
    mainTasks: ["小学校・中学校に関する相談"],
    categoryIds: ["childcare"],
  },
  {
    id: "long-term-care-insurance",
    name: "介護保険課",
    shortDescription: "介護保険、要介護認定に関する窓口です。",
    mainTasks: ["介護保険", "要介護認定"],
    categoryIds: ["elderly"],
  },
  {
    id: "healthy-longevity",
    name: "健康長寿課",
    shortDescription: "高齢者の見守り、介護予防、認知症に関する相談窓口です。",
    mainTasks: ["高齢者の見守り", "介護予防", "認知症に関する相談"],
    categoryIds: ["elderly"],
  },
  {
    id: "disability-welfare",
    name: "障がい福祉課",
    shortDescription: "障がい者手帳、障がい福祉サービスに関する窓口です。",
    mainTasks: ["障がい者手帳", "障がい福祉サービス"],
    categoryIds: ["disability"],
  },
  {
    id: "life-welfare",
    name: "生活福祉課",
    shortDescription: "生活費、生活保護、生活の困りごとに関する窓口です。",
    mainTasks: ["生活費の相談", "生活保護", "生活の困りごと相談"],
    categoryIds: ["disability"],
  },
  {
    id: "resource-management",
    name: "資源対策課",
    shortDescription: "ごみの分別、ごみの収集に関する窓口です。",
    mainTasks: ["ごみの分別", "ごみの収集"],
    categoryIds: ["garbage"],
  },
  {
    id: "living-environment",
    name: "生活環境課",
    shortDescription: "生活環境、騒音、犬や猫に関する相談窓口です。",
    mainTasks: ["生活環境の相談", "騒音に関する相談", "犬や猫に関する相談"],
    categoryIds: ["garbage"],
  },
  {
    id: "building-housing",
    name: "建築住宅課",
    shortDescription: "市営住宅、住宅に関する相談窓口です。",
    mainTasks: ["市営住宅", "住宅に関する相談"],
    categoryIds: ["housing"],
  },
  {
    id: "vacant-house-office",
    name: "空家施策推進室",
    shortDescription: "空き家に関する相談窓口です。",
    mainTasks: ["空き家に関する相談"],
    categoryIds: ["housing"],
  },
  {
    id: "civil-engineering",
    name: "土木課",
    shortDescription: "道路、側溝、河川に関する相談窓口です。",
    mainTasks: ["道路に関する相談", "側溝に関する相談", "河川に関する相談"],
    categoryIds: ["housing"],
  },
  {
    id: "water-sewage",
    name: "上下水道関係窓口",
    shortDescription: "水道、下水道に関する相談窓口です。",
    mainTasks: ["水道に関する相談", "下水道に関する相談"],
    categoryIds: ["water"],
  },
  {
    id: "commerce-industry",
    name: "商工関係窓口",
    shortDescription: "仕事・雇用、企業支援、商工業に関する相談窓口です。",
    mainTasks: ["仕事・雇用の相談", "企業支援", "商工業に関する相談"],
    categoryIds: ["work"],
  },
  {
    id: "agriculture-forestry-fisheries",
    name: "農林水産関係窓口",
    shortDescription: "農業、林業、水産業に関する相談窓口です。",
    mainTasks: ["農業に関する相談", "林業に関する相談", "水産業に関する相談"],
    categoryIds: ["work"],
  },
  {
    id: "disaster-prevention",
    name: "防災関係窓口",
    shortDescription: "災害、防災、避難に関する相談窓口です。",
    mainTasks: ["災害に関する相談", "防災に関する相談", "避難に関する相談"],
    categoryIds: ["disaster"],
  },
  {
    id: "general-info",
    name: "総合案内",
    shortDescription:
      "相談内容がはっきりしない場合は、まず総合案内にご相談ください。内容を確認し、担当する窓口をご案内します。",
    mainTasks: ["相談内容の確認", "担当窓口のご案内"],
    categoryIds: ["unknown"],
  },
];

/**
 * 将来のライフイベント別案内（結婚、出生、引っ越し、死亡、就職、介護開始など）用のデータ。
 * 現時点では未実装のため空配列のままにしている。
 */
export const cityGuideLifeEvents: CityGuideLifeEvent[] = [];
