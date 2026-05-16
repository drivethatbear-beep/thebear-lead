// TBNC 사이트 설정
// ----------------------------------------------------------------------
// 상담 신청 폼 제출 시 데이터를 받을 Google Apps Script Web App 의 URL.
//
// 설정 방법:
//   1. SETUP.md 의 단계대로 Google Sheet 에 Apps Script 를 배포
//   2. 배포 후 받은 "/exec" 로 끝나는 URL 을 아래 따옴표 안에 붙여넣기
//   3. 저장 후 페이지 새로고침
//
// URL 이 비어 있으면 폼은 "접수되었습니다" 표시만 하고 시트에는 안 들어갑니다.
// (배포 전이라도 UI 테스트는 정상 동작)
window.TBNC_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbz00IZNA8RI9uv9NLuOLOX4t_zF7CzC_Wl9uDkjs2PNdkJsCjQNVUnOGZWoRJ_FLj3u/exec';
