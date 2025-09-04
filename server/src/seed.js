// src/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
        // 1) Users
        const [adminHash, studentHash] = await Promise.all([
                bcrypt.hash('ChangeMe123!', 10),
                bcrypt.hash('Student123!', 10),
        ]);

        await prisma.user.upsert({
                where: { email: 'admin@example.edu' },
                update: {},
                create: {
                        name: 'Admin',
                        email: 'admin@example.edu',
                        password: adminHash,
                        role: 'ADMIN',
                },
        });

        await prisma.user.upsert({
                where: { email: 'student@example.edu' },
                update: {},
                create: {
                        name: 'Student',
                        email: 'student@example.edu',
                        password: studentHash,
                        role: 'STUDENT',
                },
        });

        // 2) Building
        const building = await prisma.building.upsert({
                where: { name: 'Main Campus' },
                update: {},
                create: { name: 'Main Campus' },
        });

        // 3) Floors (unique on buildingId + name)
        const firstFloor = await prisma.floor.upsert({
                where: { buildingId_name: { buildingId: building.id, name: 'First Floor' } },
                update: {},
                create: { name: 'First Floor', buildingId: building.id },
        });

        const secondFloor = await prisma.floor.upsert({
                where: { buildingId_name: { buildingId: building.id, name: 'Second Floor' } },
                update: {},
                create: { name: 'Second Floor', buildingId: building.id },
        });

        // 4) Rooms (unique on floorId + name)
        await prisma.room.upsert({
                where: { floorId_name: { floorId: firstFloor.id, name: 'A101' } },
                update: {},
                create: {
                        name: 'A101',
                        floorId: firstFloor.id,
                        capacity: 6,
                        equipment: { whiteboard: true },
                },
        });

        await prisma.room.upsert({
                where: { floorId_name: { floorId: firstFloor.id, name: 'A102' } },
                update: {},
                create: {
                        name: 'A102',
                        floorId: firstFloor.id,
                        capacity: 4,
                        equipment: { tv: true },
                },
        });

        await prisma.room.upsert({
                where: { floorId_name: { floorId: secondFloor.id, name: 'B201' } },
                update: {},
                create: {
                        name: 'B201',
                        floorId: secondFloor.id,
                        capacity: 8,
                        equipment: {},
                },
        });

        console.log('✅ Seeded users + building/floors/rooms.');
}

main()
        .catch((e) => {
                console.error('❌ Seed failed:', e);
                process.exit(1);
        })
        .finally(async () => {
                await prisma.$disconnect();
        });
