# Changelog

All notable changes to this project will be documented in this file.

## [v1.3.0] - 2026-02-06

### 🚀 Direct Access (Performance)

- **Direct Drive Upload/Download**: GAS를 거치지 않고 Google Drive API에 직접 연결하여 속도가 2배 이상 향상되었습니다.
- **Auto Fallback**: Direct Access 실패 시 기존 GAS Relay 방식으로 자동 전환되어 안정성을 보장합니다.

### 🛡️ Stability (Anti-Ban)

- **Anti-Sleep**: 백그라운드 탭에서도 다운로드가 멈추지 않도록 무음 오디오 재생 기능을 탑재했습니다.
- **Captcha Detection**: Cloudflare 및 각종 캡차 감지 시 다운로드를 일시정지하고 사용자에게 알림을 보냅니다.
- **Sleep Policy Presets**: `Agile(빠름)`, `Cautious(신중)`, `Thorough(철저)` 모드를 설정 메뉴에서 선택할 수 있습니다.

### 🛠 Improvements

- **Refactored Core**: `fetcher.js`, `downloader.js` 등이 Direct Access를 지원하도록 구조가 개선되었습니다.
- **UI Enchancement**: 설정 모달에 `다운로드 속도(Sleep Mode)` 옵션 추가, 로그창에 Anti-Sleep 토글 버튼 추가.

## [v1.2.0] - 2026-02-04

### 🔒 Security (Critical)

- **API Key Enforcement**: GAS 서버의 모든 요청(업로드, 리스트 조회, 뷰어 접속 등)에 API Key가 필수로 변경되었습니다.
- **Script Properties**: API Key를 소스 코드 내 하드코딩하지 않고 GAS '스크립트 속성'(`API_KEY`)에 안전하게 저장합니다.

### 📡 Server (GAS)

- **Version Bump**: v1.0.0 -> v1.2.0
- **Validation**: `doPost`에서 모든 `view_*` 요청에 대해서도 API Key 검증 로직 추가.
- **Response**: `doGet` 응답 메시지에 서버 버전(v1.2.0) 표시.

### 📥 Client (UserScript)

- **Bundled Core**: `tokiSync.user.js` 하나로 모든 기능 통합 (기존 `new_core` 병합).
- **Zero-Config Injection**: 로컬(`localhost`, `127.0.0.1`) 또는 공식 뷰어(`github.io`) 접속 시, 자동으로 API Key와 설정을 주입하는 기능 추가.
- **Proxy**: Cross-Origin 요청(CORS)을 우회하기 위한 메시지 프록시 기능 최적화.

### 📊 Viewer

- **Hybrid Configuration**:
  - **Auto**: UserScript가 설치된 브라우저에서 접속 시 자동 설정.
  - **Manual**: 설정 메뉴에서 API Key 수동 입력 지원 (localStorage 저장).
- **Thumbnail Reliability**: Google Drive 썸네일(lh3) 로딩 실패(429 Error) 시 자동 재시도 및 지연 로딩(Lazy Loading) 구현.
- **UI Update**: 설정 모달 및 패널에 'API Key' 입력 필드 추가 (`input[type="password"]`).

---

## [v1.1.3] - 2026-01-XX

- **Remote Loader**: 수집기 로직 개선.
- **Unified Viewer**: 텍스트/이미지 통합 뷰어 최초 도입.
