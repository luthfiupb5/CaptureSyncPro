import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
    console.log("[API] Processing local upload...");
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const eventId = formData.get('eventId') as string;
        const vectorsStr = formData.get('vectors') as string;

        if (!file || !eventId || !vectorsStr) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', eventId);
        await mkdir(uploadDir, { recursive: true });

        const relativePath = `/uploads/${eventId}/${filename}`;
        const absolutePath = path.join(uploadDir, filename);
        await writeFile(absolutePath, buffer);

        const vectors = JSON.parse(vectorsStr);
        const photo = await db.addPhotoWithVectors(relativePath, eventId, vectors);

        console.log(`[API] Saved photo locally: ${relativePath}`);
        return NextResponse.json({ success: true, photo });

    } catch (e) {
        console.error("[API] Upload Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
