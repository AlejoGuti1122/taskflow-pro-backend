import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // Tasks by status/priority for a single project
  async projectSummary(projectId: string) {
    const [byStatus, byPriority] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where: { projectId },
        _count: { _all: true },
      }),
    ]);

    return {
      projectId,
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      byPriority: byPriority.map((row) => ({
        priority: row.priority,
        count: row._count._all,
      })),
    };
  }

  // Tasks past their dueDate that aren't done, org-wide (optionally scoped to a project)
  async overdueTasks(organizationId: string, projectId?: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        projectId,
        status: { not: TaskStatus.DONE },
        dueDate: { lt: new Date() },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return { count: tasks.length, tasks };
  }

  // Open task counts per assignee, org-wide (optionally scoped to a project)
  async workloadByMember(organizationId: string, projectId?: string) {
    const grouped = await this.prisma.task.groupBy({
      by: ['assigneeId', 'status'],
      where: { organizationId, projectId, assigneeId: { not: null } },
      _count: { _all: true },
    });

    const assigneeIds = [
      ...new Set(
        grouped.map((row) => row.assigneeId).filter((id): id is string => !!id),
      ),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((user) => [user.id, user]));

    const byAssignee = new Map<
      string,
      {
        assignee: { id: string; name: string; email: string };
        counts: Record<TaskStatus, number>;
        total: number;
      }
    >();

    for (const row of grouped) {
      const assigneeId = row.assigneeId as string;
      if (!byAssignee.has(assigneeId)) {
        byAssignee.set(assigneeId, {
          assignee: userById.get(assigneeId) ?? {
            id: assigneeId,
            name: 'Unknown',
            email: '',
          },
          counts: { TODO: 0, IN_PROGRESS: 0, DONE: 0 },
          total: 0,
        });
      }
      const entry = byAssignee.get(assigneeId)!;
      entry.counts[row.status] = row._count._all;
      entry.total += row._count._all;
    }

    return Array.from(byAssignee.values()).sort((a, b) => b.total - a.total);
  }

  // Recent ActivityLog entries for the organization, paginated
  recentActivity(organizationId: string, take: number, skip: number) {
    return this.activityLog.findRecentForOrganization(
      organizationId,
      take,
      skip,
    );
  }
}
