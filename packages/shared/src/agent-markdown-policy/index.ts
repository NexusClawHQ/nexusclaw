/**
 * AI 员工身份策略 / 自然语言指令的 markdown 分段解析。
 * 前后端共用同一份解析逻辑（design.md FD2/FD3），避免两端各写一份而漂移。
 * 零第三方依赖：标题语法简单（#/##/###），不需要完整 markdown AST。
 */

export interface MarkdownSection {
  /** 0 = 无标题（整段），1/2/3 对应 #/##/### */
  level: number;
  /** 无标题时为空字符串 */
  title: string;
  /** 该标题下的正文（不含标题行本身） */
  content: string;
  /** 出现顺序，从 0 开始 */
  order: number;
  priorityTier: 'high' | 'normal';
}

/** 标题命中即视为高优先级（护栏/红线类），集中维护，调整关键词只改这一处。 */
export const HIGH_PRIORITY_TITLE_KEYWORDS = ['红线', '禁止', '必须', '不允许', '绝不'] as const;

/** 正文中的显式标记，优先级高于关键词匹配。 */
const EXPLICIT_HIGH_PRIORITY_MARKER = /<!--\s*priority:\s*high\s*-->/i;

export function derivePriorityTier(title: string, content: string): 'high' | 'normal' {
  if (EXPLICIT_HIGH_PRIORITY_MARKER.test(content)) {
    return 'high';
  }
  if (HIGH_PRIORITY_TITLE_KEYWORDS.some((keyword) => title.includes(keyword))) {
    return 'high';
  }
  return 'normal';
}

const HEADING_LINE = /^(#{1,3})\s+(.*)$/;

/**
 * 按 #/##/### 标题切分文本。无任何标题命中时，返回单个
 * { level: 0, title: '', content: 全文 } 的 section —— 这是存量数据
 * （无标题的纯文本）与改造前逐字节兼容的关键短路分支（design.md FD4）。
 */
export function parseMarkdownSections(text: string): MarkdownSection[] {
  const lines = text.split('\n');
  const headingIndexes: Array<{ lineIndex: number; level: number; title: string }> = [];

  lines.forEach((line, lineIndex) => {
    const match = HEADING_LINE.exec(line);
    if (match) {
      const [, hashes, title] = match;
      headingIndexes.push({ lineIndex, level: (hashes ?? '').length, title: (title ?? '').trim() });
    }
  });

  if (headingIndexes.length === 0) {
    return [
      {
        level: 0,
        title: '',
        content: text,
        order: 0,
        priorityTier: 'normal',
      },
    ];
  }

  const sections: MarkdownSection[] = [];
  headingIndexes.forEach((heading, index) => {
    const contentStart = heading.lineIndex + 1;
    const contentEnd = headingIndexes[index + 1]?.lineIndex ?? lines.length;
    const content = lines.slice(contentStart, contentEnd).join('\n').trim();
    sections.push({
      level: heading.level,
      title: heading.title,
      content,
      order: index,
      priorityTier: derivePriorityTier(heading.title, content),
    });
  });

  return sections;
}
