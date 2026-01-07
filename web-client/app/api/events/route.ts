import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    const events = await db.getEvents();
    return NextResponse.json(events);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, banner } = body;

        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const event = await db.createEvent(name, banner);
        return NextResponse.json(event);
    } catch (e) {
        return NextResponse.json({ error: "Invalid Request" }, { status: 500 });
    }
}
