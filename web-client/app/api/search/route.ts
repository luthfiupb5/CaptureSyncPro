import { NextResponse } from 'next/server';
import { db, Photo } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { eventId, vector } = body;

        if (!eventId || !vector) {
            return NextResponse.json({ error: "Missing eventId or vector" }, { status: 400 });
        }

        const matches = await db.findMatches(eventId, vector);

        return NextResponse.json({ matches });

    } catch (e) {
        console.error("Search Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
