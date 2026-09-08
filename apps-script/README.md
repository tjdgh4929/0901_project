# Google Apps Script 인증 API 설정

## 1. 코드 설치

Google Apps Script 프로젝트의 `Code.gs` 내용을 이 폴더의 `Code.gs`로 교체한다.

## 2. 최초 설정

Apps Script 상단 함수 목록에서 `setupAuth`를 선택해 한 번 실행하고 Google 권한을 승인한다. 실행하지 않은 경우에도 첫 인증 요청에서 필요한 시트와 설정을 자동 생성한다.

설정이 끝나면 연결된 스프레드시트에 다음 시트가 생성된다.

- `Users`: 회원 정보와 암호화된 비밀번호
- `Sessions`: 로그인 세션 토큰의 해시와 만료 시각

## 3. 웹 앱 배포

1. **배포 → 새 배포**
2. 유형: **웹 앱**
3. 실행 사용자: **나**
4. 액세스 사용자: **모든 사용자**
5. 배포 후 `/exec`로 끝나는 URL 복사

현재 프론트엔드에 연결된 배포 URL:

```text
https://script.google.com/macros/s/AKfycbxWB-6R33-_lMdxYAni197Qkh_2EFTZuG1I8R_bnp1DqGbozbhKCXkbQVLr2xFXOC7ubg/exec
```

## 4. API 요청

브라우저에서 POST할 때는 CORS 사전 요청을 피하기 위해 Content-Type을 `text/plain;charset=utf-8`로 설정한다.

### 회원가입

```javascript
fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({
    action: 'signup',
    email: 'user@example.com',
    name: '홍길동',
    nickname: 'gildong',
    password: 'password123'
  })
});
```

### 로그인

```javascript
fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({
    action: 'login',
    email: 'user@example.com',
    password: 'password123'
  })
});
```

### 로그인 사용자 확인

```javascript
fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action: 'me', token })
});
```

### 로그아웃

```javascript
fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action: 'logout', token })
});
```

## 보안 범위

비밀번호 원문은 저장하지 않으며 salt, 서버 pepper, 반복 SHA-256 해시를 적용한다. 세션 토큰도 원문 대신 SHA-256 해시만 스프레드시트에 저장한다.

이 구성은 개인 학습 및 소규모 프로젝트용이다. 실제 개인정보를 다루는 상용 서비스는 Firebase Authentication 또는 Google Identity Platform 같은 전문 인증 서비스를 사용한다.
