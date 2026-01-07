import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();
        const user = await db.getUser(username);

        if (!user || user.password !== password) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const response = NextResponse.json({ success: true, role: user.role });

        // Simple cookie-based session (Not secure for production, fine for MVP)
        // Format: "userid:role:eventId"
        const sessionValue = `${user.id}:${user.role}:${user.eventId || ''}`;

        const cookieStore = await cookies();
        cookieStore.set('auth_session', sessionValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 // 1 day
        });

        return response;
    } catch (e) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
