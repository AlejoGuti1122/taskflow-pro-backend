import 'dotenv/config';
import { PrismaClient, TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const OWNER_EMAIL = 'owner@taskflow.pro';
const OWNER_PASSWORD = 'Seed1234!';
const ORG_SLUG = 'acme-inc-seed';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  // Clean slate so this script is safe to re-run: removes the prior seed org
  // (cascades to its Memberships/Projects/Tasks) and owner user (cascades RefreshTokens).
  const existingOwner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
  });
  if (existingOwner) {
    await prisma.organization.deleteMany({ where: { slug: ORG_SLUG } });
    await prisma.user.delete({ where: { id: existingOwner.id } });
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, BCRYPT_ROUNDS);
  const owner = await prisma.user.create({
    data: { email: OWNER_EMAIL, name: 'Ada Owner', passwordHash },
  });

  const organization = await prisma.organization.create({
    data: { name: 'Acme Inc.', slug: ORG_SLUG },
  });

  await prisma.membership.create({
    data: { userId: owner.id, organizationId: organization.id, role: 'OWNER' },
  });

  const [website, mobileApp, internalTools] = await Promise.all(
    [
      {
        name: 'Website Redesign',
        description: 'Revamp the marketing site and landing pages',
      },
      {
        name: 'Mobile App Launch',
        description: 'Ship v1 of the iOS/Android app',
      },
      {
        name: 'Internal Tools',
        description: 'Tooling and automation for the team',
      },
    ].map((data) =>
      prisma.project.create({
        data: { ...data, organizationId: organization.id },
      }),
    ),
  );

  interface SeedTask {
    projectId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId?: string;
    dueDate?: Date;
  }

  const tasks: SeedTask[] = [
    // Website Redesign
    {
      projectId: website.id,
      title: 'Design homepage mockup',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assigneeId: owner.id,
      dueDate: daysFromNow(-10),
    },
    {
      projectId: website.id,
      title: 'Set up CI/CD pipeline',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeId: owner.id,
      dueDate: daysFromNow(3),
    },
    {
      projectId: website.id,
      title: 'Write landing page copy',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
    },
    {
      projectId: website.id,
      title: 'Fix mobile responsive bugs',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assigneeId: owner.id,
      dueDate: daysFromNow(-2), // overdue
    },
    {
      projectId: website.id,
      title: 'SEO audit',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      dueDate: daysFromNow(7),
    },

    // Mobile App Launch
    {
      projectId: mobileApp.id,
      title: 'Implement push notifications',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assigneeId: owner.id,
      dueDate: daysFromNow(5),
    },
    {
      projectId: mobileApp.id,
      title: 'App store listing assets',
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
    },
    {
      projectId: mobileApp.id,
      title: 'Beta testing feedback triage',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assigneeId: owner.id,
      dueDate: daysFromNow(-1), // overdue
    },
    {
      projectId: mobileApp.id,
      title: 'Crash reporting integration',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: daysFromNow(14),
    },
    {
      projectId: mobileApp.id,
      title: 'Performance profiling',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assigneeId: owner.id,
    },

    // Internal Tools
    {
      projectId: internalTools.id,
      title: 'Migrate internal wiki',
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
    },
    {
      projectId: internalTools.id,
      title: 'Build admin dashboard',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeId: owner.id,
      dueDate: daysFromNow(10),
    },
    {
      projectId: internalTools.id,
      title: 'Automate weekly reports',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: daysFromNow(-5), // overdue
    },
    {
      projectId: internalTools.id,
      title: 'Upgrade Node.js version',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assigneeId: owner.id,
    },
    {
      projectId: internalTools.id,
      title: 'Audit third-party dependencies',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: daysFromNow(21),
    },
  ];

  for (const task of tasks) {
    await prisma.task.create({
      data: { ...task, organizationId: organization.id },
    });
  }

  console.log('Seed complete:');
  console.log(`  Owner login: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  console.log(`  Organization: ${organization.name} (${organization.id})`);
  console.log(
    `  Projects: ${[website, mobileApp, internalTools].map((p) => p.name).join(', ')}`,
  );
  console.log(`  Tasks created: ${tasks.length}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
