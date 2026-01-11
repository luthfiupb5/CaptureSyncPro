# CaptureSync Pro 📸

**AI-Powered Event Photo Distribution & Management Platform**

CaptureSync Pro is a next-generation event photography platform designed to automate the process of sorting and distributing event photos. Using advanced client-side AI, it allows event attendees to instantly find every photo they appear in just by uploading a single selfie, eliminating the need to scroll through thousands of gallery images.

For Event Organizers, it offers a "Deep Dark Luxury" Admin Console with studio-grade tools, secure role-based access, and instant QR code sharing.

---

## 🚀 Key Features

### 🤖 Smart AI Face Recognition
- **Instant Discovery**: Attendees take a selfie, and the AI finds all their photos in milliseconds.
- **Privacy-First Processing**: Face detection and recognition happen securely.
- **High Efficiency**: Optimized for speed, handling thousands of photos with ease.

### 🛡️ Secure Admin Console
- **Role-Based Access Control (RBAC)**:
  - **Super Admin**: Full control over all events, users, and system settings.
  - **Program Admin**: Event-specific credentials auto-generated upon creation. Strictly isolated environment—Program Admins only see and manage their assigned event.
- **Studio Mode**: Apply custom branding overlays (watermarks, frames) automatically during upload.
- **Live Credentials**: One-click generation and copying of strict login credentials for event coordinators.

### ⚡ Technical Excellence
- **Hyper-Fast Uploads**: Direct-to-disk streaming with concurrent batch processing.
- **Responsive Premium UI**: Glassmorphic design with fluid animations, optimized for all devices.
- **QR Code Integration**: Instantly generate and download event-specific QR codes for easy guest access.

---

## 🧠 How It Works: The AI Deep Dive

CaptureSync Pro leverages **TensorFlow.js** and **Face-API.js** to perform complex computer vision tasks directly in the browser and server-side node environment.

### 1. Face Detection & Landmark Alignment
When a photo is uploaded (or a selfie is taken), the system uses the **SSD Mobilenet V1** neural network—a lightweight yet powerful model—to detect faces within the image. It identifies 68 facial landmarks (eyes, nose, mouth contour) to align the face perfectly.

### 2. Feature Vectorization (The "Face Hash")
Once aligned, the face is passed through a **ResNet-34** architecture model. This model analyzes the facial features and outputs a **128-dimensional floating-point vector** (feature descriptor).
- This vector is a unique numerical representation of the face (like a digital fingerprint).
- **We do NOT store faces for recognition; we store these mathematical vectors.**
- This ensures privacy and makes searching incredibly fast.

### 3. Vector Storage & Euclidean Matching
- **Storage**: The 128-float vectors are serialized and stored in our local optimized JSON database (`db.json`), linked to the photo ID and Event ID.
- **Matching**: When a user searches with a selfie, the same vectorization process happens. The system then calculates the **Euclidean Distance** between the selfie's vector and every stored vector in that specific event.
- **Threshold**: If the distance is below a strict threshold (e.g., `0.45`), it is a match. The lower the distance, the higher the confidence.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + Vanilla CSS Variables
- **AI Engine**: Face-API.js / TensorFlow.js
- **Database**: Custom High-Performance Local JSON Adapter (No external DB required)
- **Icons**: Lucide React

---

## 💻 Installation & Setup

Follow these steps to clone and run the project locally.

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/CaptureSync_advanced.git
cd CaptureSync_advanced/web-client
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the client app.
Acces the Admin Console at [http://localhost:3000/admin/login](http://localhost:3000/admin/login).

**Default Super Admin Credentials**:
- **Username**: `luthfi`
- **Password**: `Luthfi@2005`

---

## 👨‍💻 Meet the Developer

**Luthfi Bassam U P**
*Full Stack Developer | AI Enthusiast*

Creating seamless intersections between premium design and complex AI logic.

- 📧 **Email**: [connect.luthfi05@gmail.com](mailto:connect.luthfi05@gmail.com)
- 💼 **LinkedIn**: [Luthfi Bassam](https://www.linkedin.com/in/luthfibassamup/)
- 🐙 **GitHub**: [@luthfiupb5](https://github.com/luthfiupb5)

---

&copy; 2024 CaptureSync Pro. All rights reserved.
