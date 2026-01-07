import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const eventId = formData.get('eventId') as string;
        const vectorsStr = formData.get('vectors') as string;

        if (!file || !eventId || !vectorsStr) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const vectors = JSON.parse(vectorsStr);

        // Upload to Supabase Storage
        const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        const filePath = `${eventId}/${filename}`;

        const { data, error } = await supabaseAdmin
            .storage
            .from('photos')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false
            });

        if (error) {
            console.error("Supabase Upload Error:", error);
            throw error;
        }

        // Get Public URL
        const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('photos')
            .getPublicUrl(filePath);

        // Save to DB
        const photo = await db.addPhotoWithVectors(publicUrl, eventId, vectors);

        return NextResponse.json({ success: true, photo });

    } catch (e) {
        console.error("Upload Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
