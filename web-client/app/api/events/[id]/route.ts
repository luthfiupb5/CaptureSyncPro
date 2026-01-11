import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`[API] DELETE request for event: ${id}`);
        const deleted = await db.deleteEvent(id);

        if (!deleted) {
            console.warn(`[API] Event ${id} not found`);
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }
}
