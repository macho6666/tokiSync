# ☁️ TokiSync (토끼싱크) v3.3.2

**북토끼, 뉴토끼, 마나토끼**의 콘텐츠를 **구글 드라이브로 직접 업로드**하고, **전용 웹 뷰어**를 통해 편리하게 관리/열람할 수 있는 올인원 솔루션입니다.

> **Original Idea by:** hehaho (tokiDownloader)  
> **Rewritten & Enhanced by:** pray4skylark

---

## ✨ 주요 기능

### 📥 수집기 (Client) - v3.2 (Remote Loader)

- **☁️ 구글 드라이브 직통 업로드:** PC 저장공간을 거치지 않고 메모리에서 바로 구글 드라이브로 전송합니다. (~100MB/s)
- **🔄 스마트 동기화:** 버튼 하나로 **"아직 받지 않은 회차"**만 자동으로 골라내어 다운로드합니다.
- **📚 다양한 포맷 지원:**
  - **웹툰/망가:** `.cbz` (압축 파일)
  - **소설:** `.epub` (전자책 표준, 챕터/목차 자동 생성)
- **🛡️ 강력한 차단 회피:**
  - **백그라운드 생존:** 탭을 내려놔도 멈추지 않도록 무음 오디오(Oscillator)를 재생합니다.
  - **캡차 감지:** 캡차/Cloudflare 감지 시 일시 정지하고 알림을 보냅니다.

### 📡 서버 (GAS API) - v3.3

- **📦 대용량 이어 올리기:** 구글 드라이브 API의 Resumable Upload를 구현, 기가바이트 단위 파일도 안정적으로 업로드합니다.
- **📂 카테고리 자동 분류:** `Webtoon`, `Novel`, `Manga` 폴더를 자동으로 생성하고 분류합니다.
- **⚡️ 초고속 인덱싱:** `library_index.json` 캐싱 시스템을 통해 수천 권의 책도 1초 만에 불러옵니다.

### 📊 통합 뷰어 (Unified Viewer) - v3.3

- **📜 통합 스크롤 모드 (New):**
  - **이미지(CBZ)와 텍스트(EPUB) 모두** 끊김 없는 세로 스크롤 경험을 제공합니다.
  - **더블 탭 네비게이션:** 모바일 환경에 최적화된 "더블 탭으로 다음 화 이동" 제스처.
- **📄 레거시 텍스트 엔진:** 무거운 외부 라이브러리(Foliate) 없이 자체 구현된 경량 엔진으로 EPUB을 렌더링합니다.
- **📱 반응형 디자인:** 모바일, 태블릿, 데스크탑 어디서든 완벽한 레이아웃을 지원합니다.

---

## ⚙️ 설치 가이드 (Installation)

**v3.3.0**부터 설치 과정이 대폭 간소화되었습니다.
자세한 단계별 설치 방법은 **[INSTALL_GUIDE.md](./INSTALL_GUIDE.md)** 문서를 참고하세요.

### 간편 요약

1.  **Server**: `google_app_script/TokiSync_Server_Bundle.gs` 코드를 복사하여 Google Apps Script에 붙여넣고 배포합니다.
2.  **Client**: Tampermonkey에 `tokiSyncScript.js`를 설치하고, 메뉴에서 Folder ID와 API URL을 설정합니다.
3.  **Viewer**: GitHub Pages 등을 통해 정적 호스팅하거나 로컬에서 `docs/index.html`을 엽니다.

---

## 📖 사용 방법 (Usage)

### ☁️ 자동 동기화

1.  웹툰/소설 리스트 페이지에 접속합니다.
2.  Tampermonkey 메뉴에서 `☁️ 자동 동기화`를 클릭합니다.
3.  드라이브를 스캔하여 **없는 회차만** 자동으로 다운로드 및 업로드됩니다.

### 📊 뷰어 열기

1.  설치된 뷰어 URL로 접속합니다.
2.  메인 화면에서 라이브러리를 탐색합니다.
3.  책을 클릭하여 **스크롤 모드** 또는 **페이지 모드**로 감상합니다.

---

## 📜 Version History

자세한 변경 내역은 [update_history.md](./update_history.md)를 참고하세요.

- **v3.3.2**: 레거시(TokiView GAS) 코드 제거, 서버 코드 번들링, 설치 가이드 추가.
- **v3.3.1**: Foliate 라이브러리 제거, 텍스트 스크롤 모드 안정화.
- **v3.3.0**: 통합 스크롤 모드(Text/Image) 도입.

## 📜 License

[MIT License](./LICENSE). Use responsibly.
