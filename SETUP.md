# TBNC 상담 신청 폼 → Google Sheet 연동 셋업

이 페이지의 상담 신청 폼은 제출 시 데이터를 **Google Apps Script Web App** 으로 POST 합니다. 그 스크립트가 시트 `05.홈페이지DB` 의 **A–F 컬럼에만** 새 행을 추가합니다.

배포는 5분 안에 끝납니다. 한 번만 하면 됩니다.

---

## 시트 구조 (이미 작성되어 있음 — 건드리지 않음)

크롬으로 직접 확인한 `05.홈페이지DB` (gid=1251654467) 실제 구조:

| 컬럼 | 헤더 | 자동 입력 여부 | 비고 |
|---|---|---|---|
| A | No. | **자동** | 기존 최대 번호 + 1 |
| B | 접수일시 | **자동** | 제출 시각 |
| C | 성함 | **자동** | 폼 `담당자` |
| D | 연락처 | **자동** | 폼 `연락처` |
| E | 회사명 | **자동** | 폼 `회사명` |
| F | 유입페이지 | **자동** | "메인페이지 (데스크탑/모바일)" + 유형 / 이메일 / 문의 내용 (multi-line) |
| G–H | (공란) | 절대 안 건드림 | 기존 시트의 스페이서 |
| I | No. | 절대 안 건드림 | TM 블록 카운터 |
| J–U | 담당자 · TM상태 · TM일자 · TM메모 · 미팅일정 · 미팅장소 · 미팅결과 · 미팅메모 · 계약여부 · 계약금액 · 계약일자 · 비고 | 절대 안 건드림 | 운영팀 TM 관리 영역 |

**원칙**: 헤더 행은 절대 자동 생성하지 않습니다. G컬럼부터는 한 셀도 안 씁니다.

폼이 보내는 `이메일`·`문의유형`·`문의내용` 은 **F (유입페이지) 셀 안에 줄바꿈으로 같이 보관**합니다. 운영팀이 F 셀을 클릭하거나 행 높이를 늘리면 다 보입니다. (시트에 새 컬럼을 안 만들기 위함.)

---

## 1단계. Apps Script 열기

1. [시트 열기](https://docs.google.com/spreadsheets/d/1k0Y_0Z3BQskGxmcOcw0AnCTB-9PqFLaMeqq2AO8bODo/edit) → 상단 메뉴 **확장 프로그램 → Apps Script**
2. 새 탭에서 코드 편집기가 열립니다. 기본 `Code.gs` 안의 모든 코드를 지웁니다

---

## 2단계. 아래 코드 전체를 복사 → `Code.gs` 에 붙여넣기 → 저장(Ctrl+S)

```javascript
/**
 * TBNC 홈페이지 상담 신청 → 05.홈페이지DB 시트 자동 입력
 *
 * 이 스크립트는 시트의 A-F 컬럼에만 데이터를 추가합니다.
 * G컬럼 이후 (담당자/TM/계약/비고) 는 절대 건드리지 않습니다.
 * 헤더 행도 자동 생성하지 않습니다 — 시트가 비어 있으면 에러를 반환합니다.
 *
 * 컬럼 매핑:
 *   A 번호        → max(A) + 1
 *   B 접수일시    → new Date()
 *   C 성함        → form.name
 *   D 연락처      → form.phone
 *   E 회사명      → form.company
 *   F 유입페이지  → "메인페이지 (데스크탑/모바일)" + 문의유형 + 이메일 + 문의내용
 */

const SHEET_ID   = '1k0Y_0Z3BQskGxmcOcw0AnCTB-9PqFLaMeqq2AO8bODo';
const SHEET_NAME = '05.홈페이지DB';

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonOut({ ok: false, error: '시트를 찾을 수 없음: ' + SHEET_NAME });
    }

    const p = e.parameter || {};

    // 컬럼 A 만 스캔해서 마지막 데이터 행과 max No. 를 구한다.
    // (sheet.getLastRow() 는 G~U 의 TM 데이터까지 포함하므로 사용 안 함.)
    const lastSheetRow = sheet.getLastRow();
    if (lastSheetRow < 2) {
      return jsonOut({ ok: false, error: '시트가 비어 있음. 헤더(Row 2) 가 먼저 있어야 합니다.' });
    }
    const aValues = sheet.getRange(1, 1, lastSheetRow, 1).getValues();
    let lastFormRow = 2; // 헤더 위치 (Row 2) 를 기본값으로
    let maxNo = 0;
    for (let i = 0; i < aValues.length; i++) {
      const v = aValues[i][0];
      // 셀 값이 숫자이면 No. 후보
      if (typeof v === 'number') {
        if (v > maxNo) maxNo = v;
        lastFormRow = i + 1; // 1-indexed
      } else if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
        const n = parseInt(v.trim(), 10);
        if (n > maxNo) maxNo = n;
        lastFormRow = i + 1;
      } else if (v !== '' && v !== null) {
        // 숫자가 아니어도 비어있지 않으면 다음 행 기준점은 갱신
        lastFormRow = i + 1;
      }
    }
    const targetRow = lastFormRow + 1;
    const nextNo    = maxNo + 1;

    // F (유입페이지) 셀에 부가 정보까지 multi-line 으로 모음.
    // 시트에 새 컬럼을 안 만들기 위한 패킹.
    const sourceKr = (p.source === 'mobile') ? '모바일' : '데스크탑';
    const inflow =
      '메인페이지 (' + sourceKr + ')\n' +
      '─\n' +
      '유형: '   + (p.type    || '') + '\n' +
      '이메일: ' + (p.email   || '') + '\n' +
      '내용: '   + (p.message || '(없음)');

    // A:F 만 setValues — G컬럼 이후는 절대 안 건드림.
    sheet.getRange(targetRow, 1, 1, 6).setValues([[
      nextNo,
      new Date(),
      p.name    || '',
      p.phone   || '',
      p.company || '',
      inflow
    ]]);

    return jsonOut({ ok: true, row: targetRow, no: nextNo });

  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 배포 URL 을 브라우저로 열면 "TBNC webhook OK ..." 가 보입니다 (헬스 체크).
function doGet() {
  return ContentService.createTextOutput('TBNC webhook OK · 05.홈페이지DB 전용');
}
```

---

## 3단계. 웹 앱으로 배포

1. 우상단 **배포(Deploy) → 새 배포(New deployment)** 클릭
2. 톱니바퀴 → **웹 앱(Web app)** 선택
3. 설정:
   - **설명**: `TBNC 상담 신청 수신` (자유)
   - **다음 사용자로 실행 (Execute as)**: **나(본인 계정)**
   - **액세스 권한 (Who has access)**: **모든 사용자(Anyone)** ← 중요. 익명도 호출 가능이어야 폼에서 호출됨
4. **배포(Deploy)** 클릭
5. 처음이면 권한 승인 창이 뜹니다 → 본인 계정 선택 → "고급 → 안전하지 않은 페이지로 이동 → 허용". (본인 스크립트라 안전합니다.)
6. 배포 완료 화면에서 **웹 앱 URL** 복사. `https://script.google.com/macros/s/AKfycb.../exec` 형태

---

## 4단계. `config.js` 에 URL 붙여넣기

`tbnc-site/config.js` 12번째 줄의 따옴표 안에 방금 복사한 URL 을 넣습니다.

```javascript
// Before
window.TBNC_WEBHOOK_URL = '';

// After
window.TBNC_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

저장 후 페이지(index.html / mobile.html) 새로고침.

---

## 5단계. 동작 확인

1. 시트 `05.홈페이지DB` 의 현재 마지막 데이터 행(`No.` 컬럼 최대값) 기억
2. 페이지에서 상담 신청 폼을 채우고 제출
3. "접수되었습니다" 표시되면 시트로 가서 **A–F 컬럼 다음 행**에 새 데이터가 들어갔는지 확인
4. G–U 컬럼은 그대로 비어있는지 확인 (운영팀 입력 영역이라 자동 입력되면 안 됨)

배포 URL 헬스 체크: 브라우저로 그 URL 을 열면 `TBNC webhook OK · 05.홈페이지DB 전용` 텍스트가 나옵니다.

---

## 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| 시트에 행이 안 생김 | 1) `Who has access` 가 `Anyone` 인지 재확인 (가장 흔한 실수) <br/> 2) Apps Script 편집기 좌측 **실행(Executions)** → doPost 로그 확인 <br/> 3) 콘솔(F12) 의 fetch 에러 확인 |
| `시트가 비어 있음` 에러 | `05.홈페이지DB` 시트의 Row 1 또는 Row 2 에 헤더가 있는지 확인 |
| `No.` 가 1 부터 다시 시작 | 컬럼 A 의 기존 No. 값이 텍스트(`'1`) 로 저장돼 있을 수 있음. 숫자로 변경 |
| 행이 엉뚱한 위치에 들어감 | TM 영역(J–U)에 form 데이터보다 더 아래까지 채워진 행이 있는 경우. 이 스크립트는 컬럼 A 기준으로 lastFormRow 를 잡기 때문에 정상이지만, 운영팀이 빈 A 행을 만들고 J–U 만 채워두면 그 행 위에 덧쓸 수 있음. 그런 경우 운영팀에 알려 A 컬럼도 같이 채우도록 안내 |

---

## 추후 코드 수정 시

Apps Script 코드를 바꾸면 **반드시 새 버전으로 재배포**해야 라이브 URL 에 반영됩니다.

1. 배포 → **배포 관리(Manage deployments)**
2. 기존 배포 옆 연필 아이콘
3. **버전: 새 버전(New version)** 선택 → 배포
4. URL 은 그대로 유지됩니다 (config.js 수정 불필요)

---

## 보안 메모

- 이 webhook 은 누구나 호출 가능합니다. 악성 봇이 스팸을 넣을 수 있음
- 봇 스팸이 생기면 다음 중 하나:
  1. Apps Script 안에서 honeypot 필드 검사
  2. Cloudflare Turnstile / hCaptcha 추가
  3. 시트로 들어온 행을 매일 확인해서 수동 분류
- B2B 상담 페이지라 처음엔 그대로 가도 됨
