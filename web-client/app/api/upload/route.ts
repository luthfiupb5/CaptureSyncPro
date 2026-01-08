import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    console.log("[API] Registering photo metadata...");
    try {
        const body = await req.json();
        const { publicUrl, eventId, vectors } = body;

        if (!publicUrl || !eventId || !vectors) {
            console.error("[API] Missing fields", { publicUrl, eventId, vectors: !!vectors });
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        console.log(`[API] Registering photo: ${publicUrl}`);

        // Save to DB (Prisma)
        const photo = await db.addPhotoWithVectors(publicUrl, eventId, vectors);
        console.log("[API] Database Registration Success:", photo.id);

        return NextResponse.json({ success: true, photo });

    } catch (e) {
        console.error("[API] Registration Error:", e);
        return NextResponse.json({ error: "Internal Server Error: " + String(e) }, { status: 500 });
    }
}
