# Trash Cans Database

This folder contains all trash can configurations and their associated metadata.

## Structure

```
trash-cans/
├── images/                 # Store all trash can location images
│   └── TC001-outside-trash-can.png
├── trash-cans.json        # Master database of all trash cans
├── seedTrashCans.js       # Script to populate MongoDB from trash-cans.json
└── README.md              # This file
```

## Adding a New Trash Can

### Step 1: Add to `trash-cans.json`

```json
{
  "id": "TC002",
  "label": "Indoor Recycling Bin",
  "location": "Main Building, Floor 3",
  "image": "/uploads/TC002-recycling-bin.png",
  "description": "Secondary recycling location",
  "createdAt": "2026-01-24T10:31:32.000Z"
}
```

### Step 2: Add Image to `images/` folder

Place the image file in the `images/` folder with naming convention: `{ID}-{description}.png`

Example: `TC002-recycling-bin.png`

### Step 3: Run Seed Script

```bash
cd backend
node trash-cans/seedTrashCans.js
```

Or in your package.json, add a script:
```json
"scripts": {
  "seed:trash-cans": "node trash-cans/seedTrashCans.js"
}
```

## Trash Can Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Unique identifier (e.g., TC001) |
| `label` | String | Yes | Display name of the trash can |
| `location` | String | Yes | Physical location description |
| `image` | String | No | URL path to the image |
| `description` | String | No | Additional details about the can |
| `createdAt` | Date | Auto | Timestamp when created |

## Example Full Entry

```json
{
  "id": "TC001",
  "label": "Outside Trash Can",
  "location": "Smayans house",
  "image": "/uploads/outside-trash-can.png",
  "description": "Main outdoor trash can for general waste",
  "createdAt": "2026-01-24T10:31:32.000Z"
}
```

## QR Code Generation

Once seeded, QR codes can be generated via:

```
GET /api/qr?canId=TC001
```

This will return a PNG QR code that links to:
```
{FRONTEND_BASE_URL}/can/TC001
```

## Viewing All Trash Cans

```bash
GET /api/trash-cans
```

Returns all trash cans from the database.

## Viewing a Specific Trash Can

```bash
GET /api/trash-cans/TC001
```

Returns details for trash can with ID TC001.
