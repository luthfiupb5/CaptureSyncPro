-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "username" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Event table
CREATE TABLE IF NOT EXISTS "Event" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "banner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Photo table
CREATE TABLE IF NOT EXISTS "Photo" (
    "id" TEXT PRIMARY KEY,
    "url" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
);

-- Create FaceVector table
CREATE TABLE IF NOT EXISTS "FaceVector" (
    "id" TEXT PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "vectorStr" TEXT NOT NULL,
    CONSTRAINT "FaceVector_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE
);

-- Add foreign key constraint for User.eventId
ALTER TABLE "User" 
ADD CONSTRAINT "User_eventId_fkey" 
FOREIGN KEY ("eventId") REFERENCES "Event"("id") 
ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "Photo_eventId_idx" ON "Photo"("eventId");
CREATE INDEX IF NOT EXISTS "FaceVector_eventId_idx" ON "FaceVector"("eventId");
CREATE INDEX IF NOT EXISTS "FaceVector_photoId_idx" ON "FaceVector"("photoId");

-- Insert default super admin user
INSERT INTO "User" ("id", "username", "password", "role", "eventId", "createdAt")
VALUES (
    gen_random_uuid()::text,
    'luthfi',
    'Luthfi@2005',
    'super_admin',
    NULL,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;
