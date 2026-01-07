import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const photos = await db.getPhotos(id);
        return NextResponse.json(photos);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
    }
}
