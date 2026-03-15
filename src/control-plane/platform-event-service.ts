import { randomUUID } from 'node:crypto';

import type {
  PlatformEventRecord,
  PlatformEventServiceContract,
  PlatformWebhookDelivery,
  PlatformWebhookSubscription
} from './contracts.js';

export class PlatformEventService implements PlatformEventServiceContract {
  private readonly events: PlatformEventRecord[] = [];
  private readonly subscriptions: PlatformWebhookSubscription[] = [];
  private readonly deliveries: PlatformWebhookDelivery[] = [];

  recordEvent(input: {
    type: PlatformEventRecord['type'];
    resourceId?: string;
    stage?: string;
    sessionId?: string;
    workspaceId?: string;
    createdAt?: string;
    payload: Record<string, unknown>;
  }): PlatformEventRecord {
    const event: PlatformEventRecord = {
      id: `platform_event_${randomUUID()}`,
      type: input.type,
      createdAt: input.createdAt ?? new Date().toISOString(),
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      ...(input.stage ? { stage: input.stage } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      payload: { ...input.payload }
    };
    this.events.unshift(event);

    for (const subscription of this.subscriptions) {
      if (!subscription.active || !subscription.eventTypes.includes(event.type)) {
        continue;
      }
      this.deliveries.unshift({
        id: `platform_delivery_${randomUUID()}`,
        subscriptionId: subscription.id,
        eventId: event.id,
        createdAt: event.createdAt,
        target: subscription.target,
        status: 'delivered'
      });
    }

    return { ...event, payload: { ...event.payload } };
  }

  listEvents(input?: {
    limit?: number;
    type?: PlatformEventRecord['type'];
    workspaceId?: string;
  }): PlatformEventRecord[] {
    const limit = input?.limit && input.limit > 0 ? input.limit : 50;
    return this.events
      .filter((event) => (!input?.type || event.type === input.type) && (!input?.workspaceId || event.workspaceId === input.workspaceId))
      .slice(0, limit)
      .map((event) => ({ ...event, payload: { ...event.payload } }));
  }

  createWebhookSubscription(input: {
    target: string;
    eventTypes: readonly PlatformEventRecord['type'][];
    createdAt?: string;
    createdBy?: string;
    secret?: string;
  }): PlatformWebhookSubscription {
    const subscription: PlatformWebhookSubscription = {
      id: `platform_webhook_${randomUUID()}`,
      createdAt: input.createdAt ?? new Date().toISOString(),
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      target: input.target,
      eventTypes: [...input.eventTypes],
      active: true,
      ...(input.secret ? { secret: input.secret } : {})
    };
    this.subscriptions.unshift(subscription);
    return {
      ...subscription,
      eventTypes: [...subscription.eventTypes]
    };
  }

  listWebhookSubscriptions(): PlatformWebhookSubscription[] {
    return this.subscriptions.map((subscription) => ({
      ...subscription,
      eventTypes: [...subscription.eventTypes]
    }));
  }

  listWebhookDeliveries(limit = 50): PlatformWebhookDelivery[] {
    return this.deliveries.slice(0, limit).map((delivery) => ({ ...delivery }));
  }
}
