/**
 * Community-edition English messages.
 *
 * The Community runtime ships its own inline UI copy — the demo console page
 * and the governance dashboard each carry a private key table — so this module
 * intentionally carries NO commercial UI vocabulary. It exists only to keep
 * the `@nexusclaw/shared` locale API shape (`locales`, `localeNames`,
 * `flattenMessages`) available to Community consumers.
 *
 * Keep this tree minimal: `npm run check:i18n` enforces both en/zh parity and
 * a hard key-count ceiling, so an enterprise locale tree can never be
 * re-imported here by accident.
 */
const messages = {
  community: {
    productName: 'NexusClaw Community',
    edition: 'Community Edition',
  },
} as const;

export default messages;
