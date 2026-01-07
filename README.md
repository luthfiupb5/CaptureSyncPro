# CaptureSync Pro (Web Edition)

**AI-Powered Event Photo Distribution Platform**

CaptureSync Pro has evolved from a local Python executable into a comprehensive web-based platform. It uses face recognition technology to automatically identify and distribute photos to event attendees, streamlining the workflow for photographers and organizers.

## ✨ Key Features

-   **🔍 AI Face Recognition**: Automatically matches attendees to their photos using `face-api.js`.
-   **� Cloud Storage**: Securely stores high-resolution images using **Supabase Storage**, eliminating local storage limits.
-   **⚡ Real-Time Admin Dashboard**:
    -   Manage multiple events.
    -   Upload photos directly (Single or Bulk).
    -   Monitor uploads and system status.
-   **� Modern Client Gallery**: A beautiful, responsive gallery for attendees to find their photos instantly by uploading a selfie.
-   **� Role-Based Access**: Secure login for Super Admins and Program Admins.

## �️ Technology Stack

-   **Frontend**: Next.js 15 (React 19), Tailwind CSS 4
-   **Backend**: Next.js API Routes (Serverless)
-   **Database**: PostgreSQL (via Prisma ORM)
-   **Storage**: Supabase Storage
-   **AI Model**: Face-API.js (TensorFlow.js)

## 🚀 Getting Started

### Prerequisites

-   **Node.js** (v18 or higher)
-   **Supabase Account** (for Storage)
-   **PostgreSQL Database** (Local or Cloud)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/luthfiupb5/CaptureSync.git
    cd CaptureSync/web-client
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the `web-client` directory with the following variables:
    ```env
    # Database (Prisma)
    DATABASE_URL="postgresql://user:password@localhost:5432/capturesync"

    # Authentication (JWT Secret)
    JWT_SECRET="your-super-secret-key"

    # Supabase Storage (Public/Anon Key)
    NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
    
    # Supabase Admin (Service Role - for server-side uploads)
    SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
    ```

4.  **Database Migration**
    ```bash
    npx prisma migrate dev --name init
    npx prisma generate
    ```

5.  **Run Development Server**
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) to verify.

## 👥 Usage

-   **Admin Panel**: Navigate to `/admin/login` to access the dashboard. (Default credentials needed if seeded).
-   **Client View**: The homepage `/` serves as the attendee portal to search for photos.

## 👤 Credits

**Developed By Luthfi Bassam U P**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/luthfibassamup/)

---
*Built with ❤️ by Luthfi Bassam U P*
