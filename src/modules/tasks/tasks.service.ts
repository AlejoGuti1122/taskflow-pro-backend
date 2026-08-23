import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (dto.assigneeId) {
      await this.assertAssigneeIsMember(project.organizationId, dto.assigneeId);
    }

    const task = await this.prisma.task.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.activityLog.log({
      organizationId: task.organizationId,
      userId,
      action: 'task.created',
      entityType: 'Task',
      entityId: task.id,
    });

    return task;
  }

  findAllForProject(query: ListTasksQueryDto) {
    return this.prisma.task.findMany({
      where: {
        projectId: query.projectId,
        status: query.status,
        priority: query.priority,
        assigneeId: query.assigneeId,
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(id: string, userId: string, dto: UpdateTaskDto) {
    const existing = await this.findOne(id);

    if (dto.assigneeId) {
      await this.assertAssigneeIsMember(
        existing.organizationId,
        dto.assigneeId,
      );
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.activityLog.log({
      organizationId: task.organizationId,
      userId,
      action: 'task.updated',
      entityType: 'Task',
      entityId: id,
      metadata: { ...dto },
    });

    return task;
  }

  async remove(id: string, userId: string) {
    const task = await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });

    await this.activityLog.log({
      organizationId: task.organizationId,
      userId,
      action: 'task.deleted',
      entityType: 'Task',
      entityId: id,
    });
  }

  private async assertAssigneeIsMember(
    organizationId: string,
    assigneeId: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: assigneeId, organizationId } },
    });
    if (!membership) {
      throw new BadRequestException(
        'Assignee must be a member of the task organization',
      );
    }
  }
}
