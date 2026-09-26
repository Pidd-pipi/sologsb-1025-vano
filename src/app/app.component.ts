import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NbAlertModule,
  NbBadgeModule,
  NbButtonModule,
  NbCardModule,
  NbCheckboxModule,
  NbIconModule,
  NbInputModule,
  NbLayoutModule,
  NbOptionModule,
  NbSelectModule,
  NbTabsetModule,
  NbToastrModule,
  NbToastrService
} from '@nebular/theme';

type WorkspaceView = 'compose' | 'checks' | 'review' | 'versions';
type ReviewStatus = 'pending' | 'approved' | 'changes';
type NoticeStatus = 'draft' | 'in-review' | 'locked';
type CheckLevel = 'error' | 'warning' | 'info';
type SnapshotType = 'normal' | 'emergency' | 'correction';

interface LanguageVersion {
  id: string;
  locale: string;
  name: string;
  title: string;
  body: string;
  translator: string;
  reviewed: boolean;
}

interface Discussion {
  id: string;
  languageId: string;
  sentenceIndex: number;
  author: string;
  role: string;
  text: string;
  createdAt: string;
  resolved: boolean;
}

interface RoleReview {
  role: '编辑' | '法务' | '翻译' | '发布人';
  owner: string;
  status: ReviewStatus;
  note: string;
}

interface ActiveCorrection {
  /** 被更正原稿（锁定快照）的编号 */
  sourceVersionId: string;
  /** 原稿通知编号，如 NO-20260926-001 */
  sourceNo: string;
  /** 更正文编号，如 NO-20260926-001-C1 */
  correctionNo: string;
  /** 本次更正需要补发的受影响渠道 */
  channels: string[];
  /** 发起更正时填写的原因 */
  reason: string;
  startedAt: string;
}

interface VersionSnapshot {
  id: string;
  label: string;
  createdAt: string;
  version: string;
  /** 业务通知编号，锁定后用于渠道补发与更正向溯源 */
  noticeNo?: string;
  title: string;
  severity: string;
  scope: string;
  eventAt: string;
  effectiveAt: string;
  expiresAt: string;
  channels: string[];
  languages: LanguageVersion[];
  note: string;
  emergency: boolean;
  type: SnapshotType;
  /** 更正快照：被更正原稿的快照 id */
  sourceVersionId?: string;
  /** 更正快照：被更正原稿的通知编号 */
  sourceNo?: string;
  /** 更正快照：更正文编号 */
  correctionNo?: string;
  /** 更正快照：本次补发渠道与更正原因 */
  correctionChannels?: string[];
  correctionReason?: string;
}

interface NoticeDraft {
  id: string;
  title: string;
  eventType: string;
  severity: string;
  scope: string;
  channels: string[];
  eventAt: string;
  effectiveAt: string;
  expiresAt: string;
  requiredLocales: string[];
  languages: LanguageVersion[];
  discussions: Discussion[];
  reviews: RoleReview[];
  versions: VersionSnapshot[];
  status: NoticeStatus;
  version: string;
  lockedAt?: string;
  emergencyRevision: boolean;
  /** 未完成的更正稿；同一原稿同时至多一份 */
  correction?: ActiveCorrection;
  updatedAt: string;
}

interface CheckResult {
  id: string;
  category: string;
  level: CheckLevel;
  title: string;
  detail: string;
}

interface DiffRow {
  left: string;
  right: string;
  kind: 'same' | 'changed' | 'added' | 'removed';
}

interface NoticeTemplate {
  id: string;
  name: string;
  description: string;
  eventType: string;
  severity: string;
  scope: string;
  channels: string[];
  title: Record<string, string>;
  body: Record<string, string>;
}

const STORAGE_KEY = 'sologsb-1025-emergency-notice-v1';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function initialDraft(): NoticeDraft {
  const first: VersionSnapshot = {
    id: 'version-1-0-0',
    label: '首次发布稿',
    createdAt: '2026-09-23T08:10:00+08:00',
    version: '1.0.0',
    noticeNo: 'NO-20260923-001',
    title: '台风“海燕”橙色预警通知',
    scope: '滨海新区沿海街道',
    severity: '橙色',
    eventAt: '2026-09-23T07:30:00+08:00',
    effectiveAt: '2026-09-23T09:00:00+08:00',
    expiresAt: '2026-09-24T08:00:00+08:00',
    channels: ['短信', '广播', '社区大屏'],
    note: '发布范围覆盖滨海新区。',
    emergency: false,
    type: 'normal',
    languages: [
      {
        id: 'zh-CN', locale: 'zh-CN', name: '简体中文', title: '台风“海燕”橙色预警通知',
        body: '请滨海新区居民立即停止户外活动。预计今天下午出现强风和暴雨。请远离临时建筑，并关注后续通知。',
        translator: '林晓', reviewed: true
      },
      {
        id: 'en', locale: 'en', name: 'English', title: 'Orange alert for Typhoon Haiyan',
        body: 'Residents in Binhai New Area should stop outdoor activities immediately. Strong winds and heavy rain are expected this afternoon. Stay away from temporary structures and monitor further notices.',
        translator: '周晴', reviewed: true
      }
    ]
  };

  const second: VersionSnapshot = {
    ...clone(first),
    id: 'version-1-1-0',
    label: '扩大影响范围',
    createdAt: '2026-09-24T10:35:00+08:00',
    version: '1.1.0',
    noticeNo: 'NO-20260924-001',
    title: '台风“海燕”橙色预警及人员转移通知',
    scope: '滨海新区全区，重点为沿海街道',
    note: '增加沿海街道转移要求。',
    emergency: false,
    type: 'normal',
    languages: [
      {
        ...clone(first.languages[0]),
        id: 'zh-CN',
        title: '台风“海燕”橙色预警及人员转移通知',
        body: '请滨海新区居民立即停止户外活动。沿海街道居民请于今日17时前转移至就近安置点。预计今天下午出现强风和暴雨。请远离临时建筑，并关注后续通知。'
      } as LanguageVersion,
      {
        ...clone(first.languages[1]),
        id: 'en',
        title: 'Orange alert and evacuation notice for Typhoon Haiyan',
        body: 'Residents in Binhai New Area should stop outdoor activities immediately. Residents of coastal subdistricts must move to the nearest shelter before 17:00 today. Strong winds and heavy rain are expected this afternoon. Stay away from temporary structures and monitor further notices.'
      } as LanguageVersion
    ]
  };

  return {
    id: 'notice-haiyan-2026',
    title: '台风“海燕”橙色预警及人员转移通知',
    eventType: '台风',
    severity: '橙色',
    scope: '滨海新区全区，重点为沿海街道',
    channels: ['短信', '广播', '社区大屏', '政务新媒体'],
    eventAt: '2026-09-25T07:30',
    effectiveAt: '2026-09-25T09:00',
    expiresAt: '2026-09-26T08:00',
    requiredLocales: ['zh-CN', 'en', 'ja'],
    languages: [
      {
        id: 'zh-CN', locale: 'zh-CN', name: '简体中文', title: '台风“海燕”橙色预警及人员转移通知',
        body: '请滨海新区居民立即停止户外活动。沿海街道居民请于今日17时前转移至就近安置点。预计今天下午出现强风和暴雨。不要停留在临时建筑附近，并持续关注后续通知。',
        translator: '林晓', reviewed: true
      },
      {
        id: 'en', locale: 'en', name: 'English', title: 'Orange alert and evacuation notice for Typhoon Haiyan',
        body: 'Residents in Binhai New Area should stop outdoor activities immediately. Residents of coastal subdistricts must move to the nearest shelter before 17:00 today. Strong winds and heavy rain are expected this afternoon. Keep away from temporary buildings and continue to monitor further notices.',
        translator: '周晴', reviewed: true
      },
      {
        id: 'ja', locale: 'ja', name: '日本語', title: '台風「ハイエン」オレンジ警報',
        body: '浜海新区の住民は直ちに屋外活動を中止してください。本日午後、強風と大雨が見込まれます。仮設建物に近づかず、今後の通知を確認してください。',
        translator: '佐藤 明', reviewed: false
      }
    ],
    discussions: [
      {
        id: 'comment-1', languageId: 'zh-CN', sentenceIndex: 1, author: '陈冉', role: '法务审阅',
        text: '建议明确安置点地址由属地另行发送，避免通知被理解为完整点位清单。', createdAt: '2026-09-25T08:16:00+08:00', resolved: false
      }
    ],
    reviews: [
      { role: '编辑', owner: '林晓', status: 'approved', note: '事件要素完整。' },
      { role: '法务', owner: '陈冉', status: 'changes', note: '转移表述需补充依据。' },
      { role: '翻译', owner: '周晴', status: 'pending', note: '等待日文版复核。' },
      { role: '发布人', owner: '值班中心', status: 'pending', note: '' }
    ],
    versions: [first, second],
    status: 'in-review',
    version: '1.2.0-draft',
    emergencyRevision: false,
    updatedAt: new Date().toISOString()
  };
}

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'typhoon', name: '台风人员转移', description: '适用于沿海区域人员转移和停业停课提醒。',
    eventType: '台风', severity: '橙色', scope: '沿海街道', channels: ['短信', '广播', '社区大屏'],
    title: { 'zh-CN': '台风预警及人员转移通知', en: 'Typhoon alert and evacuation notice', ja: '台風警報・避難のお知らせ' },
    body: {
      'zh-CN': '请相关区域居民立即停止户外活动。危险区域人员请按属地安排转移至安全场所。预计将出现强风和暴雨，请远离临时建筑并关注后续通知。',
      en: 'Residents in the affected area should stop outdoor activities immediately. People in high-risk areas must follow local evacuation arrangements. Strong winds and heavy rain are expected. Stay away from temporary structures and monitor further notices.',
      ja: '対象地域の住民は直ちに屋外活動を中止してください。危険地域の方は自治体の避難指示に従ってください。強風と大雨が見込まれます。仮設建物に近づかず、今後の通知を確認してください。'
    }
  },
  {
    id: 'water', name: '供水异常', description: '适用于计划停水和恢复供水通知。',
    eventType: '公共设施', severity: '黄色', scope: '城市供水片区', channels: ['短信', '政务新媒体'],
    title: { 'zh-CN': '计划停水通知', en: 'Planned water service interruption', ja: '断水のお知らせ' },
    body: {
      'zh-CN': '因管网维护，相关区域将于指定时间暂停供水。请提前储水并关闭用水设备。恢复供水后可能出现短时浑浊，请排放后再使用。',
      en: 'Water service will be temporarily suspended for network maintenance. Please store water in advance and close water fixtures. Water may appear cloudy when service resumes; run the tap before use.',
      ja: '管路保守作業のため、対象地域では一時的に断水します。事前に水を確保し、水道設備を閉めてください。復旧後は濁りが生じる場合があるため、しばらく通水してから使用してください。'
    }
  },
  {
    id: 'public-safety', name: '公共安全提醒', description: '适用于大型活动周边临时管控。',
    eventType: '公共安全', severity: '黄色', scope: '活动周边道路', channels: ['广播', '社区大屏', '政务新媒体'],
    title: { 'zh-CN': '大型活动期间临时交通提醒', en: 'Temporary traffic notice during major event', ja: '大規模イベント期間中の交通規制' },
    body: {
      'zh-CN': '活动期间部分道路将采取临时管控措施。请服从现场指引，合理规划出行路线，非必要不前往管控区域。',
      en: 'Temporary traffic controls will be in place during the event. Follow on-site directions, plan your route, and avoid restricted areas unless necessary.',
      ja: 'イベント期間中、一部道路で交通規制を行います。現場の案内に従い、移動経路を事前に確認してください。不要な場合は規制区域への立入りを控えてください。'
    }
  }
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NbLayoutModule,
    NbCardModule,
    NbButtonModule,
    NbInputModule,
    NbSelectModule,
    NbOptionModule,
    NbCheckboxModule,
    NbTabsetModule,
    NbIconModule,
    NbBadgeModule,
    NbAlertModule,
    NbToastrModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly templates = TEMPLATES;
  readonly eventTypes = ['台风', '暴雨', '地震', '公共卫生', '公共设施', '公共安全'];
  readonly severities = ['蓝色', '黄色', '橙色', '红色'];
  readonly channelOptions = ['短信', '广播', '社区大屏', '政务新媒体', '应急喇叭', '网站'];
  readonly locales = [
    { id: 'zh-CN', name: '简体中文' },
    { id: 'en', name: 'English' },
    { id: 'ja', name: '日本語' },
    { id: 'ko', name: '한국어' },
    { id: 'es', name: 'Español' }
  ];
  readonly bannedTerms = ['大概', '可能吧', '无需恐慌', '绝对不会', '保证安全'];
  readonly glossary = [
    { canonical: '立即', variants: ['马上', '赶紧'] },
    { canonical: '安置点', variants: ['避难所', '庇护所'] },
    { canonical: '持续关注', variants: ['随时留意', '保持观看'] }
  ];
  readonly roles: RoleReview['role'][] = ['编辑', '法务', '翻译', '发布人'];

  draft: NoticeDraft = initialDraft();
  activeView: WorkspaceView = 'compose';
  selectedLanguageId = 'zh-CN';
  selectedSentenceIndex = 0;
  selectedTemplateId = 'typhoon';
  discussionText = '';
  currentRole: RoleReview['role'] = '编辑';
  compareBaseId = '';
  compareTargetId = '';
  lastSavedAt = '';
  history: NoticeDraft[] = [];
  future: NoticeDraft[] = [];

  /** 更正发起表单 */
  correctionChannelSelection: Record<string, boolean> = {};
  correctionReason = '';
  correctionFormError = '';

  constructor(private readonly toastr: NbToastrService) {}

  ngOnInit(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.draft = this.migrate(JSON.parse(saved) as NoticeDraft);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        this.draft = initialDraft();
      }
    }
    this.compareBaseId = this.draft.versions.at(-2)?.id ?? '';
    this.compareTargetId = this.draft.versions.at(-1)?.id ?? '';
    this.lastSavedAt = this.formatDateTime(this.draft.updatedAt);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier) return;
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? this.redo() : this.undo();
    } else if (event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.saveNow();
      this.toastr.success('草稿已保存在当前浏览器。', '保存成功');
    }
  }

  get selectedLanguage(): LanguageVersion {
    return this.draft.languages.find((language) => language.id === this.selectedLanguageId) ?? this.draft.languages[0];
  }

  get selectedTemplateDescription(): string {
    return this.templates.find((template) => template.id === this.selectedTemplateId)?.description ?? '请选择一个模板';
  }

  get unresolvedDiscussionCount(): number {
    return this.draft.discussions.filter((discussion) => !discussion.resolved).length;
  }

  get currentSentences(): string[] {
    return this.splitSentences(this.selectedLanguage?.body ?? '');
  }

  get activeDiscussions(): Discussion[] {
    return this.draft.discussions.filter((discussion) => discussion.languageId === this.selectedLanguageId);
  }

  get checks(): CheckResult[] {
    const checks: CheckResult[] = [];
    const requiredMeta: Array<[string, string]> = [
      ['标题', this.draft.title], ['事件类型', this.draft.eventType], ['严重程度', this.draft.severity],
      ['影响范围', this.draft.scope], ['事件时间', this.draft.eventAt], ['生效时间', this.draft.effectiveAt],
      ['失效时间', this.draft.expiresAt]
    ];
    requiredMeta.filter(([, value]) => !value).forEach(([label]) => checks.push({
      id: `meta-${label}`, category: '必填信息', level: 'error', title: `缺少${label}`,
      detail: `请补全通知的${label}后再提交发布。`
    }));
    if (!this.draft.channels.length) checks.push({
      id: 'channels', category: '发布渠道', level: 'error', title: '未选择目标渠道', detail: '至少选择一个目标发布渠道。'
    });

    if (this.isCorrecting) {
      const correction = this.activeCorrection!;
      this.missingCorrectionChannels.forEach((channel) => checks.push({
        id: `correction-channel-${channel}`, category: '更正补发', level: 'error',
        title: `更正稿未覆盖补发渠道「${channel}」`,
        detail: `渠道「${channel}」在发起更正时被列为受影响渠道，请在目标渠道中补齐后再锁定更正文（来源 ${correction.sourceNo}）。`
      }));
      this.missingCorrectionLocales.forEach((locale) => {
        const name = this.locales.find((item) => item.id === locale)?.name ?? locale;
        checks.push({
          id: `correction-locale-${locale}`, category: '更正补发', level: 'error',
          title: `更正稿必需语言「${name}」未补齐`,
          detail: `发起更正时该语言属于必需语言，请补全标题与正文后再锁定更正文（来源 ${correction.sourceNo}）。`
        });
      });
    }

    this.draft.requiredLocales.forEach((locale) => {
      if (!this.draft.languages.some((language) => language.id === locale)) {
        const name = this.locales.find((item) => item.id === locale)?.name ?? locale;
        checks.push({
          id: `missing-${locale}`, category: '语言完整性', level: 'error', title: `${name}版本缺失`,
          detail: '该语言属于本次发布的必需语言，请添加并完成翻译。'
        });
      }
    });

    this.draft.languages.forEach((language) => {
      if (!language.title.trim() || !language.body.trim()) checks.push({
        id: `required-${language.id}`, category: '必填信息', level: 'error', title: `${language.name}内容不完整`,
        detail: '语言版本必须包含标题和正文。'
      });
      if (!language.reviewed) checks.push({
        id: `review-${language.id}`, category: '版本审阅', level: language.id === 'ja' ? 'warning' : 'info',
        title: `${language.name}尚未完成语言复核`, detail: '发布前应确认措辞、术语和本地化表达。'
      });
      const banned = this.bannedTerms.filter((term) => language.body.includes(term));
      if (banned.length) checks.push({
        id: `banned-${language.id}`, category: '禁用词', level: 'error', title: `${language.name}包含禁用词`,
        detail: `请替换：${banned.join('、')}。`
      });
      const inconsistent = this.glossary.filter((entry) => {
        const variantCount = entry.variants.filter((variant) => language.body.includes(variant)).length;
        return variantCount > 0 && (!language.body.includes(entry.canonical) || variantCount > 1);
      });
      if (inconsistent.length) checks.push({
        id: `term-${language.id}`, category: '术语一致性', level: 'warning', title: `${language.name}术语不统一`,
        detail: inconsistent.map((item) => `统一使用“${item.canonical}”，避免“${item.variants.join('、')}”`).join('；')
      });
    });

    const eventAt = this.toTime(this.draft.eventAt);
    const effectiveAt = this.toTime(this.draft.effectiveAt);
    const expiresAt = this.toTime(this.draft.expiresAt);
    if (eventAt && effectiveAt && effectiveAt < eventAt) checks.push({
      id: 'time-effective', category: '时间冲突', level: 'warning', title: '生效时间早于事件时间',
      detail: '请确认这是预防性通知；否则调整事件时间或生效时间。'
    });
    if (effectiveAt && expiresAt && expiresAt <= effectiveAt) checks.push({
      id: 'time-expires', category: '时间冲突', level: 'error', title: '失效时间早于生效时间',
      detail: '通知有效期必须晚于生效时间。'
    });
    const unresolved = this.draft.discussions.filter((discussion) => !discussion.resolved).length;
    if (unresolved) checks.push({
      id: 'discussions', category: '逐句讨论', level: 'warning', title: `${unresolved} 条讨论尚未解决`,
      detail: '发布前请处理或明确忽略未解决讨论。'
    });
    return checks;
  }

  get blockingChecks(): CheckResult[] {
    return this.checks.filter((check) => check.level === 'error');
  }

  get warningCount(): number {
    return this.checks.filter((check) => check.level === 'warning').length;
  }

  get isLocked(): boolean {
    return this.draft.status === 'locked';
  }

  get isCorrecting(): boolean {
    return !!this.draft.correction && !this.isLocked;
  }

  get activeCorrection(): ActiveCorrection | undefined {
    return this.isCorrecting ? this.draft.correction : undefined;
  }

  /** 当前锁定的原稿快照 */
  get lockedSnapshot(): VersionSnapshot | undefined {
    return this.draft.versions.at(-1);
  }

  /** 更正稿对应的原稿快照 */
  get correctionSource(): VersionSnapshot | undefined {
    const correction = this.draft.correction;
    if (!correction) return undefined;
    return this.draft.versions.find((version) => version.id === correction.sourceVersionId);
  }

  /** 发起更正表单中勾选的补发渠道 */
  get selectedCorrectionChannels(): string[] {
    return this.channelOptions.filter((channel) => this.correctionChannelSelection[channel]);
  }

  /** 锁定原稿是否已存在未完成更正（同一原稿至多一份） */
  get lockedSourceHasOpenCorrection(): boolean {
    const locked = this.lockedSnapshot;
    return !!locked && !!this.draft.correction && this.draft.correction.sourceVersionId === locked.id;
  }

  /** 更正稿尚未补齐的必需补发渠道 */
  get missingCorrectionChannels(): string[] {
    const correction = this.activeCorrection;
    if (!correction) return [];
    return correction.channels.filter((channel) => !this.draft.channels.includes(channel));
  }

  /** 更正稿尚未补齐内容的必需语言 */
  get missingCorrectionLocales(): string[] {
    const correction = this.activeCorrection;
    if (!correction) return [];
    return this.draft.requiredLocales.filter((locale) => {
      const language = this.draft.languages.find((item) => item.id === locale);
      return !language || !language.title.trim() || !language.body.trim();
    });
  }

  /** 更正稿是否允许重新锁定：受影响渠道与必需语言全部补齐 */
  get correctionReadyToLock(): boolean {
    return this.isCorrecting
      && this.missingCorrectionChannels.length === 0
      && this.missingCorrectionLocales.length === 0;
  }

  /** 自动生成的更正文（随更正文一起发出，明确本次更正针对哪条原稿） */
  get correctionNoticeText(): string {
    const correction = this.activeCorrection;
    if (!correction) return '';
    const language = this.draft.languages.find((item) => item.id === this.selectedLanguageId) ?? this.draft.languages[0];
    return [
      `【更正通知 ${correction.correctionNo}】`,
      `本通知为原稿 ${correction.sourceNo}（${this.correctionSource?.title ?? ''}）的更正稿，原通知相关内容以本稿为准。`,
      `更正原因：${correction.reason}`,
      `补发渠道：${correction.channels.join('、')}。`,
      language ? `更正后标题：${language.title}` : '',
      language ? `更正后正文：${language.body}` : ''
    ].filter(Boolean).join('\n');
  }

  get allReviewsApproved(): boolean {
    return this.draft.reviews.every((review) => review.status === 'approved');
  }

  get hasIncompleteReviews(): boolean {
    return this.draft.reviews.some((review) => review.status !== 'approved');
  }

  isSentenceDiscussed(index: number): boolean {
    return this.activeDiscussions.some((discussion) => discussion.sentenceIndex === index && !discussion.resolved);
  }

  get nextVersion(): string {
    const numbers = this.draft.version.match(/\d+/g)?.map(Number) ?? [1, 2, 0];
    return `${numbers[0] || 1}.${(numbers[1] || 0) + 1}.0`;
  }

  get versionDiff(): DiffRow[] {
    const base = this.draft.versions.find((version) => version.id === this.compareBaseId);
    const target = this.draft.versions.find((version) => version.id === this.compareTargetId);
    if (!base || !target) return [];
    const baseLanguage = base.languages.find((language) => language.id === this.selectedLanguageId);
    const targetLanguage = target.languages.find((language) => language.id === this.selectedLanguageId);
    return this.diffSentences(this.splitSentences(baseLanguage?.body ?? ''), this.splitSentences(targetLanguage?.body ?? ''));
  }

  get diffTargetVersion(): VersionSnapshot | undefined {
    return this.draft.versions.find((version) => version.id === this.compareTargetId);
  }

  updateMeta(field: 'title' | 'eventType' | 'severity' | 'scope' | 'eventAt' | 'effectiveAt' | 'expiresAt', value: string): void {
    this.commit((draft) => {
      (draft as unknown as Record<string, unknown>)[field] = value;
      draft.status = draft.status === 'locked' ? 'draft' : draft.status;
    });
  }

  toggleChannel(channel: string, checked: boolean): void {
    this.commit((draft) => {
      draft.channels = checked ? [...new Set([...draft.channels, channel])] : draft.channels.filter((item) => item !== channel);
    });
  }

  toggleRequiredLocale(locale: string, checked: boolean): void {
    this.commit((draft) => {
      draft.requiredLocales = checked
        ? [...new Set([...draft.requiredLocales, locale])]
        : draft.requiredLocales.filter((item) => item !== locale);
    });
  }

  updateLanguage(field: 'title' | 'body' | 'translator', value: string): void {
    this.commit((draft) => {
      const language = draft.languages.find((item) => item.id === this.selectedLanguageId);
      if (language) language[field] = value;
    });
  }

  setLanguageReviewed(checked: boolean): void {
    this.commit((draft) => {
      const language = draft.languages.find((item) => item.id === this.selectedLanguageId);
      if (language) language.reviewed = checked;
    });
  }

  get addableLocales(): { id: string; name: string }[] {
    return this.locales.filter((locale) => !this.draft.languages.some((language) => language.id === locale.id));
  }

  addLanguage(localeId: string): void {
    const locale = this.locales.find((item) => item.id === localeId);
    if (!locale || this.isLocked) return;
    this.commit((draft) => {
      draft.languages.push({
        id: locale.id, locale: locale.id, name: locale.name,
        title: '', body: '', translator: this.currentRole === '翻译' ? '周晴' : '待分配', reviewed: false
      });
    });
    this.selectedLanguageId = locale.id;
    this.toastr.info(`已添加${locale.name}版本，请补全标题与正文。`, '语言版本');
  }

  selectSentence(index: number): void {
    this.selectedSentenceIndex = index;
  }

  addDiscussion(): void {
    const text = this.discussionText.trim();
    if (!text || this.isLocked) return;
    this.commit((draft) => {
      draft.discussions.push({
        id: uid('discussion'), languageId: this.selectedLanguageId, sentenceIndex: this.selectedSentenceIndex,
        author: this.currentRole === '法务' ? '陈冉' : this.currentRole === '翻译' ? '周晴' : '林晓',
        role: `${this.currentRole}审阅`, text, createdAt: new Date().toISOString(), resolved: false
      });
    });
    this.discussionText = '';
    this.toastr.success('讨论已绑定到当前句。', '已添加');
  }

  toggleDiscussion(discussionId: string): void {
    this.commit((draft) => {
      const item = draft.discussions.find((discussion) => discussion.id === discussionId);
      if (item) item.resolved = !item.resolved;
    });
  }

  setReviewStatus(role: RoleReview['role'], status: ReviewStatus): void {
    this.commit((draft) => {
      const review = draft.reviews.find((item) => item.role === role);
      if (review) review.status = status;
    });
  }

  setReviewNote(role: RoleReview['role'], note: string): void {
    this.commit((draft) => {
      const review = draft.reviews.find((item) => item.role === role);
      if (review) review.note = note;
    });
  }

  applyTemplate(): void {
    const template = this.templates.find((item) => item.id === this.selectedTemplateId);
    if (!template || this.isLocked || this.isCorrecting) return;
    this.commit((draft) => {
      draft.eventType = template.eventType;
      draft.severity = template.severity;
      draft.scope = template.scope;
      draft.channels = [...template.channels];
      draft.languages.forEach((language) => {
        language.title = template.title[language.id] ?? language.title;
        language.body = template.body[language.id] ?? language.body;
        language.reviewed = false;
      });
    });
    this.toastr.success(`已应用“${template.name}”模板，请根据事件信息调整。`, '模板复用');
  }

  lockVersion(): void {
    if (this.blockingChecks.length) {
      this.toastr.warning(`仍有 ${this.blockingChecks.length} 项阻断问题，不能锁定。`, '发布检查未通过');
      this.activeView = 'checks';
      return;
    }
    const correcting = this.isCorrecting;
    const correction = correcting ? this.activeCorrection! : undefined;
    if (correcting && !this.correctionReadyToLock) {
      this.toastr.warning('受影响渠道或必需语言尚未补齐，更正稿不能锁定。', '更正未完成');
      this.activeView = 'checks';
      return;
    }

    const now = new Date().toISOString();
    let nextVersion: string;
    let snapshotType: SnapshotType;
    if (correcting) {
      nextVersion = this.correctionNextVersion;
      snapshotType = 'correction';
    } else {
      nextVersion = this.nextVersion;
      snapshotType = this.draft.emergencyRevision ? 'emergency' : 'normal';
    }

    const snapshot: VersionSnapshot = {
      id: uid('version'),
      label: correcting ? '更正文' : this.draft.emergencyRevision ? '紧急修订版本' : '最终锁定版本',
      createdAt: now,
      version: nextVersion,
      noticeNo: correcting ? correction!.correctionNo : this.buildNoticeNo(now),
      title: this.draft.title, severity: this.draft.severity, scope: this.draft.scope, eventAt: this.draft.eventAt,
      effectiveAt: this.draft.effectiveAt, expiresAt: this.draft.expiresAt, channels: [...this.draft.channels],
      languages: clone(this.draft.languages),
      note: correcting
        ? `更正原稿 ${correction!.sourceNo}：${correction!.reason}`
        : this.draft.emergencyRevision ? '紧急修订后重新检查并锁定。' : '发布前检查通过并锁定。',
      emergency: !correcting && this.draft.emergencyRevision,
      type: snapshotType,
      sourceVersionId: correcting ? correction!.sourceVersionId : undefined,
      sourceNo: correcting ? correction!.sourceNo : undefined,
      correctionNo: correcting ? correction!.correctionNo : undefined,
      correctionChannels: correcting ? [...correction!.channels] : undefined,
      correctionReason: correcting ? correction!.reason : undefined
    };
    this.commit((draft) => {
      draft.versions.push(snapshot);
      draft.version = snapshot.version;
      draft.status = 'locked';
      draft.lockedAt = snapshot.createdAt;
      draft.emergencyRevision = false;
      draft.correction = undefined;
    });
    this.compareBaseId = correcting ? correction!.sourceVersionId : (this.draft.versions.at(-2)?.id ?? '');
    this.compareTargetId = this.draft.versions.at(-1)?.id ?? '';
    this.toastr.success(
      correcting ? `更正文 ${snapshot.noticeNo} 已锁定，可在版本链对照原稿 ${correction!.sourceNo}。` : `版本 ${snapshot.version} 已锁定。`,
      correcting ? '更正已发布' : '最终版本已冻结'
    );
  }

  /** 更正稿版本号：在原稿版本上递增修订位 */
  get correctionNextVersion(): string {
    const source = this.correctionSource;
    const base = source?.version ?? this.draft.version.split('-')[0];
    const [major = 1, minor = 0, patch = 0] = base.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  startEmergencyRevision(): void {
    if (this.isCorrecting) {
      this.toastr.warning('当前更正稿尚未完成，不能再发起紧急修订。', '操作受限');
      return;
    }
    const baseVersion = this.draft.version.split('-')[0];
    const [major = 1, minor = 0] = baseVersion.split('.').map(Number);
    this.commit((draft) => {
      draft.status = 'draft';
      draft.emergencyRevision = true;
      draft.version = `${major}.${minor + 1}.0-emergency`;
      draft.lockedAt = undefined;
    });
    this.activeView = 'compose';
    this.toastr.warning('已创建紧急修订稿；锁定版本仍完整保留。', '进入紧急修订');
  }

  /** 初始化发起更正表单：默认勾选原稿全部渠道 */
  prepareCorrectionForm(): void {
    const source = this.lockedSnapshot;
    this.correctionChannelSelection = {};
    this.channelOptions.forEach((channel) => {
      this.correctionChannelSelection[channel] = !!source?.channels.includes(channel);
    });
    this.correctionReason = '';
    this.correctionFormError = '';
  }

  toggleCorrectionFormChannel(channel: string, checked: boolean): void {
    this.correctionChannelSelection = { ...this.correctionChannelSelection, [channel]: checked };
    this.correctionFormError = '';
  }

  /** 发起更正：选择受影响渠道、填写原因，生成带来源编号的更正文 */
  confirmStartCorrection(): void {
    if (!this.isLocked || !this.lockedSnapshot) return;
    if (this.lockedSourceHasOpenCorrection) {
      this.correctionFormError = '该原稿已有一份未完成的更正稿，完成或放弃后才能再次发起。';
      return;
    }
    const channels = this.selectedCorrectionChannels;
    const reason = this.correctionReason.trim();
    if (!channels.length) {
      this.correctionFormError = '请至少选择一个需要补发的受影响渠道。';
      return;
    }
    if (!reason) {
      this.correctionFormError = '请填写更正原因（如影响范围或停水时间有误）。';
      return;
    }
    const source = this.lockedSnapshot;
    const correction: ActiveCorrection = {
      sourceVersionId: source.id,
      sourceNo: source.noticeNo ?? this.buildNoticeNo(source.createdAt),
      correctionNo: this.buildCorrectionNo(source),
      channels,
      reason,
      startedAt: new Date().toISOString()
    };
    this.commit((draft) => {
      draft.status = 'draft';
      draft.emergencyRevision = false;
      draft.correction = correction;
      draft.version = `${source.version}-correction`;
      draft.lockedAt = undefined;
      // 更正稿在原稿基础上继续改；补发渠道是待办清单，需在“目标渠道”逐一补齐后才能锁定
    });
    this.correctionFormError = '';
    this.activeView = 'compose';
    this.toastr.warning(
      `已从原稿 ${correction.sourceNo} 派生更正稿 ${correction.correctionNo}，原锁定稿保留在版本链中。`,
      '进入更正流程'
    );
  }

  /** 放弃未完成的更正稿，工作区回到被更正的原稿 */
  cancelCorrection(): void {
    const correction = this.draft.correction;
    if (!correction) return;
    const source = this.correctionSource;
    this.commit((draft) => {
      if (source) {
        draft.title = source.title;
        draft.severity = source.severity;
        draft.scope = source.scope;
        draft.eventAt = source.eventAt;
        draft.effectiveAt = source.effectiveAt;
        draft.expiresAt = source.expiresAt;
        draft.channels = [...source.channels];
        draft.languages = clone(source.languages);
        draft.version = source.version;
      }
      draft.status = 'locked';
      draft.lockedAt = source?.createdAt;
      draft.emergencyRevision = false;
      draft.correction = undefined;
    });
    this.correctionFormError = '';
    this.activeView = 'versions';
    this.toastr.info('已放弃更正稿，工作区恢复为原稿锁定状态。', '更正已取消');
  }

  /** 更正稿编辑期间调整补发渠道范围 */
  toggleCorrectionChannel(channel: string, checked: boolean): void {
    this.commit((draft) => {
      if (!draft.correction) return;
      draft.correction.channels = checked
        ? [...new Set([...draft.correction.channels, channel])]
        : draft.correction.channels.filter((item) => item !== channel);
    });
  }

  /** 内容改好后，确认把全部受影响渠道纳入本次更正文的补发范围 */
  markCorrectionChannelsCovered(): void {
    this.commit((draft) => {
      if (!draft.correction) return;
      draft.channels = [...new Set([...draft.channels, ...draft.correction.channels])];
    });
    this.toastr.success('已将受影响渠道全部纳入目标渠道，请继续检查必需语言。', '补发渠道已覆盖');
  }

  setCorrectionReason(reason: string): void {
    this.commit((draft) => {
      if (draft.correction) draft.correction.reason = reason;
    });
  }

  /** 在版本链中直接对照某份更正稿与其原稿 */
  compareCorrection(version: VersionSnapshot): void {
    if (version.type !== 'correction' || !version.sourceVersionId) return;
    this.compareBaseId = version.sourceVersionId;
    this.compareTargetId = version.id;
    const sourceLanguage = this.draft.versions.find((item) => item.id === version.sourceVersionId)?.languages[0]?.id;
    if (sourceLanguage) this.selectedLanguageId = sourceLanguage;
    this.activeView = 'versions';
  }

  copyCorrectionNotice(): void {
    const text = this.correctionNoticeText;
    if (!text) return;
    const done = () => this.toastr.success('更正文已复制，可粘贴到补发渠道。', '复制成功');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopy(text, done));
    } else {
      this.fallbackCopy(text, done);
    }
  }

  private fallbackCopy(text: string, done: () => void): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      this.toastr.warning('浏览器不支持自动复制，请手动选择文本。', '复制失败');
    }
    document.body.removeChild(textarea);
  }

  private buildNoticeNo(at: string): string {
    const date = new Date(at);
    const stamp = Number.isNaN(date.getTime())
      ? new Date().toISOString().slice(0, 10).replace(/-/g, '')
      : at.slice(0, 10).replace(/-/g, '');
    const dailyCount = this.draft.versions
      .filter((version) => (version.noticeNo ?? '').includes(`NO-${stamp}-`)).length + 1;
    return `NO-${stamp}-${String(dailyCount).padStart(3, '0')}`;
  }

  /** 更正文编号：来源编号 + 针对该原稿的更正序号 */
  private buildCorrectionNo(source: VersionSnapshot): string {
    const sequence = this.draft.versions.filter(
      (version) => version.type === 'correction' && version.sourceVersionId === source.id
    ).length + 1;
    return `${source.noticeNo}-C${sequence}`;
  }

  showCheck(check: CheckResult): void {
    if (check.id.startsWith('missing-') || check.id.startsWith('required-') || check.id.startsWith('banned-') || check.id.startsWith('term-')) {
      const locale = check.id.split('-').at(-1);
      if (locale && this.draft.languages.some((language) => language.id === locale)) this.selectedLanguageId = locale;
      this.activeView = 'compose';
    } else if (check.id === 'discussions') {
      this.activeView = 'review';
    }
  }

  undo(): void {
    const previous = this.history.pop();
    if (!previous) {
      this.toastr.info('没有可撤销的操作。', '撤销');
      return;
    }
    this.future.push(clone(this.draft));
    this.draft = previous;
    this.persist();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) {
      this.toastr.info('没有可重做的操作。', '重做');
      return;
    }
    this.history.push(clone(this.draft));
    this.draft = next;
    this.persist();
  }

  saveNow(): void {
    this.persist();
  }

  formatDateTime(value: string): string {
    if (!value) return '未设置';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private commit(mutator: (draft: NoticeDraft) => void): void {
    this.history.push(clone(this.draft));
    if (this.history.length > 50) this.history.shift();
    const next = clone(this.draft);
    mutator(next);
    next.updatedAt = new Date().toISOString();
    this.draft = next;
    this.future = [];
    this.persist();
  }

  private persist(): void {
    this.lastSavedAt = this.formatDateTime(new Date().toISOString());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.draft, updatedAt: new Date().toISOString() }));
  }

  private migrate(value: NoticeDraft): NoticeDraft {
    if (!value.id || !Array.isArray(value.languages) || !Array.isArray(value.versions)) return initialDraft();
    value.discussions ??= [];
    value.reviews ??= [];
    value.requiredLocales ??= ['zh-CN'];
    value.emergencyRevision ??= false;
    value.correction ??= undefined;
    // 兼容旧版本存档：补全快照类型与通知编号，保证历史稿也能作为更正来源
    value.versions.forEach((version, index) => {
      version.type ??= version.emergency ? 'emergency' : 'normal';
      if (!version.noticeNo) {
        const date = new Date(version.createdAt);
        const stamp = Number.isNaN(date.getTime())
          ? new Date().toISOString().slice(0, 10).replace(/-/g, '')
          : version.createdAt.slice(0, 10).replace(/-/g, '');
        version.noticeNo = `NO-${stamp}-${String(index + 1).padStart(3, '0')}`;
      }
    });
    return value;
  }

  private splitSentences(text: string): string[] {
    return (text.match(/[^。！？.!?]+[。！？.!?]?/g) ?? []).map((item) => item.trim()).filter(Boolean);
  }

  private toTime(value: string): number {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private diffSentences(left: string[], right: string[]): DiffRow[] {
    const rows: DiffRow[] = [];
    const lcs: number[][] = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let i = left.length - 1; i >= 0; i--) {
      for (let j = right.length - 1; j >= 0; j--) {
        lcs[i][j] = left[i] === right[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) {
        rows.push({ left: left[i], right: right[j], kind: 'same' }); i++; j++;
      } else if (i < left.length && j < right.length && lcs[i + 1][j] === lcs[i][j] && lcs[i][j + 1] === lcs[i][j]) {
        rows.push({ left: left[i], right: right[j], kind: 'changed' }); i++; j++;
      } else if (j < right.length && (i === left.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
        rows.push({ left: '', right: right[j], kind: 'added' }); j++;
      } else if (i < left.length) {
        rows.push({ left: left[i], right: '', kind: 'removed' }); i++;
      }
    }
    return rows;
  }
}
