import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    const organization = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.name, slug },
      });
      await tx.membership.create({
        data: { userId, organizationId: org.id, role: MembershipRole.OWNER },
      });
      return org;
    });

    await this.activityLog.log({
      organizationId: organization.id,
      userId,
      action: 'organization.created',
      entityType: 'Organization',
      entityId: organization.id,
    });

    return organization;
  }

  findAllForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { deletedAt: null, memberships: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async update(id: string, userId: string, dto: UpdateOrganizationDto) {
    const organization = await this.prisma.organization.update({
      where: { id },
      data: dto,
    });

    await this.activityLog.log({
      organizationId: id,
      userId,
      action: 'organization.updated',
      entityType: 'Organization',
      entityId: id,
      metadata: { ...dto },
    });

    return organization;
  }

  async softDelete(id: string, userId: string) {
    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityLog.log({
      organizationId: id,
      userId,
      action: 'organization.deleted',
      entityType: 'Organization',
      entityId: id,
    });
  }

  listMembers(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(
    organizationId: string,
    actingUserId: string,
    dto: InviteMemberDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException(
        'No user found with that email — they must register first',
      );
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (existing) {
      throw new ConflictException(
        'User is already a member of this organization',
      );
    }

    const membership = await this.prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role: dto.role ?? MembershipRole.MEMBER,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.activityLog.log({
      organizationId,
      userId: actingUserId,
      action: 'member.invited',
      entityType: 'Membership',
      entityId: membership.id,
      metadata: { invitedUserId: user.id, role: membership.role },
    });

    return membership;
  }

  async updateMemberRole(
    organizationId: string,
    membershipId: string,
    actingUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const membership = await this.getMembershipOrThrow(
      organizationId,
      membershipId,
    );

    if (
      membership.role === MembershipRole.OWNER &&
      dto.role !== MembershipRole.OWNER
    ) {
      await this.assertNotLastOwner(organizationId, membershipId);
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.activityLog.log({
      organizationId,
      userId: actingUserId,
      action: 'member.role_updated',
      entityType: 'Membership',
      entityId: membershipId,
      metadata: { from: membership.role, to: dto.role },
    });

    return updated;
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    actingUserId: string,
  ) {
    const membership = await this.getMembershipOrThrow(
      organizationId,
      membershipId,
    );

    if (membership.role === MembershipRole.OWNER) {
      await this.assertNotLastOwner(organizationId, membershipId);
    }

    await this.prisma.membership.delete({ where: { id: membershipId } });

    await this.activityLog.log({
      organizationId,
      userId: actingUserId,
      action: 'member.removed',
      entityType: 'Membership',
      entityId: membershipId,
      metadata: { removedUserId: membership.userId },
    });
  }

  private async getMembershipOrThrow(
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    return membership;
  }

  private async assertNotLastOwner(
    organizationId: string,
    excludingMembershipId: string,
  ) {
    const otherOwners = await this.prisma.membership.count({
      where: {
        organizationId,
        role: MembershipRole.OWNER,
        id: { not: excludingMembershipId },
      },
    });
    if (otherOwners === 0) {
      throw new ConflictException(
        'An organization must have at least one owner',
      );
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${base}-${randomBytes(3).toString('hex')}`;
      const exists = await this.prisma.organization.findUnique({
        where: { slug: candidate },
      });
      if (!exists) {
        return candidate;
      }
    }
    throw new ConflictException(
      'Could not generate a unique organization slug, please retry',
    );
  }
}
