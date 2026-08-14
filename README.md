# Document Search

Upload `.pdf` and `.docx` files, have their text extracted in the background, and search inside them with typo tolerance and highlighted snippets. Files go straight from the browser to S3 without passing through the API; an embedded worker picks up the S3 event from SQS, parses the file, indexes it into OpenSearch, and pushes the status change to the browser over Server-Sent Events.

Built as a practical on asynchronous cloud pipelines: the interesting part is not the CRUD, it is what happens between "the upload finished" and "the document is searchable" — and how the user finds out.

## Architecture

```
Browser (Next.js)
   │
   ├─ 1. POST /api/documents/upload-url ──────────► NestJS API ──► Neon Postgres
   │                                                                (row: PENDING)
   ├─ 2. PUT file ────────────────────────────────► S3 bucket
   │                                                    │
   ├─ 3. GET /api/notifications/sse (held open)         │ 4. s3:ObjectCreated
   │                              ▲                     ▼
   │                              │                 SQS queue
   │                              │                     │
   │                              │        5. long poll │
   │                              │                     ▼
   │                              │        ┌────────────────────────┐
   │                              │        │ In-app worker (NestJS) │
   │                              │        │  download → parse      │
   │                              │        └────────┬───────────────┘
   │                              │                 │
   │                              │        ┌────────┴────────┐
   │                              │        ▼                 ▼
   │                              │   OpenSearch       Neon Postgres
   │                              │   (index text)     (PENDING → INDEXED)
   │                              │                          │
   └──────────────────────────────┴──────────────────────────┘
                    6. SSE push: {status: "INDEXED"}
```

The browser never polls. Step 6 is the whole point of steps 3–5.

## Stack

**Backend** — NestJS 11, Drizzle ORM, Neon (serverless Postgres), `@aws-sdk/client-s3`, `@aws-sdk/client-sqs`, `@opensearch-project/opensearch`, `pdf-parse` v2, `mammoth`, Zod for env validation

**Frontend** — Next.js 16 (App Router, Turbopack, React Compiler), React 19, TanStack Query, Zustand, Tailwind v4, native `EventSource`

**Infrastructure** — AWS S3, SQS, OpenSearch (single node, fine-grained access control), Neon Postgres

## Repository layout

```
api/    NestJS backend — REST API and the embedded SQS worker
web/    Next.js frontend
```

### Backend structure

```
src/
├── config/         namespaced @nestjs/config factories, each Zod-validated
├── core/db/        Drizzle schema, connection pool, typed database handle
├── integrations/   thin wrappers over external SDKs (S3, SQS, OpenSearch client)
└── modules/        business domains: documents, parsing, notifications, worker
```

`integrations/` holds only what is generic about a dependency. Everything the domain decides — the OpenSearch index name, its mapping, the query DSL — lives in `modules/documents`, because none of it would survive swapping the search engine anyway.

### Frontend structure

```
src/
├── app/(auth)/login/     email gate
├── app/(app)/            search page, documents page, shared layout
│   └── */_components/    colocated with the route that owns them
├── services/             API surface, one object per domain
├── utils/                own helpers: fetch client, validation, pure transforms
├── hooks/, store/, types/
```

Route-local folders are prefixed with `_` so Next excludes them from routing. `services/` talks to the network, `utils/` never does.

## Local setup

Requires Node 20+, and AWS resources already provisioned (S3 bucket with event notifications to SQS, an OpenSearch domain, a Neon database).

```bash
# backend
cd api
npm install
cp .env.example .env        # fill in — see below
npm run db:migrate          # apply migrations to Neon
npm run start:dev           # http://localhost:5000/api

# frontend, in a second terminal
cd web
npm install
cp .env.example .env.local
npm run dev                 # http://localhost:3000
```

`GET /api/health` returns `{"status":"ok"}` once the API is up. On first boot the API creates the OpenSearch index and logs `Created index "documents"`.

## Environment variables

### `api/.env`

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `5000`; `3000` is taken by `next dev`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `DATABASE_URL` | Neon connection string — use the **pooled** host, it contains `-pooler` |
| `AWS_REGION` | Region for every AWS client |
| `AWS_S3_BUCKET_NAME` | Upload bucket |
| `AWS_SQS_QUEUE_URL` | Queue receiving `s3:ObjectCreated` events |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Local development only. Omit in production — the EC2 instance role supplies credentials and the SDK finds them |
| `OPENSEARCH_NODE` | Domain endpoint, including `https://` |
| `OPENSEARCH_AUTH_USERNAME`, `OPENSEARCH_AUTH_PASSWORD` | Fine-grained access control master user |

Each group is parsed by its own Zod schema at boot, so a missing or malformed value fails the process immediately with a message naming the variable.

### `web/.env.local`

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL. Must carry the `NEXT_PUBLIC_` prefix — it is read in the browser, not on the server |

## Tests

```bash
cd api && npm test    # 58 tests
cd web && npm test    # 17 tests
```

The suites deliberately cover only logic owned here — extension dispatch, whitespace normalization, ownership checks, the permanent/transient error split, SSE reference counting, the query scoping filter, and highlight escaping. Wrappers around `pdf-parse`, `mammoth` and the AWS SDKs are not tested, because such tests would only assert that those libraries work.

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/upload-url` | Creates a `PENDING` row and returns a presigned S3 `PUT` URL |
| `GET` | `/api/documents?email=` | Documents for one user, newest first |
| `GET` | `/api/documents/search?q=&email=` | Fuzzy full-text search with highlighted fragments |
| `DELETE` | `/api/documents/:id?email=` | Removes the row, the S3 object, and the index entry |
| `GET` | `/api/notifications/sse?email=` | Server-Sent Events stream: `ping` every 15s, `document` on status change |
| `GET` | `/api/health` | Liveness |

Identity is a plain email — no passwords, no sessions. It is a query parameter on the SSE route because the browser's `EventSource` API cannot send custom headers at all.

## Design decisions

**Uploads bypass the API.** The browser `PUT`s directly to S3 with a presigned URL, so a 10 MB file never occupies API bandwidth or memory. The signature covers `Content-Type` and `Content-Length`, which is what stops a client from uploading something other than what it declared.

**The size limit is enforced three times** — in the browser, in the presigned signature, and by a `HeadObject` call in the worker. Only the last one sees the object that actually landed in the bucket.

**`userEmail` is a `keyword` field, not `text`.** This single line in the index mapping is what enforces user isolation. A `text` field would be analysed into tokens, and the `term` filter that scopes every search would stop matching exactly. The user scope is a `filter` clause rather than `must`, so it never participates in scoring.

**Highlights use `[[HL]]` sentinels instead of `<em>`.** OpenSearch wraps matches in whatever tags you ask for, but it does not escape the surrounding document text. A `.docx` containing `<img src=x onerror=...>` would come back verbatim inside the fragment, and rendering that as HTML would execute it in the next person's browser. The frontend splits on the sentinels and builds React elements, where every part becomes an escaped text node.

**The worker separates permanent from transient failures.** A corrupt file, a wrong content type or a scanned PDF with no text layer writes `status = ERROR` and deletes the message — retrying will never produce a different answer. Anything else (OpenSearch unreachable, a dropped database connection) is rethrown, leaving the message on the queue for redelivery. Getting this backwards either marks documents failed because a dependency blinked, or loops forever on a file that can never parse.

**Indexing waits for the refresh.** New OpenSearch documents only become searchable on a ~1s refresh cycle. Without `refresh: 'wait_for'`, the worker would flip the row to `INDEXED`, the browser would receive the SSE event instantly, and a search run right then would find nothing.

**One SSE stream per user, reference counted.** Three open tabs share one subject; the stream is torn down only when the last one disconnects, and the map entry is deleted so it does not leak. The 15-second heartbeat is load-bearing rather than decorative: an idle SSE connection sends zero bytes, and CloudFront (60s max) and Nginx (60s default) both read a long silence as a dead connection.

**Server state lives in TanStack Query, not Zustand.** Zustand holds only the persisted email. Search results are keyed by query, which removes an entire class of race condition — a slow response for an old query cannot overwrite a newer one.

## Operational notes

### A domain can report `Active` while its cluster is dead

`describe-domain` reflects the control plane — whether AWS finished provisioning. It says nothing about whether the cluster inside is functional. A domain whose cluster manager node has disappeared reports `"Processing": false, "Status": "Active"` while rejecting every single request.

The symptom is misleading. The OpenSearch security plugin keeps its configuration in an internal index; with no cluster manager it cannot read that index, cannot initialise, and answers basic auth with a flat `401 Authentication finally failed` — the same response for correct credentials, wrong credentials, and no credentials at all. It looks exactly like a wrong password, and no amount of password resetting fixes it.

Two checks separate the two causes:

```bash
# 1. Does an unauthenticated request differ from an authenticated one?
#    Identical responses mean credentials are not being evaluated at all.
curl -s -o /dev/null -D- "$OPENSEARCH_NODE/"

# A genuine auth failure includes a challenge header:
#   www-authenticate: Basic realm="OpenSearch Security"
# Its absence means the request never reached the auth layer.

# 2. Ask CloudWatch whether the cluster exists.
#    Nodes and ClusterStatus.* are published by the cluster itself,
#    so no datapoints means no cluster — even while JVMMemoryPressure
#    keeps reporting, because the JVM process is still alive.
aws cloudwatch get-metric-statistics --namespace AWS/ES --metric-name Nodes \
  --dimensions Name=DomainName,Value=<domain> Name=ClientId,Value=<account-id> \
  --start-time "$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 3600 --statistics Maximum --region us-east-1
```

A domain in this state cannot be repaired by a configuration change, because a blue/green deployment needs the new node to join a cluster that does not exist. Deleting it can also hang for the same reason, and there is no force-delete API. The way out is to create a **new domain under a different name** and repoint `OPENSEARCH_NODE`; the broken one can be left to finish deleting on its own schedule.

### `update-domain-config` silently ignores a password-only change

Changing just `MasterUserOptions` returns HTTP 200 with no error and no effect — `UpdateVersion` does not increment and `ChangeProgressDetails` still points at the previous change. `AdvancedSecurityOptions` contains no other difference, and AWS never stores the password in a readable form to compare against, so the update is discarded as empty. Verify that a change actually registered before assuming it applied:

```bash
aws opensearch describe-domain-change-progress --domain-name <domain> --region us-east-1
# Status: COMPLETED with a stale ChangeId means nothing happened.
```

### Quote passwords in `.env`, or pick shell-safe ones

`dotenv` reads `KEY=va'lue` without complaint. The shell does not:

```
$ source .env
./.env: line 10: unexpected EOF while looking for matching `''
```

The application works, so this stays invisible until something outside Node reads the same file — systemd's `EnvironmentFile=`, `docker run --env-file`, or any deploy script. `$` is worse than a quote, because inside double quotes the shell expands it. Either quote every value or avoid `'`, `"`, `$` and backticks in generated secrets.

### OpenSearch mappings are immutable

Editing the mapping in code does nothing to an index that already exists — the bootstrap only creates it when absent. A mapping mistake therefore survives every restart and every redeploy. Delete the index and let it be recreated:

```bash
curl -XDELETE -u "admin:$OPENSEARCH_AUTH_PASSWORD" "$OPENSEARCH_NODE/documents"
```

This matters most for `userEmail`. If the index is ever auto-created by an indexing call rather than by the bootstrap, dynamic mapping makes it `text`, the `term` filter stops matching, and search silently returns nothing for everyone. The service guards against this by re-running the bootstrap before the first write if the one at startup failed.

### S3 sends a test event, and encodes keys

The first message on a newly attached notification is `s3:TestEvent`, which has no `Records` array. Naive iteration throws on the very first message the worker ever receives, and then loops forever because the message is never deleted. S3 also URL-encodes object keys and encodes spaces as `+`, so `my report.pdf` arrives as `my+report.pdf`.

### `Content-Length` cannot be set from the browser

It is a forbidden header name in the Fetch spec: the browser refuses to let JavaScript set it and computes it from the body instead. The presigned URL signs `file.size`, and the browser sends exactly that, so the signature still verifies — but passing the header through explicitly reads as though it were being sent, which it is not.

## Limitations

- **SSE works on a single instance.** Subscriptions live in process memory, so behind a load balancer a user connected to instance A receives nothing when the worker on instance B indexes their file. The architecture targets one EC2 instance, so this is correct as built; the fix would be Redis pub/sub between instances.
- **Identity is an unverified email.** Anyone can type any address and see that address's documents. Deliberate — the brief asks for simplified identification, not authentication.
- **One file at a time.** No batch upload, no progress bar.
