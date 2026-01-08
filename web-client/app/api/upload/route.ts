import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    console.log("[UPLOAD] Starting upload request...");
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const eventId = formData.get('eventId') as string;
        const vectorsStr = formData.get('vectors') as string;

        if (!file || !eventId || !vectorsStr) {
            console.error("[UPLOAD] Missing fields", { file: !!file, eventId, vectors: !!vectorsStr });
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        console.log(`[UPLOAD] processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);

        const buffer = await file.arrayBuffer();
        const vectors = JSON.parse(vectorsStr);

        // Upload to Supabase Storage
        const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        const filePath = `${eventId}/${filename}`;
        console.log(`[UPLOAD] Uploading to Supabase path: ${filePath}`);

        const { data, error } = await supabaseAdmin
            .storage
            .from('photos')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false
            });

        if (error) {
            console.error("[UPLOAD] Supabase Storage Error:", error);
            throw error;
        }

        console.log("[UPLOAD] Supabase Upload Success:", data);

        // Get Public URL
        const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('photos')
            .getPublicUrl(filePath);

        console.log(`[UPLOAD] Public URL generated: ${publicUrl}`);

        // Save to DB
        console.log("[UPLOAD] Saving to Database (Prisma)...");
        const photo = await db.addPhotoWithVectors(publicUrl, eventId, vectors);
        console.log("[UPLOAD] Database Save Success:", photo.id);

        return NextResponse.json({ success: true, photo });

    } catch (e) {
        console.error("[UPLOAD] CRITICAL ERROR:", e);
        return NextResponse.json({ error: "Internal Server Error: " + String(e) }, { status: 500 });
    }
}
