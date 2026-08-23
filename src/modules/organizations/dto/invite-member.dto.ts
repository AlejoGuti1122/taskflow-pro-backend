import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'member@taskflow.pro' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: MembershipRole, default: MembershipRole.MEMBER })
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;
}
