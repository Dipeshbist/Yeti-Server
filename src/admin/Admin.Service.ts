import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotifyMailService } from '../email/notifymail.service';
import { ApproveUserDto } from './dto/approveuser.dto';
import { RejectUserDto } from './dto/rejectuser.dto';
import { UpdateUserDto } from './dto/updateuser.dto';
import { Prisma, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notify: NotifyMailService,
  ) {}

  /** Get all pending users */
  getPendingUsers() {
    return this.db.user.findMany({
      where: { status: UserStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
  }

  /** Get all registered users */
  getAllUsers() {
    return this.db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        customerId: true,
        createdAt: true,
      },
    });
  }

  /** Approve a pending user */
  async approveUser(dto: ApproveUserDto) {
    const user = await this.db.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.PENDING)
      throw new BadRequestException('User not in PENDING');

    const updated = await this.db.user.update({
      where: { id: dto.userId },
      data: {
        status: UserStatus.VERIFIED,
        customerId: dto.customerId,
        auditLogsCreated: {
          create: {
            action: 'USER_APPROVED',
            details: `customerId=${dto.customerId}`,
          },
        },
      },
    });

    await this.notify.notifyUserApproved(updated.email);
    return { success: true };
  }

  /** Reject a pending user */
  async rejectUser(dto: RejectUserDto) {
    const user = await this.db.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.PENDING)
      throw new BadRequestException('User not in PENDING');

    await this.db.user.update({
      where: { id: dto.userId },
      data: {
        status: UserStatus.REJECTED,
        auditLogsCreated: {
          create: {
            action: 'USER_REJECTED',
            details: dto.reason,
          },
        },
      },
    });

    await this.notify.notifyUserRejected(user.email, dto.reason);
    return { success: true };
  }

  /** Update a user (role, customerId, isActive) */
  async updateUser(userId: string, updates: UpdateUserDto) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {};

    // Update active status
    if (typeof updates.isActive === 'boolean') data.isActive = updates.isActive;

    // Update customerId and promote to VERIFIED if PENDING
    if (typeof updates.customerId !== 'undefined') {
      data.customerId = updates.customerId;
      if (updates.customerId && user.status === UserStatus.PENDING) {
        data.status = UserStatus.VERIFIED;
      }
    }

    // Update role
    if (updates.role) {
      data.role =
        updates.role.toLowerCase() === 'admin' ? UserRole.admin : UserRole.user;
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data,
    });

    // Send audit logs and notifications
    if (
      user.status === UserStatus.PENDING &&
      updated.status === UserStatus.VERIFIED
    ) {
      await this.notify.notifyUserApproved(updated.email);
      await this.db.auditLog.create({
        data: {
          action: 'USER_APPROVED',
          details: `auto-verified via modify; customerId=${updated.customerId} @${new Date().toISOString()}`,
          targetUserId: userId,
        },
      });
    } else {
      await this.db.auditLog.create({
        data: {
          action: 'USER_UPDATED',
          details: `Updates: ${JSON.stringify(updates)} @${new Date().toISOString()}`,
          targetUserId: userId,
        },
      });
    }

    return updated;
  }
}
