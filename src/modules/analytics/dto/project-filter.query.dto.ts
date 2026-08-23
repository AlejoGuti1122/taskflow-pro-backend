import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ProjectFilterQueryDto {
  @ApiPropertyOptional({
    description: 'Restrict the report to a single project',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
