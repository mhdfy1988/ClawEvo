import type {
  LlmProviderAvailability,
  LlmProviderFailure,
  LlmRegistryGenerateResult,
  LlmTextGenerateInput,
  LlmTextProvider
} from './provider-types.js';

export class LlmProviderRegistry {
  readonly #providers = new Map<string, LlmTextProvider>();
  readonly #availabilityCache = new Map<string, { expiresAt: number; availability: LlmProviderAvailability }>();
  readonly #cooldowns = new Map<string, { until: number; message: string }>();
  readonly #availabilityCacheTtlMs: number;
  readonly #cooldownMs: number;
  readonly #now: () => number;

  constructor(options: {
    availabilityCacheTtlMs?: number;
    cooldownMs?: number;
    now?: () => number;
  } = {}) {
    this.#availabilityCacheTtlMs = normalizeDuration(options.availabilityCacheTtlMs, 1_000);
    this.#cooldownMs = normalizeDuration(options.cooldownMs, 5_000);
    this.#now = options.now || Date.now;
  }

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
        availability: await this.#resolveAvailability(provider)
      });
    }

    return entries;
  }

  async generateWithOrder(input: LlmTextGenerateInput, order: readonly string[]): Promise<LlmRegistryGenerateResult> {
    const attempts: string[] = [];
    const failures: LlmProviderFailure[] = [];

    for (const providerId of order) {
      const provider = this.#providers.get(providerId);
      attempts.push(providerId);

      if (!provider) {
        failures.push({
          providerId,
          providerLabel: providerId,
          stage: 'availability',
          code: 'provider-missing',
          message: `未注册的 LLM provider：${providerId}`
        });
        continue;
      }

      const cooldownFailure = this.#resolveCooldownFailure(provider);
      if (cooldownFailure) {
        failures.push(cooldownFailure);
        continue;
      }

      const availability = await this.#resolveAvailability(provider);

      if (!availability.available) {
        failures.push({
          providerId: provider.id,
          providerLabel: provider.label,
          transport: provider.transport,
          stage: 'availability',
          code: availability.details?.errorType === 'availability-error' ? 'availability-error' : 'provider-unavailable',
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
          code: 'generate-error',
          message: formatProviderError(error)
        });
        this.#markCooldown(provider.id, formatProviderError(error));
        this.#availabilityCache.delete(provider.id);
      }
    }

    const details = failures.map((failure) => `${failure.providerId} [${failure.stage}] ${failure.message}`).join(' | ');
    throw new Error(details || '没有可用的 LLM provider。');
  }

  async #resolveAvailability(provider: LlmTextProvider): Promise<LlmProviderAvailability> {
    const cached = this.#availabilityCache.get(provider.id);
    const now = this.#now();
    if (cached && cached.expiresAt > now) {
      return cached.availability;
    }

    try {
      const availability = await provider.isAvailable();
      this.#availabilityCache.set(provider.id, {
        availability,
        expiresAt: now + this.#availabilityCacheTtlMs
      });
      return availability;
    } catch (error) {
      return {
        available: false,
        configured: false,
        reason: `provider ${provider.id} availability 检查失败：${formatProviderError(error)}`,
        details: {
          errorType: 'availability-error'
        }
      };
    }
  }

  #resolveCooldownFailure(provider: LlmTextProvider): LlmProviderFailure | undefined {
    const cooldown = this.#cooldowns.get(provider.id);
    const now = this.#now();
    if (!cooldown) {
      return undefined;
    }

    if (cooldown.until <= now) {
      this.#cooldowns.delete(provider.id);
      return undefined;
    }

    return {
      providerId: provider.id,
      providerLabel: provider.label,
      transport: provider.transport,
      stage: 'availability',
      code: 'provider-cooldown',
      message: `provider 仍在冷却中，跳过本次尝试：${cooldown.message}`
    };
  }

  #markCooldown(providerId: string, message: string): void {
    if (this.#cooldownMs <= 0) {
      return;
    }

    this.#cooldowns.set(providerId, {
      until: this.#now() + this.#cooldownMs,
      message
    });
  }
}

function formatProviderError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeDuration(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return value;
}
