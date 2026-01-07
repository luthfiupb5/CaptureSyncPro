import { PrismaClient, User, Event, Photo } from '@prisma/client';
import * as faceapi from 'face-api.js';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

class Database {
    // Check and seed default user
    async init() {
        // This is a lightweight check to ensure admin exists
        const admin = await prisma.user.findUnique({
            where: { username: 'luthfi' }
        });

        if (!admin) {
            console.log("Seeding default super_admin...");
            await prisma.user.create({
                data: {
                    username: 'luthfi',
                    password: 'Luthfi@2005', // Plaintext for MVP
                    role: 'super_admin'
                }
            });
        }
    }

    // --- Users ---
    async getUser(username: string) {
        return prisma.user.findUnique({
            where: { username }
        });
    }

    async getUserById(id: string) {
        return prisma.user.findUnique({ where: { id } });
    }

    async createUser(username: string, password: string, role: 'super_admin' | 'program_admin', eventId?: string) {
        return prisma.user.create({
            data: {
                username,
                password,
                role,
                eventId
            }
        });
    }

    // --- Events ---
    async getEvents() {
        return prisma.event.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    async createEvent(name: string, banner?: string) {
        return prisma.event.create({
            data: { name, banner }
        });
    }

    async deleteEvent(id: string) {
        // Prisma cascade delete will handle photos and vectors
        return prisma.event.delete({
            where: { id }
        });
    }

    // --- Photos & Matching ---
    async addPhotoWithVectors(url: string, eventId: string, vectors: number[][]) {
        // 1. Create Photo
        const photo = await prisma.photo.create({
            data: {
                url,
                eventId
            }
        });

        // 2. Create Vectors (Stored as JSON strings)
        if (vectors.length > 0) {
            await prisma.faceVector.createMany({
                data: vectors.map(v => ({
                    photoId: photo.id,
                    eventId, // Denormalized for speed
                    vectorStr: JSON.stringify(v)
                }))
            });
        }

        return photo;
    }

    async getPhotos(eventId: string) {
        return prisma.photo.findMany({
            where: { eventId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, url: true, createdAt: true }
        });
    }

    async findMatches(eventId: string, queryVector: number[]): Promise<string[]> {
        // 1. Fetch all vectors for this event
        // Note: For large scale, use PostgreSQL + pgvector. 
        // For MVP (<10k photos), fetching vectors to memory is fine.
        const allVectors = await prisma.faceVector.findMany({
            where: { eventId },
            select: { photoId: true, vectorStr: true, photo: { select: { url: true } } }
        });

        const matches = new Set<string>();
        const threshold = 0.45; // Same threshold as before

        for (const item of allVectors) {
            try {
                const dbVector = JSON.parse(item.vectorStr) as number[];
                if (this.euclideanDistance(queryVector, dbVector) < threshold) {
                    matches.add(item.photo.url);
                }
            } catch (e) {
                continue;
            }
        }

        return Array.from(matches);
    }

    private euclideanDistance(descriptors1: number[], descriptors2: number[]): number {
        return Math.sqrt(
            descriptors1
                .map((val, i) => val - descriptors2[i])
                .reduce((res, diff) => res + Math.pow(diff, 2), 0)
        );
    }
}

export const db = new Database();

// Run init on start
db.init().catch(console.error);
