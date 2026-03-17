import type {
  LlmProviderAvailability,
  LlmProviderFailure,
  LlmRegistryGenerateResult,
  LlmTextGenerateInput,
  LlmTextProvider
} from './provider-types.js';

export class LlmProviderRegistry {
  readonly #providers = new Map<string, LlmTextProvider>();

  register(provider: LlmTextProvider): this {
    this.#providers.set(provider.id, provider);
    return this;
  }

  getProvider(id: string): LlmTextProvider {
    const provider = this.#providers.get(id);
    if (!provider) {
      throw new Error(`未注册的 LLM provider：${id}`);
    }

    return provider;
  }

  listProviders(): LlmTextProvider[] {
    return [...this.#providers.values()];
  }

  hasProvider(id: string): boolean {
    return this.#providers.has(id);
  }

  async listAvailability(): Promise<Array<{ provider: LlmTextProvider; availability: LlmProviderAvailability }>> {
    const entries: Array<{ provider: LlmTextProvider; availability: LlmProviderAvailability }> = [];

    for (const provider of this.#providers.values()) {
      entries.push({
        provider,
        availability: await provider.isAvailable()
      });
    }

    return entries;
  }

  async generateWithOrder(input: LlmTextGenerateInput, order: readonly string[]): Promise<LlmRegistryGenerateResult> {
    const attempts: string[] = [];
    const failures: LlmProviderFailure[] = [];

    for (const providerId of order) {
      const provider = this.getProvider(providerId);
      const availability = await provider.isAvailable();
      attempts.push(providerId);

      if (!availability.available) {
        failures.push({
          providerId: provider.id,
          providerLabel: provider.label,
          transport: provider.transport,
          stage: 'availability',
          message: availability.reason
        });
        continue;
      }

      try {
        const result = await provider.generateText(input);
        return {
          result,
          attempts,
          failures
        };
      } catch (error) {
        failures.push({
          providerId: provider.id,
          providerLabel: provider.label,
          transport: provider.transport,
          stage: 'generate',
          message: formatProviderError(error)
        });
      }
    }

    const details = failures.map((failure) => `${failure.providerId} [${failure.stage}] ${failure.message}`).join(' | ');
    throw new Error(details || '没有可用的 LLM provider。');
  }
}

function formatProviderError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
