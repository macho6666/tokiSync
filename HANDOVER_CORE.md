# Core Module Handover Report

**Current Version:** v1.2.2 (Released)  
**Next Version:** v1.3.0 (Planned)  
**Role:** Core Developer (Planner)

---

## 🚀 Status: v1.2.2 Released (Stable)

### Completed Fixes

1.  **Filename Logic**:
    - Local: Added `[Start-End]` range to filenames.
    - GAS Upload: Removed redundant series title from filenames.
2.  **Title Parsing**: Fixed duplicate title bug (`255 - 255` -> `255`).
3.  **Client Version**: Synced `CLIENT_VERSION` with UserScript version.
4.  **Auto-Update**: Added Tampermonkey update headers.

---

## 📋 Plan: v1.3.0 (Ready for Execution)

**Goal**: Boost performance (Direct Access) & Restore stability features.  
**Blueprint**: See `implementation_plan.md` for full technical details.

### 1. Direct Drive Access (Primary)

- **Concept**: Bypass GAS Relay for both Upload/Download.
- **Mechanism**:
  - **Server**: Returns OAuth Token (`view_get_token`).
  - **Client**: Uses `GM_xmlhttpRequest` + Host Permission to access `googleapis.com` directly.
- **Fallback**: Keep existing GAS Relay logic for safety.

### 2. Legacy Features Revival

- **Anti-Sleep**: Background audio loop to prevent Chrome tab throttling.
- **Captcha Detection**: Pause queue when Cloudflare/Anti-bot is detected.
- **Sleep Policy Presets**:
  - **Agile**: 1.0s ~ 4.0s (Default)
  - **Cautious**: 1.25s ~ 5.0s
  - **Thorough**: 1.5s ~ 6.0s

### 3. Implementation Order (Recommended)

1.  **Server (`SyncService.gs`)**: Add `view_get_token`.
2.  **Common (`api_client.js`)**: Add `fetchDirect` bridge.
3.  **Viewer (`fetcher.js`)**: Implement Direct Download with Fallback.
4.  **Downloader (`gas.js`)**: Implement Direct Upload with Fallback.
5.  **Downloader (`downloader.js`)**: Add Anti-Sleep & Captcha logic.

---

## 📂 Key Documents

- **`implementation_plan.md`**: v1.3.0 Technical Spec & Work Item breakdown.
- **`task.md`**: Active checklist.
