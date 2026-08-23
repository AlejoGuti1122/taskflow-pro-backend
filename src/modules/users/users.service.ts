import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly PUBLIC_SELECT = {
    id: true,
    email: true,
    name: true,
    isActive: true,
    createdAt: true,
  };

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: UsersService.PUBLIC_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: UsersService.PUBLIC_SELECT,
    });
  }

  findOrganizations(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId, organization: { deletedAt: null } },
      include: { organization: true },
    });
  }
}
