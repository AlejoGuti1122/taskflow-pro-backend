import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        description: dto.description,
      },
    });

    await this.activityLog.log({
      organizationId: project.organizationId,
      userId,
      action: 'project.created',
      entityType: 'Project',
      entityId: project.id,
    });

    return project;
  }

  findAllForOrganization(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(id: string, userId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.update({
      where: { id },
      data: dto,
    });

    await this.activityLog.log({
      organizationId: project.organizationId,
      userId,
      action: 'project.updated',
      entityType: 'Project',
      entityId: id,
      metadata: { ...dto },
    });

    return project;
  }

  async softDelete(id: string, userId: string) {
    const project = await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityLog.log({
      organizationId: project.organizationId,
      userId,
      action: 'project.deleted',
      entityType: 'Project',
      entityId: id,
    });
  }
}
