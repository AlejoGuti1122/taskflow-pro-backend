import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ListProjectsQueryDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;
}
