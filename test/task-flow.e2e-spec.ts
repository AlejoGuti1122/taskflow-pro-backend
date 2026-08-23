import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

interface OrganizationResponse {
  id: string;
}

interface ProjectResponse {
  id: string;
  organizationId: string;
}

interface TaskResponse {
  id: string;
  projectId: string;
  organizationId: string;
  status: string;
  priority: string;
  title: string;
}

interface ProjectSummaryResponse {
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

describe('Task flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const runId = Date.now();
  const email = `e2e-task-flow-${runId}@taskflow.pro`;
  const password = 'E2eTaskFlow123!';

  let userId: string | undefined;
  let organizationId: string | undefined;
  let projectId: string | undefined;
  let taskId: string | undefined;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Organization/User deletes cascade to Membership, Project, Task and RefreshToken,
    // so this removes everything the flow created below without leaving orphans in Neon.
    if (organizationId) {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app.close();
  });

  it('registers a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'E2E Task Flow' })
      .expect(201);

    const body = res.body as AuthResponse;
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userId = user.id;
  });

  it('logs in with the registered credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const body = res.body as AuthResponse;
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    accessToken = body.accessToken;
  });

  it('creates an organization owned by the new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `E2E Org ${runId}` })
      .expect(201);

    const body = res.body as OrganizationResponse;
    expect(body.id).toBeDefined();
    organizationId = body.id;

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: userId!, organizationId } },
    });
    expect(membership?.role).toBe('OWNER');
  });

  it('creates a project inside that organization', async () => {
    const res = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        organizationId,
        name: 'E2E Project',
        description: 'Created by e2e test',
      })
      .expect(201);

    const body = res.body as ProjectResponse;
    expect(body.id).toBeDefined();
    expect(body.organizationId).toBe(organizationId);
    projectId = body.id;
  });

  it('creates a task inside that project', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ projectId, title: 'E2E Task', priority: 'HIGH' })
      .expect(201);

    const body = res.body as TaskResponse;
    expect(body.id).toBeDefined();
    expect(body.projectId).toBe(projectId);
    expect(body.organizationId).toBe(organizationId);
    expect(body.status).toBe('TODO');
    expect(body.priority).toBe('HIGH');
    taskId = body.id;
  });

  it('can fetch the created task by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as TaskResponse;
    expect(body.id).toBe(taskId);
    expect(body.title).toBe('E2E Task');
  });

  it('reflects the created task in the project analytics summary', async () => {
    const res = await request(app.getHttpServer())
      .get(`/analytics/projects/${projectId}/summary`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as ProjectSummaryResponse;
    expect(body.byStatus).toEqual(
      expect.arrayContaining([{ status: 'TODO', count: 1 }]),
    );
    expect(body.byPriority).toEqual(
      expect.arrayContaining([{ priority: 'HIGH', count: 1 }]),
    );
  });

  it('rejects unauthenticated access to protected routes', async () => {
    await request(app.getHttpServer()).get('/organizations').expect(401);
  });
});
