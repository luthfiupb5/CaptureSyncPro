import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const eventId = formData.get('eventId') as string;
        const vectorsStr = formData.get('vectors') as string;

        if (!file || !eventId || !vectorsStr) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const vectors = JSON.parse(vectorsStr);

        // Ensure upload directory exists
        // Structure: public/uploads/{eventId}/{filename}
        const uploadDir = join(process.cwd(), 'public', 'uploads', eventId);
        await mkdir(uploadDir, { recursive: true });

        const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        const filePath = join(uploadDir, filename);

        // Save file locally
        await writeFile(filePath, buffer);

        // Save to DB
        // URL needs to be accessible by browser: /uploads/{eventId}/{filename}
        const publicUrl = `/uploads/${eventId}/${filename}`;
        const photo = await db.addPhotoWithVectors(publicUrl, eventId, vectors);

        return NextResponse.json({ success: true, photo });

    } catch (e) {
        console.error("Upload Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
