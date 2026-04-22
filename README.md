# Insighta Labs — Intelligence Query Engine

A REST API for querying demographic profiles with advanced filtering, sorting, pagination, and natural-language search. Built with Node.js, Express, and MongoDB.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# → set MONGODB_URI and SEED_FILE_URL

# 3. Seed the database
npm run seed

# 4. Start the server
npm start
```

### Local development with Docker (MongoDB included)

```bash
SEED_FILE_URL=https://your-url docker compose up --build -d
docker compose exec api npm run seed
```

---

## Environment Variables

| Variable        | Required     | Description                                          |
|-----------------|--------------|------------------------------------------------------|
| `MONGODB_URI`   | ✅           | MongoDB connection string                            |
| `SEED_FILE_URL` | ✅ for seeding | URL of the JSON file with the 2026 profiles         |
| `PORT`          |              | HTTP port (default `3000`)                           |

---

## Endpoints

### `GET /api/profiles`

Returns paginated, filtered, and sorted profiles.

**Query parameters**

| Parameter                 | Type   | Default      | Notes                                              |
|---------------------------|--------|--------------|----------------------------------------------------|
| `gender`                  | string |              | `male` or `female`                                 |
| `age_group`               | string |              | `child`, `teenager`, `adult`, `senior`             |
| `country_id`              | string |              | ISO 3166-1 alpha-2 (e.g. `NG`, `KE`)              |
| `min_age`                 | int    |              | Inclusive lower bound                              |
| `max_age`                 | int    |              | Inclusive upper bound                              |
| `min_gender_probability`  | float  |              | 0.0–1.0                                            |
| `min_country_probability` | float  |              | 0.0–1.0                                            |
| `sort_by`                 | string | `created_at` | `age`, `created_at`, `gender_probability`          |
| `order`                   | string | `desc`       | `asc` or `desc`                                    |
| `page`                    | int    | `1`          | Page number                                        |
| `limit`                   | int    | `10`         | Results per page (max 50)                          |

All filters are combinable. A result must satisfy every condition.

**Example**
```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
```

**Success response (200)**
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 312,
  "data": [
    {
      "id": "019622b3-...",
      "name": "emmanuel",
      "gender": "male",
      "gender_probability": 0.99,
      "age": 34,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.85,
      "created_at": "2026-04-01T12:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/profiles/search`

Converts a plain-English query into structured filters and returns matching profiles.

| Parameter | Required | Notes              |
|-----------|----------|--------------------|
| `q`       | ✅       | Natural-language query string |
| `page`    |          | Default `1`        |
| `limit`   |          | Default `10`, max `50` |

**Example**
```
GET /api/profiles/search?q=young males from nigeria&page=1&limit=10
```

---

## Natural Language Parser

### Overview

The parser is entirely **rule-based** — no AI, no LLMs, no external services. It applies a fixed sequence of regex patterns and lookup steps to the query string and accumulates a filter object. Each step is independent; results are combined.

**Parsing pipeline**

```
query string
  → [1] Gender check        (regex against known male/female word lists)
  → [2] Age group check     (regex against child/teen/adult/senior keywords)
  → [3] "young" check       (only if no age group found → maps to min_age=16, max_age=24)
  → [4] Threshold check     (above N / below N patterns)
  → [5] Country lookup      (text after "from"/"in" → ISO-2 code)
  → filter object (or null if nothing parsed)
```

A query must produce at least one filter to be accepted; otherwise the endpoint returns `"Unable to interpret query"`.

---

### Supported keywords and their filter mappings

#### Gender

| Keywords | Filter |
|----------|--------|
| `male`, `males`, `man`, `men`, `boy`, `boys`, `gentleman` | `gender = male` |
| `female`, `females`, `woman`, `women`, `girl`, `girls`, `lady`, `ladies` | `gender = female` |
| Both male AND female keywords present | No gender filter applied |

#### Age groups

| Keywords | Filter |
|----------|--------|
| `child`, `children`, `kid`, `kids`, `infant`, `toddler` | `age_group = child` |
| `teen`, `teens`, `teenager`, `teenagers`, `adolescent` | `age_group = teenager` |
| `adult`, `adults`, `grown-up`, `middle-aged` | `age_group = adult` |
| `senior`, `seniors`, `elderly`, `elder` | `age_group = senior` |

Only the first matching age group is applied.

#### "young" keyword

| Keyword | Filters applied | Condition |
|---------|----------------|-----------|
| `young` | `min_age = 16, max_age = 24` | No age group keyword was also present |

Per the spec, `young` is **not** a stored age_group value. It maps to an age range for parsing only. If an age group keyword co-occurs (e.g. `young adults`), the age group takes precedence and `young` is ignored.

#### Explicit age thresholds

| Pattern | Filter |
|---------|--------|
| `above N`, `over N`, `older than N`, `at least N` | `min_age = N` |
| `below N`, `under N`, `younger than N`, `at most N` | `max_age = N` |

These combine freely with age groups (e.g. `teenagers above 17` → `age_group=teenager AND min_age=17`).

#### Country

Triggered by the prepositions **from** or **in** followed by a country name. 80+ countries and common aliases are supported.

```
"from nigeria"     → country_id = NG
"in south africa"  → country_id = ZA
"from the gambia"  → country_id = GM
```

Country matching is **greedy** (longest name first), so `south africa` matches before `africa`.

---

### Full example mappings

| Query | Resolved filters |
|-------|-----------------|
| `young males` | `gender=male, min_age=16, max_age=24` |
| `females above 30` | `gender=female, min_age=30` |
| `people from angola` | `country_id=AO` |
| `adult males from kenya` | `gender=male, age_group=adult, country_id=KE` |
| `male and female teenagers above 17` | `age_group=teenager, min_age=17` |
| `young males from nigeria` | `gender=male, min_age=16, max_age=24, country_id=NG` |
| `senior women in ghana` | `gender=female, age_group=senior, country_id=GH` |

---

### Limitations

1. **No synonym expansion.** Words like `youngster`, `youth`, `lad`, `lass` are not recognised. Only the exact keywords listed above work.

2. **"young" is overridden by any age group keyword.** `young adults` applies `age_group=adult` only; the 16–24 range is silently dropped.

3. **One age group per query.** The first matching pattern wins.

4. **Country names must follow "from" or "in".** Adjective forms like `nigerian males` are not detected.

5. **`guinea` alone maps to Guinea (GN)**, not Guinea-Bissau or Equatorial Guinea. Use the full name for those.

6. **`congo` alone maps to Republic of the Congo (CG).** Use `drc` or `democratic republic of congo` for CD.

7. **No compound age ranges.** `between 20 and 40` or `ages 25–35` are not parsed.

8. **No negation.** `not from nigeria` or `non-adult` are not handled.

9. **No probability filters via NL.** Use the structured `/api/profiles` endpoint for that.

10. **No fuzzy matching or spell correction.** `nigerria` will not be recognised.

---

## Error Responses

```json
{ "status": "error", "message": "<description>" }
```

| Code | When |
|------|------|
| 400  | Missing or empty required parameter (`q` for `/search`) |
| 422  | Invalid parameter value; uninterpretable NL query |
| 404  | Route not found |
| 500  | Unhandled server error |

---

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Express 4
- **Database:** MongoDB 7 via Mongoose 8
- **IDs:** UUID v7 (`uuid` package)
- **Deployment:** Docker / any Node-capable host (Railway, AWS EC2, Heroku, etc.)
