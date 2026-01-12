import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const events = await db.getEvents();

    const enrichedEvents = await Promise.all(events.map(async (e) => {
        const creds = await db.getEventAdmin(e.id);
        return { ...e, credentials: creds };
    }));

    return NextResponse.json(enrichedEvents);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, banner } = body;

        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const result = await db.createEvent(name, banner);
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ error: "Invalid Request" }, { status: 500 });
    }
}
