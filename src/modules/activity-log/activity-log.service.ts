import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface LogActivityInput {
  organizationId: string;
  userId?: string | null;
  action: string; // free-form, e.g. "task.created", "project.deleted"
  entityType: string; // e.g. "Task", "Project"
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: LogActivityInput) {
    return this.prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }

  findRecentForOrganization(organizationId: string, take = 50, skip = 0) {
    return this.prisma.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
