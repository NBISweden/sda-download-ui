# Bulk Dataset Download — Decision Meeting Document

**Purpose:** Decide which solution to implement for the "Download dataset" feature.
**Outcome required:** Pick (a) the short-term implementation and (b) the long-term direction.

---

## 1. Context

### User story
> As a user, I want to click on a "Download dataset" button so that I can download a whole dataset with minimal intervention.

### Key facts
- A dataset may contain **tens of thousands of files**.
- Each file may be **several GB** in size.
- Users may also want to download **a subset** of a dataset (e.g. 30–50 selected files).
- Expected UX: **click once, leave it running unattended for hours/days, come back later**.
- The download API supports **file-by-file download only** — no dataset archive endpoint.
- The download API authenticates with the **same session JWT** the web app already uses.
- Users are primarily on **Windows machines, often restricted, without WSL**.
- Some Ubuntu support is also required.
- The current web app is a Next.js application running in a standard browser.
- A native CLI tool, **`sda-cli`**, already exists for Windows and Ubuntu and supports dataset download:

```bash
./sda-cli --config <config_file> download \
  --pubkey <public-key-file> \
  --dataset-id <datasetID> \
  --url <download-service-URL> <filepath>
```

- `sda-cli` requires an `s3cmd`-style config file. All required values are available from the user's session JWT and app configuration.

### Why the browser is generally not ideal for full-dataset workloads
For very large transfers, the browser is best used as a **control plane**:
- authenticate
- browse/select datasets
- initiate transfers

A **native process** is best for the **data plane**:
- run for hours/days
- retry/resume
- survive browser closure
- handle thousands of large files reliably

A browser-only solution is nonetheless feasible within known limits and is the right answer for **small-batch** downloads of selected files (see §4).

---

## 2. Problem statement

We need a "Download dataset" solution that:
- handles **full datasets** (tens of thousands of files, multi-GB each) robustly
- handles **small batches** (30–50 selected files) with a native per-file UX
- is usable on restricted Windows machines (and Ubuntu)
- aligns with existing `sda-cli` tooling where applicable
- is implementable in the current Next.js architecture

---

## 3. Options considered

The discussion narrows to three concrete approaches that, together, cover the full range of use cases:

### Option A — Full dataset via `sda-cli` handoff
**Description:** UI generates everything `sda-cli` needs and instructs the user to run it locally:
- generated `s3cmd`-style config (from session JWT + app config)
- copyable Windows command
- optional `.cmd` and PowerShell helpers
- optional Ubuntu shell script
- public-key file selection in the UI
- clear OS-specific instructions

**Pros:** robust at scale; reuses existing native tool; works on Windows + Ubuntu; implementable now; survives browser closure; supports multi-day unattended transfers.
**Cons:** not truly one-click; user must have `sda-cli` installed; some manual action remains; care needed around the session JWT in the generated config.

### Option B — Full dataset in Chromium via File System Access API + ZIP streaming fallback
**Description:** A purely in-browser implementation for full-dataset downloads, with the technique chosen automatically based on the user's browser.

- **On Chromium (Chrome / Edge):** use the File System Access API to write directly into a user-chosen folder, file by file, with a Web Worker pool, streaming `fetch`, IndexedDB manifest, and per-file `Range` resume.
- **On Firefox / Safari 14.1+:** use a Service Worker to intercept a virtual URL (e.g. `/__archive/dataset-123.zip`) and stream a ZIP64 archive built on the fly with `client-zip`, fed by sequential authenticated `fetch` streams. The browser saves one big `.zip` that the user unzips at the end.

**Pros:** zero install; no CLI, no helper, no extension; works on locked-down machines that forbid local tooling; single Next.js codebase; covers all major desktop browsers.
**Cons:** tab must stay open for the entire transfer; ~6 connections-per-origin cap; Firefox/Safari archive mode has no resume and is single-connection bandwidth bound; no mobile Safari support; throughput sensitive to corporate AV/proxy; truly unattended multi-day transfers are not realistic.

### Option C — Small batches (30–50 files) via simulated per-file clicks
**Description:** A purely in-browser implementation for **small subsets** of a dataset — typically 30–50 selected files — where the user expectation is "a few normal downloads", not "a bulk transfer".

- Loop sequentially over the selected files.
- For each file, trigger a save by clicking a hidden `<a download="...">`.
- Authentication: a Service Worker intercepts a virtual URL (e.g. `/__sw-download/<fileId>`) and proxies an authenticated `fetch`, streaming the response back to the browser's download manager.
- Wait for each file's stream to close before triggering the next, to avoid throttling.
- Show a per-file progress list: queued / downloading / done / failed.

**Pros:** native per-file UX — files land individually in the user's Downloads folder; no archive to unzip; zero install; multi-GB safe through streaming; works in all major desktop browsers within the size limit.
**Cons:** folder structure flattened; no per-file resume on connection drop; "Save As" dialogs cannot be silenced by the page; reliable only up to ~50 files (Safari deduplicates above that, Firefox throttles, Chromium prompts once for "multiple downloads").

---

## 4. Detailed design

### 4.1 Working assumptions
- Users may keep the tab open for hours or days when needed.
- The session JWT TTL is long enough for the entire transfer.
- The download API is per-file, authenticated with the session JWT.
- Selections range from a handful of files to the full dataset.

### 4.2 The three flows in one architecture

```
                ┌─────────────────────────────────────────┐
                │       User clicks "Download"            │
                └───────────────────┬─────────────────────┘
                                    │
              ┌─────────────────────┴────────────────────┐
              │ Selection size?                          │
              └─┬──────────────────────────────────────┬─┘
                │                                      │
       ≤ ~30–50 files                       large selection / full dataset
                │                                      │
                ▼                                      ▼
   ┌───────────────────────┐            ┌──────────────────────────┐
   │ Option C              │            │ Browser only?            │
   │ Per-file simulated    │            └─────────┬────────────────┘
   │ clicks via SW proxy   │                      │
   └───────────────────────┘             ┌────────┴────────┐
                                      yes                  no
                                         │                  │
                                         ▼                  ▼
                              ┌────────────────────┐  ┌──────────────────┐
                              │ Option B           │  │ Option A         │
                              │ Chromium: folder   │  │ sda-cli handoff  │
                              │ Other: ZIP stream  │  │ (Windows/Ubuntu) │
                              └────────────────────┘  └──────────────────┘
```

### 4.3 Option A — `sda-cli` for full datasets

**When:** large selections / full datasets, when local tooling is acceptable.

**Flow:**
1. User clicks **Download dataset**.
2. UI gathers public key and (optionally) destination path guidance.
3. Backend assembles, just-in-time:
   - `config.ini` (s3cmd-style, with the session JWT)
   - `run.cmd` (Windows, double-clickable, avoids PowerShell ExecutionPolicy issues)
   - optional `run.ps1` (PowerShell)
   - optional `run.sh` (Ubuntu)
   - `README.txt` with prerequisites and security warning
   - optionally bundled `sda-cli.exe` / `sda-cli` binaries
4. Bundle is streamed back as a ZIP and saved by the browser.
5. User unzips and double-clicks `run.cmd`.

**Why this is the right answer for full datasets:**
- Multi-day, resumable, parallel transfer that survives browser closure.
- Reuses an existing native tool built for this exact workload.
- No browser concurrency cap, no tab-lifecycle constraint.

**Care points:**
- `config.ini` carries the session JWT — bundle is sensitive.
- Generate just-in-time, never persist server-side, never log contents.
- Include a security warning in `README.txt`.
- (Optional) offer a passphrase to encrypt `config.ini` at rest.

### 4.4 Option B — Browser-only full-dataset download

**When:** browser-only is required (locked-down machines, no install allowed).

#### Chromium path — folder mode
- `showDirectoryPicker()` once at the start; handle persisted in IndexedDB.
- Coordinator Web Worker drives a pool of 4 download workers.
- Each worker streams one file with `fetch().body.pipeTo(writableStream)` — bytes never sit in JS memory.
- Per-file state in IndexedDB (URL, path, size, bytesWritten, status, retries).
- HTTP `Range` requests resume any individual file from `bytesWritten` after a network drop.
- Resume across accidental tab close on next visit.

**Delivers:** native folder tree, parallel transfers, per-file resume, multi-GB safe via streaming.

#### Firefox / Safari 14.1+ path — ZIP streaming
- Service Worker scoped to the app intercepts a virtual URL (e.g. `/__archive/dataset-123.zip`).
- Returns a streamed `Response` whose body is a ZIP64 archive built on the fly with [`client-zip`](https://github.com/Touffy/client-zip) (STORE-only, no compression — files are already large/incompressible).
- The encoder pulls each file via authenticated `fetch` and emits archive bytes incrementally.
- Browser writes one big `.zip` file via its normal download manager.

**Delivers:** one save prompt, one resulting `.zip`, true streaming, multi-GB safe, no backend change.

**Limits:** no resume (connection drop = whole archive restarts); effectively single-connection throughput; user must unzip at the end (recommend 7-Zip on Windows over Explorer's built-in unzip); SW crash truncates the archive; mobile Safari unsupported.

#### Runtime selection within Option B

```js
const caps = await detectCapabilities();

if (caps.fileSystemAccess) {
  return runFolderMode();          // Chromium
} else if (caps.serviceWorkerStreaming) {
  return runArchiveMode();         // Firefox / Safari 14.1+
} else {
  return showUnsupportedMessage();
}
```

### 4.5 Option C — Simulated per-file clicks for small batches

**When:** the user has selected a small subset of a dataset (≤ ~30–50 files).

**Flow:**
1. UI shows a per-file progress list.
2. For each file, sequentially:
   - Create a hidden `<a>` pointing to a Service Worker virtual URL: `/__sw-download/<fileId>`.
   - Click it. The SW intercepts, issues an authenticated `fetch`, and streams the response back to the browser's download manager.
   - Wait for the SW stream to close before moving to the next file (best available signal for "this file is done").
3. On completion, show the user a summary with any failures.

**Browser behavior at 30–50 files:**

| Browser | Behavior |
|---|---|
| Chrome / Edge | One "Allow multiple downloads" prompt on the second file, then OK. Reliable. |
| Firefox | Throttles rapid programmatic downloads. Sequential pacing avoids most drops. |
| Safari desktop | Aggressive deduplication; works for small counts when paced sequentially. **Above ~50 it becomes unreliable.** |
| Safari iOS | Not supported. |

**Why a separate mode and not a fallback of Option B:**
- For small selections, users expect files in their Downloads folder, not a ZIP to unzip.
- An archive UX is heavy-handed for 30–50 files.
- Per-file mode preserves the "normal download" mental model.

**Limits:**
- Folder structure is flattened (workaround: encode paths into filenames).
- No per-file resume on connection drop.
- "Save As" dialogs cannot be silenced by the page; if the user has *"always ask where to save"* enabled they get one prompt per file. Acceptable at 30–50, painful beyond.
- Hard ceiling near 50 files; above that, switch to Option B's archive mode (or to Option A if installed).

### 4.6 Common foundations across browser-based modes (B and C)
- Authenticated `fetch` with the session JWT (via Service Worker for `<a download>` paths).
- Streaming everywhere; no `await response.blob()`.
- Bounded retries with exponential backoff and jitter per file.
- Pre-flight storage estimate via `navigator.storage.estimate()`.
- Wake Lock where available.
- `beforeunload` warning and "Do not close this tab" banner.
- Cancel button that cleanly aborts in-flight `fetch` and SW streams.
- Verification step at the end: expected vs delivered files, with a clear failure list.

### 4.7 Backend prerequisites

| Requirement | Option A | Option B | Option C |
|---|---|---|---|
| Per-file endpoints with JWT in `Authorization` | ✅ | ✅ | ✅ |
| CORS allowing the web origin, `Content-Length` exposed | — | ✅ | ✅ |
| `Range` request support | nice-to-have | required (Chromium) | nice-to-have |
| Bundle-generation endpoint (`config.ini` + scripts + binaries) | ✅ | — | — |
| Service Worker scope on the app origin | — | ✅ | ✅ |

### 4.8 What each option delivers to the user

| Aspect | Option A (sda-cli) | Option B Chromium | Option B Firefox/Safari | Option C |
|---|---|---|---|---|
| Best for | Full dataset | Full dataset | Full dataset | 30–50 files |
| Install required | `sda-cli` | None | None | None |
| Prompts | Unzip + double-click | One folder pick | One save dialog | One per file (or "allow multiple") |
| Output | Native folder tree | Native folder tree | One `.zip` to unzip | Files in Downloads |
| Concurrency | Parallel, native | 4 parallel | Effectively 1 | Sequential (paced) |
| Per-file resume | Yes | Yes | No | No |
| Tab lifecycle | Browser can be closed | Tab must stay open | Tab must stay open | Tab must stay open |
| Multi-GB files | Yes | Yes | Yes | Yes |
| Multi-day unattended | Yes | No | No | No |

---

## 5. Recommendation

### Short term

- **Full datasets → Option A: `sda-cli` handoff.** This is the only realistic answer for tens of thousands of files at multi-GB each. The browser is the control plane; `sda-cli` is the data plane.
- **Small batches (≤ ~30–50 files) → Option C: simulated per-file clicks.** Native per-file UX, zero install, ships from the same Next.js codebase.
- **Browser-only full-dataset path (Option B) optional from day one.** Implement it if zero-install full-dataset downloads are a hard requirement for some users; otherwise treat as a future extension.

### Long term

- Reduce handoff friction on Option A by moving toward a **thin native launcher** and eventually a **custom protocol handler** (`sda-download://`).
- Keep Option C as the small-batch path indefinitely — it is the right tool for that job.
- Reconsider Option B as browser capabilities evolve (broader File System Access support, better Service Worker reliability).