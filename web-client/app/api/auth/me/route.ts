import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function GET() {
    const cookieStore = await cookies();
    const session = cookieStore.get('auth_session');

    if (!session) {
        return NextResponse.json({ user: null });
    }

    const [userId, role, eventId] = session.value.split(':');

    // In a real app we would verify this against DB, but for MVP we trust the cookie
    // or re-fetch to be safe
    // const user = await db.getUserById(userId); 

    return NextResponse.json({
        user: {
            id: userId,
            role,
            eventId: eventId || null
        }
    });
}
