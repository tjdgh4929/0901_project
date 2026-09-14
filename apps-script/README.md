# Google Apps Script 인증 API 설정

## 1. 코드 설치

Google Apps Script 프로젝트의 `Code.gs` 내용을 이 폴더의 `Code.gs`로 교체한다.

## 2. 최초 설정

Apps Script 상단 함수 목록에서 `setupAuth`를 선택해 한 번 실행하고 Google 권한을 승인한다. 실행하지 않은 경우에도 첫 인증 요청에서 필요한 시트와 설정을 자동 생성한다.

설정이 끝나면 연결된 스프레드시트에 다음 시트가 생성된다. 첫 API 요청에서도 자동 생성된다.

- `Users`: 회원 정보와 암호화된 비밀번호
- `Sessions`: 로그인 세션 토큰의 해시와 만료 시각
- `Posts`: 게시글 본문, 작성자, 공개 상태와 작성·수정 시각

## 3. 웹 앱 배포

1. **배포 → 새 배포**
2. 유형: **웹 앱**
3. 실행 사용자: **나**
4. 액세스 사용자: **모든 사용자**
5. 배포 후 `/exec`로 끝나는 URL 복사

현재 프론트엔드에 연결된 배포 URL:

```text
https://script.google.com/macros/s/AKfycbz70Zul59j0MRMdQCPPRFrG3kn1gqg4EHYw_OONJ4HsNpIrDG1w8Uq3kXQyJ6KiAz4l/exec
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
    email: '<EMAIL>',
    name: '<NAME>',
    nickname: '<NICKNAME>',
    password: '<PASSWORD>'
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
    email: '<EMAIL>',
    password: '<PASSWORD>'
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

### 게시글 API

- `GET ?action=listPosts`: 발행된 게시글 목록
- `GET ?action=getPost&id=게시글ID`: 발행된 게시글 상세
- `POST { action: "myPosts", token }`: 로그인 사용자의 글 목록
- `POST { action: "getMyPost", token, id }`: 본인 글 수정용 상세 조회
- `POST { action: "createPost", token, ...글정보 }`: 글 생성
- `POST { action: "updatePost", token, id, ...글정보 }`: 본인 글 수정
- `POST { action: "deletePost", token, id }`: 본인 글 삭제

글 정보에는 `title`, `category`, `summary`, `content`, `status`가 들어간다. `status`는 `PUBLISHED` 또는 `DRAFT`다.

## 보안 범위

비밀번호 원문은 저장하지 않으며 salt, 서버 pepper, 반복 SHA-256 해시를 적용한다. 세션 토큰도 원문 대신 SHA-256 해시만 스프레드시트에 저장한다.

이 구성은 개인 학습 및 소규모 프로젝트용이다. 실제 개인정보를 다루는 상용 서비스는 Firebase Authentication 또는 Google Identity Platform 같은 전문 인증 서비스를 사용한다.

## 성능 정책

- 공개 게시글 목록은 Apps Script 캐시에 2분간 저장한다.
- 게시글 상세는 Apps Script 캐시에 5분간 저장한다.
- 확인된 로그인 세션은 Apps Script 캐시에 5분간 저장하고 로그아웃 시 즉시 제거한다.
- 생성·수정·삭제 시 관련 서버 캐시가 즉시 제거된다.
- 브라우저는 목록 5분, 상세 10분, 내 글 2분 캐시를 사용하고 백그라운드에서 최신 데이터로 갱신한다.
- 글 작성 내용은 입력 후 350ms마다 브라우저에 자동 임시저장된다.
- 기존 비밀번호 해시는 첫 로그인에서 검증된 후 빠른 형식으로 자동 이전된다. 기존 계정의 첫 로그인만 평소보다 오래 걸릴 수 있다.
