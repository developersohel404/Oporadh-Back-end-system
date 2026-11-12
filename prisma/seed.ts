import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../generated/prisma/client.js';

// ============================================================
// Setup
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// ============================================================
// Types — Locations
// ============================================================

interface PourashavaJson {
  name: string;
  bn_name: string;
  category?: string;
}

interface UnionJson {
  name: string;
  bn_name: string;
}

interface UpazilaJson {
  name: string;
  bn_name: string;
  unions?: UnionJson[];
  pourashavas?: PourashavaJson[];
}

interface DistrictJson {
  name: string;
  bn_name: string;
  lat?: string;
  long?: string;
  upazilas: UpazilaJson[];
}

interface DivisionJson {
  name: string;
  bn_name: string;
  lat?: string;
  long?: string;
  districts: DistrictJson[];
}

// ============================================================
// Types — Crime Categories
// ============================================================

interface CrimeCategoryJson {
  code: string;
  name: string;
  nameBn: string;
  description?: string;
  isActive?: boolean;
}

// ============================================================
// Seed — Locations
// ============================================================

async function seedLocations() {
  const filePath = path.join(__dirname, 'data', 'locations.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const divisions: DivisionJson[] = JSON.parse(raw);

  console.log(`📥 Loaded ${divisions.length} divisions from JSON`);

  let divisionCount = 0;
  let districtCount = 0;
  let upazilaCount = 0;
  let unionCount = 0;
  let pourashavaCount = 0;

  for (const div of divisions) {
    const division = await prisma.division.upsert({
      where: { name: div.name },
      update: { nameBn: div.bn_name },
      create: {
        name: div.name,
        nameBn: div.bn_name,
      },
    });
    divisionCount++;

    for (const dist of div.districts) {
      const district = await prisma.district.upsert({
        where: {
          divisionId_name: {
            divisionId: division.id,
            name: dist.name,
          },
        },
        update: { nameBn: dist.bn_name },
        create: {
          name: dist.name,
          nameBn: dist.bn_name,
          divisionId: division.id,
        },
      });
      districtCount++;

      for (const upa of dist.upazilas) {
        const upazila = await prisma.upazila.upsert({
          where: {
            districtId_name: {
              districtId: district.id,
              name: upa.name,
            },
          },
          update: { nameBn: upa.bn_name },
          create: {
            name: upa.name,
            nameBn: upa.bn_name,
            districtId: district.id,
          },
        });
        upazilaCount++;

        if (upa.unions && upa.unions.length > 0) {
          const unionData = upa.unions.map((u) => ({
            name: u.name,
            nameBn: u.bn_name,
            upazilaId: upazila.id,
          }));

          const result = await prisma.union.createMany({
            data: unionData,
            skipDuplicates: true,
          });
          unionCount += result.count;
        }

        if (upa.pourashavas && upa.pourashavas.length > 0) {
          const pourashavaData = upa.pourashavas.map((p) => ({
            name: p.name,
            nameBn: p.bn_name,
            upazilaId: upazila.id,
          }));

          const result = await prisma.pourashava.createMany({
            data: pourashavaData,
            skipDuplicates: true,
          });
          pourashavaCount += result.count;
        }
      }

      console.log(`  ✔ ${div.name} / ${dist.name} — ${dist.upazilas.length} upazilas`);
    }
  }

  console.log('');
  console.log('📊 Seed Summary:');
  console.log(`   Divisions:   ${divisionCount}`);
  console.log(`   Districts:   ${districtCount}`);
  console.log(`   Upazilas:    ${upazilaCount}`);
  console.log(`   Unions:      ${unionCount}`);
  console.log(`   Pourashavas: ${pourashavaCount}`);
}

// ============================================================
// Seed — Crime Categories (JSON থেকে, বাংলা সহ)
// ============================================================

async function seedCrimeCategories() {
  console.log('📥 Seeding crime categories from JSON...');

  const filePath = path.join(__dirname, 'data', 'crime-categories.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const categories: CrimeCategoryJson[] = JSON.parse(raw);

  let count = 0;
  for (const cat of categories) {
    await prisma.crimeCategory.upsert({
      where: { code: cat.code },
      update: {
        name: cat.name,
        nameBn: cat.nameBn,
        description: cat.description,
        isActive: cat.isActive ?? true,
      },
      create: {
        code: cat.code,
        name: cat.name,
        nameBn: cat.nameBn,
        description: cat.description,
        isActive: cat.isActive ?? true,
      },
    });
    count++;
  }

  console.log(`   ✔ ${count} crime categories`);
}

// ============================================================
// Seed — About Content (Section 31)
// ============================================================

const ABOUT_CONTENT = [
  { key: 'platform_name', title: 'Platform Name', content: 'OPORADH' },
  {
    key: 'mission',
    title: 'Mission',
    content: 'To create a safer Bangladesh through community-driven crime reporting.',
  },
  {
    key: 'vision',
    title: 'Vision',
    content: 'A society where every citizen feels safe and empowered to report crime.',
  },
  {
    key: 'why_oporadh',
    title: 'Why OPORADH',
    content: 'Because community safety requires collective effort.',
  },
  {
    key: 'how_reporting_works',
    title: 'How Reporting Works',
    content: 'Submit a report → Moderator reviews → Published after approval.',
  },
  {
    key: 'privacy_policy',
    title: 'Privacy Policy',
    content: 'We protect reporter identity and blur faces in public media.',
  },
  {
    key: 'safety_guidelines',
    title: 'Safety Guidelines',
    content: 'Report responsibly. Do not share unverified information.',
  },
];

async function seedAboutContent() {
  console.log('📥 Seeding about content...');

  let count = 0;
  for (const item of ABOUT_CONTENT) {
    await prisma.aboutContent.upsert({
      where: { key: item.key },
      update: { title: item.title, content: item.content },
      create: item,
    });
    count++;
  }

  console.log(`   ✔ ${count} about content entries`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('🌱 Starting seed...\n');

  await seedLocations();
  await seedCrimeCategories();
  await seedAboutContent();

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
