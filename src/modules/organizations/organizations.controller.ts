import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ResourceOrg } from '../../common/decorators/resource-org.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(user.id, dto);
  }

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findAllForUser(user.id);
  }

  @Get(':id')
  @ResourceOrg('organization')
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  @ResourceOrg('organization')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResourceOrg('organization')
  @Roles(MembershipRole.OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.softDelete(id, user.id);
  }

  @Get(':id/members')
  @ResourceOrg('organization')
  listMembers(@Param('id') id: string) {
    return this.organizationsService.listMembers(id);
  }

  @Post(':id/members')
  @ResourceOrg('organization')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  inviteMember(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(id, user.id, dto);
  }

  @Patch(':id/members/:membershipId')
  @ResourceOrg('organization')
  @Roles(MembershipRole.OWNER)
  updateMemberRole(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(
      id,
      membershipId,
      user.id,
      dto,
    );
  }

  @Delete(':id/members/:membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResourceOrg('organization')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  removeMember(
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.removeMember(id, membershipId, user.id);
  }
}
