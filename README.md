# To-Do List App Backend

Pynexia Backend Development Internship — Week 1 project.

A RESTful task-management API built with **Node.js, Express and SQLite** (`better-sqlite3`). Tasks are stored in a database and can be created, listed, updated, completed and deleted, with status tracking and input validation.

## Run
```bash
npm install
npm start        # http://localhost:3000
npm test         # smoke tests (in-memory database)
```

## Task model
| Field | Type | Notes |
|---|---|---|
| id | integer | auto-increment |
| title | text | required, max 120 chars |
| description | text | optional, max 1000 chars |
| status | text | `pending` · `in_progress` · `completed` |
| priority | text | `low` · `medium` · `high` |
| due_date | text | `YYYY-MM-DD` or null |
| created_at / updated_at / completed_at | datetime | managed by the server |

## Endpoints
| Method | Route | Purpose |
|---|---|---|
| GET | `/tasks` | list tasks (filters: `?status=`, `?priority=`, `?search=`) |
| GET | `/tasks/:id` | get one task |
| POST | `/tasks` | create a task |
| PUT | `/tasks/:id` | update fields (partial updates allowed) |
| PATCH | `/tasks/:id/complete` | mark a task completed |
| DELETE | `/tasks/:id` | delete a task |
| GET | `/stats` | counts by status |

## Example
```bash
curl -X POST localhost:3000/tasks -H "Content-Type: application/json" \
  -d '{"title":"Finish week 1 report","priority":"high","due_date":"2026-11-02"}'

curl -X PATCH localhost:3000/tasks/1/complete
curl "localhost:3000/tasks?status=completed"
```

Errors return JSON: `400` (validation, with a list of messages), `404` (not found), `500` (server).

## Skills
Task model design · database integration · CRUD endpoints · status management · input validation · REST

Author: Junaideen Risny Suha
