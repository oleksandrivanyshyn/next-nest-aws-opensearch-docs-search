1. Project Overview & Goal
   Development of a full-featured system for uploading, asynchronously parsing, indexing, and full-text searching documents (.pdf, .docx). The system utilizes direct file uploads to AWS S3 via Presigned URLs, event notifications via AWS SQS, an embedded in-app background worker in NestJS for text extraction, AWS OpenSearch for search queries, and Server-Sent Events (SSE) for real-time user status notifications.

2. Complete Technical Stack
   Frontend: Next.js (TypeScript, App Router), Tailwind CSS, Zustand (State Management), Native Browser EventSource (for SSE).

Hosting: Vercel (with automated HTTPS).

Backend: NestJS (TypeScript), Drizzle ORM, @aws-sdk/client-s3, @aws-sdk/client-sqs, @opensearch-project/opensearch, pdf-parse, mammoth.

Hosting: AWS EC2 (Ubuntu) + Nginx (Reverse Proxy) + AWS CloudFront + AWS Certificate Manager (ACM for SSL).

Database: Neon.tech (Serverless PostgreSQL) + Drizzle Kit (migrations & Drizzle Studio).

Cloud Infrastructure (AWS):

AWS S3: File storage (configured with S3 Event Notifications).

AWS SQS: Message queue for file creation events.

AWS OpenSearch: Single-node cluster for full-text search supporting fuzziness and highlight.

AWS CloudFront + ACM: CDN and free SSL certificate sitting in front of EC2.

3. System Architecture & Data Flow
   Plaintext
   [Browser / Next.js (Vercel)]
   │
   ├── 1. Request Presigned URL ───────────────────► [NestJS API (EC2 / CloudFront)]
   ├── 2. Upload File Direct (PUT) ────────────────► [AWS S3 Bucket]
   ├── 3. SSE Stream Connection (GET /sse) ─────────► [NestJS API (EC2)]
   │                                                      │
   [AWS S3] ── 4. s3:ObjectCreated:* Event ──► [AWS SQS Queue]  │
   │           │
   5. Long Polling        │
   │           │
   [In-App NestJS Worker] │
   │           │
   ┌─────────────────┴───────────┤
   ▼                             ▼
   [AWS OpenSearch]                 [Neon PostgreSQL]
   (Index Text)                   (Update Status -> SSE Push)
4. Complete Task Specifications & Business Requirements
   A. Authentication / User Context
   Simplified identification via user email (stored in localStorage on the frontend and passed in headers/queryParams to the backend).

B. File Upload Flow
Validation: Only .pdf and .docx files allowed, size < 10 MB.

Presigned URL: Frontend calls POST /api/documents/upload-url with filename and contentType.

Database Pre-save: Backend creates a record in Neon DB with status PENDING and returns an S3 Presigned PUT URL.

Direct S3 Upload: Frontend issues a PUT request with the binary payload directly to S3, bypassing backend bandwidth.

C. Processing & Parsing Flow (In-App SQS Worker)
Upon file upload, S3 emits an event notification to AWS SQS.

An embedded background service in NestJS (SqsListenerService) polls SQS using Long Polling (WaitTimeSeconds: 20).

Worker extracts bucket and fileKey from the SQS message payload and downloads the object from S3 into memory.

Parsing:

.pdf → processed via pdf-parse.

.docx → processed via mammoth.

OpenSearch Indexing: Extracted text is indexed into OpenSearch (index documents) alongside metadata (documentId, userEmail, filename, content, createdAt).

Database & Status Update: Status in Neon DB is updated to INDEXED (or ERROR upon failure).

Delete SQS Message: Message is explicitly deleted from the SQS queue upon completion.

D. Real-Time Notifications (SSE)
Client opens a single EventSource channel: GET /api/notifications/sse?email=user@example.com.

When the In-App worker updates a document's status in the DB (PENDING → INDEXED / ERROR), NestJS SseService immediately pushes the updated document payload to this active stream.

E. Search Requirements
Endpoint: GET /api/documents/search?q=search_term&email=user@example.com.

Executes an OpenSearch query configured with:

Fuzziness: fuzziness: "AUTO" (for typo tolerance).

Highlighting: Returns matching text snippets wrapped in tags (<em>term</em>).

User Isolation: Strict filtering by userEmail.

5. Database Schema (Neon Postgres + Drizzle ORM)
   TypeScript
   // src/db/schema.ts
   import { pgTable, uuid, text, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const documentStatusEnum = pgEnum('document_status', ['PENDING', 'INDEXED', 'ERROR']);

export const documents = pgTable('documents', {
id: uuid('id').defaultRandom().primaryKey(),
userEmail: varchar('user_email', { length: 255 }).notNull(),
userFilename: text('user_filename').notNull(),
s3Key: text('s3_key').notNull().unique(),
status: documentStatusEnum('status').default('PENDING').notNull(),
errorMessage: text('error_message'),
createdAt: timestamp('created_at').defaultNow().notNull(),
updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
6. API Endpoints Specification
   Method	Endpoint	Description
   POST	/api/documents/upload-url	Generates S3 Presigned URL and creates record in DB with status PENDING.
   GET	/api/documents	Retrieves all document records for a specific user (?email=...).
   GET	/api/documents/search	Performs full-text search against OpenSearch index (?q=query&email=...).
   DELETE	/api/documents/:id	Deletes document record from Neon DB, S3 bucket, and OpenSearch index.
   GET	/api/notifications/sse	Establishes persistent SSE stream for real-time status updates (?email=...).
7. Infrastructure & Security Configuration
   A. CORS Configuration
   S3 Bucket CORS Policy: Allows PUT and POST methods from Vercel domain and http://localhost:3000.

NestJS CORS: app.enableCors({ origin: ['[https://your-app.vercel.app](https://your-app.vercel.app)', 'http://localhost:3000'], credentials: true }).

B. Deployment Setup (AWS EC2 + CloudFront + ACM)
EC2 Instance: Ubuntu, Node.js 20+, Nginx listening on port 80 proxying to [http://127.0.0.1:3000](http://127.0.0.1:3000).

AWS ACM: Free SSL certificate requested in AWS Console.

AWS CloudFront: Distribution pointing to EC2 origin with ACM certificate attached.

Security Group: Port 3000 bounded strictly to 127.0.0.1. Ports 80/443 restricted exclusively to AWS CloudFront IP ranges (or verified via custom X-Origin-Verify header).

8. Development & Environment Variables
   Backend .env
   Фрагмент коду
   PORT=3000
   DATABASE_URL="postgresql://user:password@ep-cool-site-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require"

AWS_REGION="eu-central-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET_NAME="doc-search-bucket"
AWS_SQS_QUEUE_URL="https://sqs.eu-central-1.amazonaws.com/123456789012/doc-events-queue"

OPENSEARCH_NODE="https://search-doc-cluster-xxxx.eu-central-1.es.amazonaws.com"
OPENSEARCH_AUTH_USERNAME="admin"
OPENSEARCH_AUTH_PASSWORD="YourPassword123!"
Frontend .env.local
Фрагмент коду
NEXT_PUBLIC_API_URL="https://xxxx.cloudfront.net/api"
9. Code Conventions & Rules for AI Agents
   Clean Code & Patterns: Enforce strict Dependency Injection in NestJS. Maintain clear separation between Controllers, Services, and Repositories.

Explicit Typings: Do not use any. All requests, responses, and events must feature explicit DTOs and TypeScript interfaces.

Drizzle Guidelines: Adhere to current Drizzle ORM standards using native pgTable. Table schema resides in src/db/schema.ts.

Error Handling: Ensure graceful failure handling inside the SQS worker. On failure, update status = 'ERROR' in Neon DB with error message logging so the frontend receives the event via SSE.