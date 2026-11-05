/**
 * Development seed.
 *
 * Creates one demo organization with an owner, a member, and two projects,
 * plus the "Big Bee" organization for the Company Brain demo.
 *
 * Idempotent — safe to run repeatedly. Records upsert on their natural keys,
 * so re-running updates rather than duplicates.
 *
 *   pnpm --filter @app-starter/api prisma:seed
 */
import { PrismaClient, OrgRole, ProjectVisibility } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { embedText, toVectorLiteral } from '../src/brain/embedding';

// Run directly via ts-node, so nothing else has loaded the env yet. Mirrors
// the order in prisma.config.ts: tests read .env.test, everything else .env.
const apiRoot = path.resolve(__dirname, '..');
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.join(apiRoot, '.env.test.local') });
  dotenv.config({ path: path.join(apiRoot, '.env.test') });
} else {
  dotenv.config({ path: path.join(apiRoot, '.env') });
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env first.');
}

// The demo owner is a global admin with a password published in this file and
// in the README. Creating it against a production database hands anyone who
// has read the repository full control of the app, so refuse by default.
// `SEED_ALLOW_PRODUCTION=true` is the deliberate opt-out.
if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
  throw new Error(
    'Refusing to seed with NODE_ENV=production: the demo accounts have a publicly known password ' +
      'and owner@example.com is a global admin. Set SEED_ALLOW_PRODUCTION=true if you really mean it.',
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = 'Password123!';

async function seedDemoOrganization() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      password: passwordHash,
      name: 'Ada Owner',
      username: 'ada',
      emailVerifiedAt: new Date(),
      isGlobalAdmin: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      email: 'member@example.com',
      password: passwordHash,
      name: 'Mo Member',
      username: 'mo',
      emailVerifiedAt: new Date(),
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Inc',
      slug: 'acme',
      description: 'Demo organization created by the seed script.',
      timezone: 'UTC',
    },
  });

  for (const [user, role] of [
    [owner, OrgRole.OWNER],
    [member, OrgRole.MEMBER],
  ] as const) {
    await prisma.organizationMember.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: { role },
      create: { userId: user.id, organizationId: organization.id, role },
    });
  }

  const projects = [
    {
      slug: 'website-redesign',
      name: 'Website redesign',
      description: 'Visible to everyone in the organization.',
      visibility: ProjectVisibility.ORGANIZATION,
    },
    {
      slug: 'q3-planning',
      name: 'Q3 planning',
      description: "Private to its creator — won't appear for other members.",
      visibility: ProjectVisibility.PRIVATE,
    },
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: project.slug } },
      update: {},
      create: { ...project, organizationId: organization.id, createdById: owner.id },
    });
  }

  console.log(`Seeded organization "${organization.name}" with 2 users and 2 projects`);
  console.log(`  owner@example.com / ${DEMO_PASSWORD}  (global admin)`);
  console.log(`  member@example.com / ${DEMO_PASSWORD}`);
}

// ----------------------------------------------------------------------------
// Company Brain demo: "Big Bee", its IT manager Priya, and the bedrock data
// (policies, facts and the laptop inventory). Chat messages are not seeded;
// the Simulate button streams them in. See COMPANY_BRAIN_SPEC.md.
// ----------------------------------------------------------------------------

/** Verified policies and business facts the brain checks solutions against. */
const BIG_BEE_FACTS = [
  {
    code: 'IT-04',
    kind: 'policy',
    title: 'Approved software only',
    body: 'Only IT-approved software may be installed on company laptops. Chrome is approved for Windows only.',
  },
  {
    code: 'IT-07',
    kind: 'policy',
    title: 'Managed browsers',
    body: 'Safari is the IT-managed browser on company MacBooks. Edge and Chrome are managed on Windows.',
  },
  {
    code: 'IT-11',
    kind: 'policy',
    title: 'Internal tool outages are Sev-2',
    body: 'An internal tool outage that blocks a business process is Sev-2: fix within 2 business days and post a status update in #it-announcements.',
  },
  {
    code: 'IT-12',
    kind: 'policy',
    title: 'Temporary workarounds',
    body: 'The IT manager may approve a temporary workaround for up to 14 days.',
  },
  {
    code: 'FIN-02',
    kind: 'policy',
    title: 'Expense report deadline',
    body: 'Monthly expense reports are due Friday at 5pm.',
  },
  {
    code: 'DATA-01',
    kind: 'data',
    title: 'Laptop fleet',
    body: 'Big Bee has 230 employees. 62% of company laptops are MacBooks.',
  },
  {
    // A distractor: unrelated to the demo, so policy matching has to be selective.
    code: 'IT-02',
    kind: 'policy',
    title: 'Password rotation',
    body: 'Passwords must be rotated every 90 days.',
  },
] as const;

const MAC = { laptop: 'MacBook Pro 14', os: 'macOS', browser: 'Safari' } as const;
const DELL_CHROME = { laptop: 'Dell Latitude 7440', os: 'Windows', browser: 'Chrome' } as const;
const DELL_EDGE = { laptop: 'Dell Latitude 7440', os: 'Windows', browser: 'Edge' } as const;

/**
 * The IT inventory. Everyone who reports the expense problem is on a MacBook
 * with Safari; everyone it works for is on Windows. Noise authors are mixed.
 * Names must match the authors in apps/api/src/brain/simulation-script.ts.
 */
const BIG_BEE_DEVICES = [
  // Will report the expense-form problem.
  { employeeName: 'Jane Doe', ...MAC },
  { employeeName: 'Maya Chen', ...MAC },
  { employeeName: 'Leo Park', ...MAC },
  { employeeName: 'Sara Kim', ...MAC },
  { employeeName: 'Tom Rivera', ...MAC },
  { employeeName: 'Ana Lopez', ...MAC },
  // Will say expenses work fine for them.
  { employeeName: 'John Doe', ...DELL_CHROME },
  { employeeName: 'Raj Mehta', ...DELL_EDGE },
  { employeeName: 'Emma Wilson', ...DELL_CHROME },
  // Chat about other things (printers, Wi-Fi, lunch).
  { employeeName: 'Ben Carter', ...MAC },
  { employeeName: 'Sam Nguyen', ...MAC },
  { employeeName: 'Olivia Brown', ...DELL_EDGE },
  { employeeName: 'Chloe Davis', ...DELL_CHROME },
  { employeeName: 'Priya Patel', ...MAC },
] as const;

async function seedBigBee() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Priya is the IT manager and the only login the demo needs.
  const priya = await prisma.user.upsert({
    where: { email: 'priya@bigbee.example.com' },
    update: {},
    create: {
      email: 'priya@bigbee.example.com',
      password: passwordHash,
      name: 'Priya Patel',
      username: 'priya',
      emailVerifiedAt: new Date(),
    },
  });

  const bigBee = await prisma.organization.upsert({
    where: { slug: 'big-bee' },
    update: {},
    create: {
      name: 'Big Bee',
      slug: 'big-bee',
      description: 'Company Brain demo organization.',
      timezone: 'UTC',
    },
  });

  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: priya.id, organizationId: bigBee.id } },
    update: { role: OrgRole.OWNER },
    create: { userId: priya.id, organizationId: bigBee.id, role: OrgRole.OWNER },
  });

  for (const device of BIG_BEE_DEVICES) {
    await prisma.brainDevice.upsert({
      where: {
        organizationId_employeeName: {
          organizationId: bigBee.id,
          employeeName: device.employeeName,
        },
      },
      update: { laptop: device.laptop, os: device.os, browser: device.browser },
      create: { ...device, organizationId: bigBee.id },
    });
  }

  // Each fact also gets a meaning vector, so the report can find the policies
  // closest to a proposed solution. Prisma can't write vector columns, so the
  // embedding is set with raw SQL after the upsert.
  for (const fact of BIG_BEE_FACTS) {
    const saved = await prisma.brainFact.upsert({
      where: { organizationId_code: { organizationId: bigBee.id, code: fact.code } },
      update: { kind: fact.kind, title: fact.title, body: fact.body },
      create: { ...fact, organizationId: bigBee.id },
    });
    const embedding = await embedText(`${fact.title}. ${fact.body}`);
    await prisma.$executeRaw`
      UPDATE brain_facts SET embedding = ${toVectorLiteral(embedding)}::vector
      WHERE id = ${saved.id} AND organization_id = ${bigBee.id}`;
  }

  console.log(
    `Seeded organization "${bigBee.name}" with ${BIG_BEE_DEVICES.length} devices and ${BIG_BEE_FACTS.length} facts`,
  );
  console.log(`  priya@bigbee.example.com / ${DEMO_PASSWORD}  (owner, IT manager)`);
}

async function main() {
  await seedDemoOrganization();
  await seedBigBee();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
