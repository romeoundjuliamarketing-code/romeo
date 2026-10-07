// Server RPCs raise German messages (RAISE EXCEPTION) that hooks pass to the
// UI as error.message. The German source texts live in
// src/i18n/locales/de/common.ts (serverErrors); a message matching one of them
// is shown in the active language. Unknown messages are passed through.
import i18n from '../i18n';
import de from '../i18n/locales/de';

type ServerErrorKey = keyof typeof de.common.serverErrors;

function templateRegex(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\\\{\\\{(\w+)\\\}\\\}/g, '(?<$1>.+?)')}$`);
}

const MATCHERS: readonly { key: ServerErrorKey; re: RegExp }[] =
  (Object.entries(de.common.serverErrors) as [ServerErrorKey, string][])
    .map(([key, template]) => ({ key, re: templateRegex(template) }));

export function serverErrorText(message: string): string {
  const line = message.split('\n')[0].trim();
  for (const { key, re } of MATCHERS) {
    const m = line.match(re);
    if (!m) continue;
    // The only placeholders in serverErrors are {{taken}} and {{min}}.
    const params = { taken: m.groups?.taken ?? '', min: m.groups?.min ?? '' };
    return i18n.t(`common.serverErrors.${key}` as 'common.serverErrors.slotsBelowTaken', params);
  }
  return message;
}
