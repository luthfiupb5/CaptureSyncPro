import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();
        console.log('[LOGIN] Attempting login for username:', username);

        const user = await db.getUser(username);
        console.log('[LOGIN] User found:', !!user);

        if (!user || user.password !== password) {
            console.log('[LOGIN] Invalid credentials');
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const response = NextResponse.json({ success: true, role: user.role });

        const sessionValue = `${user.id}:${user.role}:${user.eventId || ''}`;

        const cookieStore = await cookies();
        cookieStore.set('auth_session', sessionValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24
        });

        console.log('[LOGIN] Login successful for user:', username);
        return response;
    } catch (e) {
        console.error('[LOGIN] Error:', e);
        return NextResponse.json({
            error: "Server error",
            details: process.env.NODE_ENV === 'development' ? String(e) : undefined
        }, { status: 500 });
    }
}
