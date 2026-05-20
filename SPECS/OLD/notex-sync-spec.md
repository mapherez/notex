# Sync System Design (Google Drive + IndexedDB)

## Core Architecture

- IndexedDB = source of truth (local DB)
- Google Drive (appDataFolder) = remote sync/backup
- Backend (homelab) = auth + realtime notifications (no data storage)

---

## Cloud Storage Structure

appDataFolder/
  notex-manifest.json
  notex-workspace.json
  notex-note-<id>.json

- 1 file per note
- manifest = index of all notes (id, fileId, hash, updatedAt)
- workspace = settings, tags, collections, etc.

---

## Sync Model (Three-Way Sync)

Each device keeps:

baseHash   = last synced version (from syncItems)
localHash  = current local state (IndexedDB)
remoteHash = current cloud state (manifest)

### Decision Logic

local == remote
→ no-op

local == base && remote != base
→ remote changed → pull

local != base && remote == base
→ local changed → push

local != base && remote != base
→ conflict

- Hash is computed from note content (ignore sync-only fields)
- Do NOT rely on timestamps for conflict detection

---

## Sync Flow

async function syncNow() {
  await pullRemoteChanges();
  await pushLocalChanges();
  await pullRemoteChanges(); // optional safety pass
}

---

## Pull Phase (Critical)

- Fetch manifest
- Compare with local syncItems
- For each note:
  - If missing locally → download
  - If remote changed → overwrite local
  - If both changed → mark conflict

---

## Push Phase

- Only push notes where localHash !== remoteHash
- Use:
  - createJsonFile() if missing remotely
  - updateJsonFile() if exists

---

## Conflict Handling

### Detection

local != base && remote != base

### Store Conflict

{
  entityId,
  baseHash,
  localHash,
  remoteHash,
  localSnapshot,
  remoteSnapshot,
  status: 'conflict'
}

---

## Conflict Resolution UI

| LOCAL | REMOTE |
|-------|--------|
|       FINAL     |

### Actions

- Keep Local
- Use Remote
- Duplicate Both
- Manual Merge

---

## Manual Merge

- User selects values per field (title, intro, summary, etc.)
- Final merged note is saved and pushed

---

## Realtime Sync Between Devices

### Goal

Notifications to trigger sync (not data transport)

### Flow

Device A syncs → backend notified  
→ backend sends event  
→ Device B receives → syncNow()

### Event

{
  type: 'sync-hint',
  userId,
  deviceId,
  timestamp
}

---

## UX Notifications

- Success: "Note updated remotely — synced"
- Conflict: "Conflict detected — review"

---

## Sync Triggers

- On app start
- On reconnect / tab focus
- On notification event
- Optional polling (1–5 min)

---

## Queue Handling

if (isSyncing) {
  syncRequested = true;
  return;
}

if (syncRequested) {
  syncRequested = false;
  syncNow();
}

---

## Summary

- Drive = storage
- IndexedDB = primary DB
- Use three-way sync
- Pull before push
- Detect conflicts via hash
- Backend = notifications only
- Prioritize no data loss
