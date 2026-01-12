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

    return NextResponse.json({
        user: {
            id: userId,
            role,
            eventId: eventId || null
        }
    });
}
