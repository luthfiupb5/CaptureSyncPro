import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await db.deletePhoto(id);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
    }
}
