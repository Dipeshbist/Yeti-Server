import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // change these or read from env
  const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@garud.cloud';
  const plain = process.env.ADMIN_SEED_PASSWORD ?? 'Admin@123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // promote if needed
    const needsUpdate =
      existing.role !== 'admin' ||
      existing.status !== 'VERIFIED' ||
      existing.isActive !== true;

    if (needsUpdate) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: UserRole.admin,
          status: UserStatus.VERIFIED,
          isActive: true,
        },
      });
      console.log(`✅ Promoted existing user ${email} to admin.`);
    } else {
      console.log(`ℹ️ Admin ${email} already exists and is active.`);
    }
    return;
  }

  const password = await bcrypt.hash(plain, 10);

  await prisma.user.create({
    data: {
      email,
      password,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.admin,
      status: UserStatus.VERIFIED,
      isActive: true,
    },
  });

  console.log('✅ Admin created:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${plain}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed admin failed:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
