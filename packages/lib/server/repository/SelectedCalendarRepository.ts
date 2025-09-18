import type { ISelectedCalendarRepository } from "@calcom/lib/server/repository/SelectedCalendarRepository.interface";
import type { PrismaClient } from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";

export class SelectedCalendarRepository implements ISelectedCalendarRepository {
  constructor(private prismaClient: PrismaClient) {}

  async findById(id: string) {
    return this.prismaClient.selectedCalendar.findUnique({
      where: { id },
      include: {
        credential: {
          select: {
            delegationCredential: true,
          },
        },
      },
    });
  }

  async findByChannelId(channelId: string) {
    return this.prismaClient.selectedCalendar.findFirst({ where: { channelId } });
  }

  async findNextSubscriptionBatch({ take, integrations }: { take: number; integrations: string[] }) {
    return this.prismaClient.selectedCalendar.findMany({
      where: {
        integration: { in: integrations },
        OR: [
          {
            syncSubscribedAt: null,
            channelExpiration: {
              gte: new Date(),
            },
          },
        ],
      },
      take,
    });
  }

  async updateSyncStatus(
    id: string,
    data: Pick<
      Prisma.SelectedCalendarUpdateInput,
      "syncToken" | "syncedAt" | "syncErrorAt" | "syncErrorCount"
    >
  ) {
    return this.prismaClient.selectedCalendar.update({
      where: { id },
      data,
    });
  }

  async updateSubscription(
    id: string,
    data: Pick<
      Prisma.SelectedCalendarUpdateInput,
      | "channelId"
      | "channelResourceId"
      | "channelResourceUri"
      | "channelKind"
      | "channelExpiration"
      | "syncSubscribedAt"
    >
  ) {
    return this.prismaClient.selectedCalendar.update({
      where: { id },
      data,
    });
  }
}
