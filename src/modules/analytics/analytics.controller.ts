import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourceOrg } from '../../common/decorators/resource-org.decorator';
import { AnalyticsService } from './analytics.service';
import { ProjectFilterQueryDto } from './dto/project-filter.query.dto';
import { ActivityFeedQueryDto } from './dto/activity-feed.query.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('projects/:projectId/summary')
  @ResourceOrg('project', { key: 'projectId' })
  projectSummary(@Param('projectId') projectId: string) {
    return this.analyticsService.projectSummary(projectId);
  }

  @Get('organizations/:organizationId/overdue-tasks')
  @ResourceOrg('organization', { key: 'organizationId' })
  overdueTasks(
    @Param('organizationId') organizationId: string,
    @Query() query: ProjectFilterQueryDto,
  ) {
    return this.analyticsService.overdueTasks(organizationId, query.projectId);
  }

  @Get('organizations/:organizationId/workload')
  @ResourceOrg('organization', { key: 'organizationId' })
  workload(
    @Param('organizationId') organizationId: string,
    @Query() query: ProjectFilterQueryDto,
  ) {
    return this.analyticsService.workloadByMember(
      organizationId,
      query.projectId,
    );
  }

  @Get('organizations/:organizationId/activity')
  @ResourceOrg('organization', { key: 'organizationId' })
  activity(
    @Param('organizationId') organizationId: string,
    @Query() query: ActivityFeedQueryDto,
  ) {
    return this.analyticsService.recentActivity(
      organizationId,
      query.take ?? 50,
      query.skip ?? 0,
    );
  }
}
