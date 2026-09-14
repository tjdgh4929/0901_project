# 개인 블로그 페이지 구조

## 페이지

- `index.html`: 게시글 목록, 검색, 카테고리 필터, 더 보기
- `post-detail.html`: 실제 게시글 본문, 좋아요, 링크 복사
- `write.html`: 게시글 작성·수정, 서버 및 브라우저 임시저장
- `profile.html`: 로그인 계정 정보와 본인 게시글 수정·삭제
- `login.html`: 로그인 폼
- `signup.html`: 회원가입 폼

## 공통 자원

- `css/style.css`: 블로그 전체 디자인과 반응형 레이아웃
- `js/main.js`: 모바일 메뉴, 인증, 게시글 CRUD, 로컬 캐시와 자동 임시저장
- `apps-script/Code.gs`: Google Sheets 인증·게시글 API와 서버 캐시

정적 프론트엔드는 배포된 Google Apps Script API를 통해 회원과 게시글 데이터를 저장하고 조회한다.
