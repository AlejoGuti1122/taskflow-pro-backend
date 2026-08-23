import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Membership, MembershipRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  RESOURCE_ORG_KEY,
  ResourceOrgMeta,
} from '../decorators/resource-org.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

interface RequestWithOrgAccess extends AuthenticatedRequest {
  organizationId?: string;
  membership?: Membership;
}

/**
 * Resolves the organization a request targets from the entity referenced by the route
 * (param/body/query, per @ResourceOrg), verifies the current user has a Membership in
 * that organization, and — when @Roles(...) is present — that the membership role qualifies.
 * On success, attaches `request.organizationId` and `request.membership` for handlers/services.
 *
 * No-op (returns true) on routes that don't declare @ResourceOrg — e.g. creating an
 * Organization, or listing the orgs the caller belongs to.
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<ResourceOrgMeta>(
      RESOURCE_ORG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithOrgAccess>();
    const user = request.user;

    const sources: Record<
      ResourceOrgMeta['source'],
      Record<string, unknown>
    > = {
      param: request.params,
      body: (request.body ?? {}) as Record<string, unknown>,
      query: request.query,
    };
    const rawId = sources[meta.source]?.[meta.key];

    if (typeof rawId !== 'string' || !rawId) {
      throw new NotFoundException(
        `Missing "${meta.key}" to resolve organization access`,
      );
    }

    const organizationId = await this.resolveOrganizationId(meta.type, rawId);

    if (!organizationId) {
      throw new NotFoundException(`${meta.type} not found`);
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Your role does not allow this action');
    }

    request.organizationId = organizationId;
    request.membership = membership;
    return true;
  }

  private async resolveOrganizationId(
    type: ResourceOrgMeta['type'],
    id: string,
  ): Promise<string | null> {
    switch (type) {
      case 'organization': {
        const org = await this.prisma.organization.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        });
        return org?.id ?? null;
      }
      case 'project': {
        const project = await this.prisma.project.findFirst({
          where: { id, deletedAt: null },
          select: { organizationId: true },
        });
        return project?.organizationId ?? null;
      }
      case 'task': {
        const task = await this.prisma.task.findUnique({
          where: { id },
          select: { organizationId: true },
        });
        return task?.organizationId ?? null;
      }
    }
  }
}
