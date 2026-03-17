function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function extractResponseText(payload: unknown): string {
  if (!isRecord(payload)) {
    return '';
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = payload.output;
  if (!Array.isArray(output)) {
    return '';
  }

  const fragments: string[] = [];

  for (const item of output) {
    if (!isRecord(item)) {
      continue;
    }

    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const entry of content) {
      if (!isRecord(entry)) {
        continue;
      }

      if (typeof entry.text === 'string' && entry.text.trim()) {
        fragments.push(entry.text.trim());
      }
    }
  }

  return fragments.join('\n').trim();
}

export function extractChatCompletionText(payload: unknown): string {
  if (!isRecord(payload)) {
    return '';
  }

  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return '';
  }

  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) {
    return '';
  }

  const message = firstChoice.message;
  if (!isRecord(message)) {
    return '';
  }

  const content = message.content;
  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const fragments: string[] = [];

  for (const entry of content) {
    if (typeof entry === 'string' && entry.trim()) {
      fragments.push(entry.trim());
      continue;
    }

    if (!isRecord(entry)) {
      continue;
    }

    if (typeof entry.text === 'string' && entry.text.trim()) {
      fragments.push(entry.text.trim());
    }
  }

  return fragments.join('\n').trim();
}
