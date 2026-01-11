import fs from 'fs';
import path from 'path';

// Types matching the previous Prisma schema
export interface User {
    id: string;
    username: string;
    password: string;
    role: 'super_admin' | 'program_admin';
    eventId?: string | null;
    createdAt: Date;
}

export interface Event {
    id: string;
    name: string;
    banner?: string | null;
    createdAt: Date;
}

export interface Photo {
    id: string;
    url: string;
    eventId: string;
    createdAt: Date;
}

export interface FaceVector {
    id: string;
    photoId: string;
    eventId: string;
    vectorStr: string;
}

interface DBData {
    users: User[];
    events: Event[];
    photos: Photo[];
    vectors: FaceVector[];
}

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

class LocalDatabase {
    private data: DBData = { users: [], events: [], photos: [], vectors: [] };
    private initialized = false;

    constructor() {
        this.init();
    }

    private ensureDataDir() {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private load() {
        this.ensureDataDir();
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            try {
                const parsed = JSON.parse(raw);
                // Hydrate dates
                this.data = {
                    users: parsed.users.map((u: any) => ({ ...u, createdAt: new Date(u.createdAt) })),
                    events: parsed.events.map((e: any) => ({ ...e, createdAt: new Date(e.createdAt) })),
                    photos: parsed.photos.map((p: any) => ({ ...p, createdAt: new Date(p.createdAt) })),
                    vectors: parsed.vectors
                };
            } catch (e) {
                console.error("Failed to parse DB, starting fresh", e);
                this.data = { users: [], events: [], photos: [], vectors: [] };
            }
        }
    }

    private save() {
        this.ensureDataDir();
        fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
    }

    async init() {
        if (this.initialized) return;
        this.load();

        // Seed Admin
        const admin = this.data.users.find(u => u.username === 'luthfi');
        if (!admin) {
            console.log("Seeding default super_admin...");
            this.data.users.push({
                id: crypto.randomUUID(),
                username: 'luthfi',
                password: 'Luthfi@2005',
                role: 'super_admin',
                createdAt: new Date()
            });
            this.save();
        }

        this.initialized = true;
    }

    // --- Users ---
    async getUser(username: string) {
        return this.data.users.find(u => u.username === username) || null;
    }

    async getUserById(id: string) {
        return this.data.users.find(u => u.id === id) || null;
    }

    async createUser(username: string, password: string, role: 'super_admin' | 'program_admin', eventId?: string) {
        const newUser: User = {
            id: crypto.randomUUID(),
            username,
            password,
            role,
            eventId: eventId || null,
            createdAt: new Date()
        };
        this.data.users.push(newUser);
        this.save();
        return newUser;
    }

    // --- Events ---
    async getEvents() {
        this.load(); // Ensure fresh data from disk in case other processes modified it
        return [...this.data.events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async createEvent(name: string, banner?: string) {
        const eventId = crypto.randomUUID();
        const newEvent: Event = {
            id: eventId,
            name,
            banner: banner || null,
            createdAt: new Date()
        };
        this.data.events.push(newEvent);

        // Auto-generate Program Admin
        const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const username = `${sanitized}.admin`; // e.g. "summergala.admin"
        const password = Math.random().toString(36).slice(-8); // random 8 chars

        await this.createUser(username, password, 'program_admin', eventId);

        this.save();
        return { event: newEvent, credentials: { username, password } };
    }

    async deleteEvent(id: string) {
        console.log(`[DB] Attempting to delete event: ${id}`);
        const idx = this.data.events.findIndex(e => e.id === id);
        if (idx !== -1) {
            console.log(`[DB] Event found at index ${idx}, deleting...`);
            const deleted = this.data.events.splice(idx, 1)[0];

            // FS Cleanup
            const eventDir = path.join(process.cwd(), 'public', 'uploads', id);
            if (fs.existsSync(eventDir)) {
                try {
                    fs.rmSync(eventDir, { recursive: true, force: true });
                    console.log(`[DB] Deleted directory: ${eventDir}`);
                } catch (e) {
                    console.error(`[DB] Failed to delete directory: ${eventDir}`, e);
                }
            }

            // Cascade delete photos and vectors
            const initialPhotos = this.data.photos.length;
            this.data.photos = this.data.photos.filter(p => p.eventId !== id);
            console.log(`[DB] Deleted ${initialPhotos - this.data.photos.length} photos`);

            this.data.vectors = this.data.vectors.filter(v => v.eventId !== id);

            // Cascade delete Program Admin
            const initialUsers = this.data.users.length;
            this.data.users = this.data.users.filter(u => u.eventId !== id);
            console.log(`[DB] Deleted ${initialUsers - this.data.users.length} users`);

            this.save();
            console.log(`[DB] Event deletion saved to disk.`);
            return deleted;
        } else {
            console.warn(`[DB] Event ID ${id} not found.`);
        }
        return null;
    }

    // Helper to get admin creds for an event (Super Admin only)
    // Helper to get admin creds for an event (Super Admin only)
    async getEventAdmin(eventId: string) {
        this.load(); // Ensure fresh data
        // In a real app, do not return passwords. Here checking for display purposes as requested.
        const user = this.data.users.find(u => u.eventId === eventId && u.role === 'program_admin');
        if (user) return { username: user.username, password: user.password };

        // Fallback: Lazy Migration for legacy events that have no admin
        const event = this.data.events.find(e => e.id === eventId);
        if (event) {
            console.log(`Lazy generating credentials for event: ${event.name}`);
            const sanitized = event.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const username = `${sanitized}.admin`; // e.g. "summergala.admin"

            // Check if username already exists to avoid conflict (append random if needed)
            let finalUsername = username;
            if (this.data.users.some(u => u.username === finalUsername)) {
                finalUsername = `${username}.${Math.floor(Math.random() * 1000)}`;
            }

            const password = Math.random().toString(36).slice(-8);

            await this.createUser(finalUsername, password, 'program_admin', eventId);
            return { username: finalUsername, password };
        }

        return null;
    }

    async deletePhoto(id: string) {
        const idx = this.data.photos.findIndex(p => p.id === id);
        if (idx !== -1) {
            const deleted = this.data.photos.splice(idx, 1)[0];

            // FS Cleanup
            // url is like "/uploads/eventId/filename"
            const relativePath = deleted.url.startsWith('/') ? deleted.url.slice(1) : deleted.url;
            const absolutePath = path.join(process.cwd(), 'public', relativePath);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }

            // Cascade delete vectors
            this.data.vectors = this.data.vectors.filter(v => v.photoId !== id);
            this.save();
            return deleted;
        }
        return null;
    }

    // --- Photos & Matching ---
    async addPhotoWithVectors(url: string, eventId: string, vectors: number[][]) {
        const photo: Photo = {
            id: crypto.randomUUID(),
            url,
            eventId,
            createdAt: new Date()
        };
        this.data.photos.push(photo);

        if (vectors.length > 0) {
            const vectorRecords = vectors.map(v => ({
                id: crypto.randomUUID(),
                photoId: photo.id,
                eventId,
                vectorStr: JSON.stringify(v)
            }));
            this.data.vectors.push(...vectorRecords);
        }

        this.save();
        return photo;
    }

    async getPhotos(eventId: string) {
        return this.data.photos
            .filter(p => p.eventId === eventId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async findMatches(eventId: string, queryVector: number[]): Promise<string[]> {
        const candidates = this.data.vectors.filter(v => v.eventId === eventId);
        const matches = new Set<string>();
        const threshold = 0.45;

        for (const item of candidates) {
            try {
                const dbVector = JSON.parse(item.vectorStr) as number[];
                if (this.euclideanDistance(queryVector, dbVector) < threshold) {
                    const photo = this.data.photos.find(p => p.id === item.photoId);
                    if (photo) matches.add(photo.url);
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

export const db = new LocalDatabase();
