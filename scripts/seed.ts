import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User';
import Machinery from '../src/models/Machinery';
import Inventory from '../src/models/Inventory';

const MONGODB_URI = process.env.MONGODB_URI!;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function seed() {
  console.log('\n🌱 Starting database seed...\n');

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // ── Clear existing seed collections ──────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Machinery.deleteMany({}),
    Inventory.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data from: users, machinery, inventory\n');

  // ── Create Users ─────────────────────────────────────────────────────────
  const users = await User.insertMany([
    {
      name: 'Senior Manager',
      email: 'srmanager@factory.com',
      passwordHash: await hashPassword('Admin@1234'),
      role: 'SENIOR_MANAGER',
      isActive: true,
    },
    {
      name: 'Manager One',
      email: 'manager@factory.com',
      passwordHash: await hashPassword('Admin@1234'),
      role: 'MANAGER',
      isActive: true,
    },
    {
      name: 'Manager Two',
      email: 'manager2@factory.com',
      passwordHash: await hashPassword('Admin@1234'),
      role: 'MANAGER',
      isActive: true,
    },
    {
      name: 'Technician One',
      email: 'tech1@factory.com',
      passwordHash: await hashPassword('Tech@1234'),
      role: 'TECHNICIAN',
      isActive: true,
    },
    {
      name: 'Technician Two',
      email: 'tech2@factory.com',
      passwordHash: await hashPassword('Tech@1234'),
      role: 'TECHNICIAN',
      isActive: true,
    },
    {
      name: 'User One',
      email: 'user1@factory.com',
      passwordHash: await hashPassword('User@1234'),
      role: 'USER',
      isActive: true,
    },
    {
      name: 'User Two',
      email: 'user2@factory.com',
      passwordHash: await hashPassword('User@1234'),
      role: 'USER',
      isActive: true,
    },
  ]);
  console.log(`✅ Created ${users.length} users`);

  // ── Create Machinery ──────────────────────────────────────────────────────
  const machines = await Machinery.insertMany([
    {
      name: 'Conveyor Belt A',
      serialNumber: 'CB-001',
      location: 'Assembly Line 1',
      type: 'Conveyor',
      status: 'ACTIVE',
    },
    {
      name: 'Hydraulic Press B',
      serialNumber: 'HP-002',
      location: 'Press Room',
      type: 'Hydraulic Press',
      status: 'ACTIVE',
    },
    {
      name: 'CNC Lathe C',
      serialNumber: 'CNC-003',
      location: 'Machining Bay',
      type: 'CNC Machine',
      status: 'ACTIVE',
    },
    {
      name: 'Packaging Unit D',
      serialNumber: 'PK-004',
      location: 'Packaging Zone',
      type: 'Packaging',
      status: 'ACTIVE',
    },
    {
      name: 'Compressor Unit E',
      serialNumber: 'CP-005',
      location: 'Utility Room',
      type: 'Compressor',
      status: 'ACTIVE',
    },
    {
      name: 'Old Drill Press',
      serialNumber: 'DP-006',
      location: 'Storage',
      type: 'Drill Press',
      status: 'DECOMMISSIONED',
    },
  ]);
  console.log(`✅ Created ${machines.length} machines`);

  // ── Create Inventory ──────────────────────────────────────────────────────
  const inventory = await Inventory.insertMany([
    { itemName: 'ball bearing',        quantity: 200, unit: 'pcs',    reorderLevel: 50  },
    { itemName: 'hydraulic oil',       quantity: 50,  unit: 'litres', reorderLevel: 10  },
    { itemName: 'conveyor belt strap', quantity: 30,  unit: 'metres', reorderLevel: 5   },
    { itemName: 'motor brush',         quantity: 100, unit: 'pcs',    reorderLevel: 20  },
    { itemName: 'gear oil',            quantity: 40,  unit: 'litres', reorderLevel: 8   },
    { itemName: 'safety gloves',       quantity: 500, unit: 'pcs',    reorderLevel: 100 },
    { itemName: 'coolant',             quantity: 60,  unit: 'litres', reorderLevel: 15  },
    { itemName: 'o-ring kit',          quantity: 80,  unit: 'boxes',  reorderLevel: 10  },
    { itemName: 'lubricant spray',     quantity: 120, unit: 'pcs',    reorderLevel: 25  },
    { itemName: 'carbon brush',        quantity: 75,  unit: 'pcs',    reorderLevel: 15  },
  ]);
  console.log(`✅ Created ${inventory.length} inventory items`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' ROLE              EMAIL                    PASSWORD    ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' SENIOR_MANAGER    srmanager@factory.com    Admin@1234  ');
  console.log(' MANAGER           manager@factory.com      Admin@1234  ');
  console.log(' MANAGER           manager2@factory.com     Admin@1234  ');
  console.log(' TECHNICIAN        tech1@factory.com        Tech@1234   ');
  console.log(' TECHNICIAN        tech2@factory.com        Tech@1234   ');
  console.log(' USER              user1@factory.com        User@1234   ');
  console.log(' USER              user2@factory.com        User@1234   ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});