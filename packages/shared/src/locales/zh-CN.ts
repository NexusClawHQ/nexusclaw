/**
 * 社区版简体中文文案。
 *
 * 社区运行时自带内联 UI 文案——演示控制台页与治理仪表盘各自持有独立键表——
 * 因此本模块有意不包含任何商业版 UI 词汇，仅为保持 `@nexusclaw/shared` 的
 * locale API 形状（`locales`、`localeNames`、`flattenMessages`）可用。
 *
 * 保持该树最小化：`npm run check:i18n` 同时校验中英对齐与键数硬上限，
 * 防止企业版语言树被意外重新导入。
 */
const messages = {
  community: {
    productName: 'NexusClaw 社区版',
    edition: '社区版',
  },
} as const;

export default messages;
