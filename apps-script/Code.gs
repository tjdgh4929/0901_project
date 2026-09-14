/**
 * 기록의 온도 - Google Sheets 인증 API
 *
 * 1. Apps Script에 이 파일을 붙여 넣습니다.
 * 2. setupAuth()를 한 번 직접 실행하고 권한을 승인합니다.
 * 3. 웹 앱으로 배포합니다.
 *
 * 주의: 소규모 학습용 구현입니다. 상용 서비스는 Firebase Auth,
 * Google Identity Platform 등 전문 인증 서비스를 사용하세요.
 */

const AUTH_CONFIG = Object.freeze({
  spreadsheetId: '1z7rvJsh5ZaNGIwxm2ubj9AT1lH5EF4SvUiuaLhBSz9I',
  usersSheet: 'Users',
  sessionsSheet: 'Sessions',
  postsSheet: 'Posts',
  hashIterations: 12000,
  sessionHours: 24,
  maxLoginAttempts: 5,
  loginBlockSeconds: 15 * 60,
});

const USER_HEADERS = [
  'id',
  'email',
  'name',
  'nickname',
  'passwordHash',
  'passwordSalt',
  'status',
  'createdAt',
  'lastLoginAt',
];

const SESSION_HEADERS = [
  'tokenHash',
  'userId',
  'expiresAt',
  'createdAt',
];

const POST_HEADERS = [
  'id',
  'title',
  'category',
  'summary',
  'content',
  'authorId',
  'authorName',
  'status',
  'createdAt',
  'updatedAt',
];

function setupAuth() {
  ensureAuthSetup_();
  return '인증용 시트와 보안 설정이 준비되었습니다.';
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');

    if (action === 'health') {
      return json_({ ok: true, message: 'Auth API is running.' });
    }

    if (action === 'listPosts') {
      return listPosts_();
    }

    if (action === 'getPost') {
      return getPost_(String(e.parameter.id || ''));
    }

    return json_({ ok: false, message: '지원하지 않는 요청입니다.' });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, message: '서버 처리 중 오류가 발생했습니다.' });
  }
}

function doPost(e) {
  try {
    const payload = parseBody_(e);
    const action = String(payload.action || '');

    if (action === 'signup') {
      return signup_(payload);
    }

    if (action === 'login') {
      return login_(payload);
    }

    if (action === 'logout') {
      return logout_(String(payload.token || ''));
    }

    if (action === 'me') {
      return getCurrentUser_(String(payload.token || ''));
    }

    if (action === 'myPosts') {
      return myPosts_(String(payload.token || ''));
    }

    if (action === 'createPost') {
      return createPost_(payload);
    }

    if (action === 'updatePost') {
      return updatePost_(payload);
    }

    if (action === 'deletePost') {
      return deletePost_(payload);
    }

    return json_({ ok: false, message: '지원하지 않는 요청입니다.' });
  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      message: error && error.message
        ? error.message
        : '요청을 처리하지 못했습니다.',
    });
  }
}

function signup_(payload) {
  const email = normalizeEmail_(payload.email);
  const name = cleanText_(payload.name, 40);
  const nickname = cleanText_(payload.nickname, 30);
  const password = String(payload.password || '');

  validateSignup_(email, name, nickname, password);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(AUTH_CONFIG.usersSheet);
    const users = getObjects_(sheet);

    if (users.some(function (user) { return normalizeEmail_(user.email) === email; })) {
      return json_({ ok: false, code: 'EMAIL_EXISTS', message: '이미 가입된 이메일입니다.' });
    }

    if (
      users.some(function (user) {
        return String(user.nickname).toLowerCase() === nickname.toLowerCase();
      })
    ) {
      return json_({ ok: false, code: 'NICKNAME_EXISTS', message: '이미 사용 중인 필명입니다.' });
    }

    const salt = createRandomToken_();
    const passwordHash = hashPassword_(password, salt);
    const now = new Date();
    const userId = Utilities.getUuid();

    sheet.appendRow([
      userId,
      email,
      name,
      nickname,
      passwordHash,
      salt,
      'ACTIVE',
      now,
      '',
    ]);

    return json_({
      ok: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        user: {
          id: userId,
          email: email,
          name: name,
          nickname: nickname,
        },
      },
    });
  } finally {
    lock.releaseLock();
  }
}

function login_(payload) {
  const email = normalizeEmail_(payload.email);
  const password = String(payload.password || '');

  if (!isValidEmail_(email) || !password) {
    return json_({ ok: false, code: 'INVALID_INPUT', message: '이메일과 비밀번호를 확인해 주세요.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    if (isLoginBlocked_(email)) {
      return json_({
        ok: false,
        code: 'TOO_MANY_ATTEMPTS',
        message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.',
      });
    }

    const usersSheet = getSheet_(AUTH_CONFIG.usersSheet);
    const users = getObjects_(usersSheet);
    const user = users.find(function (item) {
      return normalizeEmail_(item.email) === email;
    });

    const valid =
      user &&
      user.status === 'ACTIVE' &&
      constantTimeEqual_(
        hashPassword_(password, String(user.passwordSalt)),
        String(user.passwordHash)
      );

    if (!valid) {
      recordFailedLogin_(email);
      return json_({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    clearFailedLogins_(email);
    deleteExpiredSessions_();

    const token = createRandomToken_() + createRandomToken_();
    const tokenHash = sha256_(token);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + AUTH_CONFIG.sessionHours * 60 * 60 * 1000
    );

    getSheet_(AUTH_CONFIG.sessionsSheet).appendRow([
      tokenHash,
      user.id,
      expiresAt,
      now,
    ]);

    updateUserLastLogin_(usersSheet, user.__rowNumber, now);

    return json_({
      ok: true,
      message: '로그인되었습니다.',
      data: {
        token: token,
        expiresAt: expiresAt.toISOString(),
        user: publicUser_(user),
      },
    });
  } finally {
    lock.releaseLock();
  }
}

function logout_(token) {
  if (!token) {
    return json_({ ok: true, message: '로그아웃되었습니다.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_(AUTH_CONFIG.sessionsSheet);
    const tokenHash = sha256_(token);
    const sessions = getObjects_(sheet);
    const session = sessions.find(function (item) {
      return constantTimeEqual_(String(item.tokenHash), tokenHash);
    });

    if (session) {
      sheet.deleteRow(session.__rowNumber);
    }

    return json_({ ok: true, message: '로그아웃되었습니다.' });
  } finally {
    lock.releaseLock();
  }
}

function getCurrentUser_(token) {
  try {
    return json_({ ok: true, data: { user: publicUser_(requireUser_(token)) } });
  } catch (error) {
    return json_({
      ok: false,
      code: 'UNAUTHORIZED',
      message: error.message || '로그인이 필요합니다.',
    });
  }
}

function listPosts_() {
  const posts = getObjects_(getSheet_(AUTH_CONFIG.postsSheet))
    .filter(function (post) { return post.status === 'PUBLISHED'; })
    .sort(function (left, right) {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .map(publicPost_);

  return json_({ ok: true, data: { posts: posts } });
}

function getPost_(id) {
  if (!id) {
    return json_({ ok: false, code: 'INVALID_ID', message: '게시글 ID가 필요합니다.' });
  }

  const post = getObjects_(getSheet_(AUTH_CONFIG.postsSheet)).find(function (item) {
    return String(item.id) === id && item.status === 'PUBLISHED';
  });

  if (!post) {
    return json_({ ok: false, code: 'NOT_FOUND', message: '게시글을 찾을 수 없습니다.' });
  }

  return json_({ ok: true, data: { post: publicPost_(post) } });
}

function myPosts_(token) {
  const user = requireUser_(token);
  const posts = getObjects_(getSheet_(AUTH_CONFIG.postsSheet))
    .filter(function (post) { return String(post.authorId) === String(user.id); })
    .sort(function (left, right) {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .map(publicPost_);

  return json_({ ok: true, data: { posts: posts } });
}

function createPost_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const user = requireUser_(String(payload.token || ''));
    const data = validatePost_(payload);
    const sheet = getSheet_(AUTH_CONFIG.postsSheet);
    const now = new Date();
    const id = Utilities.getUuid();

    sheet.appendRow([
      id,
      data.title,
      data.category,
      data.summary,
      data.content,
      user.id,
      user.nickname || user.name,
      data.status,
      now,
      now,
    ]);

    const post = {
      id: id,
      title: data.title,
      category: data.category,
      summary: data.summary,
      content: data.content,
      authorId: user.id,
      authorName: user.nickname || user.name,
      status: data.status,
      createdAt: now,
      updatedAt: now,
    };

    return json_({
      ok: true,
      message: data.status === 'PUBLISHED' ? '게시글이 발행되었습니다.' : '임시저장되었습니다.',
      data: { post: publicPost_(post) },
    });
  } finally {
    lock.releaseLock();
  }
}

function updatePost_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const user = requireUser_(String(payload.token || ''));
    const id = String(payload.id || '');
    const data = validatePost_(payload);
    const sheet = getSheet_(AUTH_CONFIG.postsSheet);
    const post = getObjects_(sheet).find(function (item) {
      return String(item.id) === id;
    });

    if (!post) {
      return json_({ ok: false, code: 'NOT_FOUND', message: '게시글을 찾을 수 없습니다.' });
    }

    if (String(post.authorId) !== String(user.id)) {
      return json_({ ok: false, code: 'FORBIDDEN', message: '수정 권한이 없습니다.' });
    }

    const updatedAt = new Date();
    sheet.getRange(post.__rowNumber, 1, 1, POST_HEADERS.length).setValues([[
      post.id,
      data.title,
      data.category,
      data.summary,
      data.content,
      post.authorId,
      post.authorName,
      data.status,
      post.createdAt,
      updatedAt,
    ]]);

    return json_({
      ok: true,
      message: '게시글이 수정되었습니다.',
      data: {
        post: publicPost_({
          id: post.id,
          title: data.title,
          category: data.category,
          summary: data.summary,
          content: data.content,
          authorId: post.authorId,
          authorName: post.authorName,
          status: data.status,
          createdAt: post.createdAt,
          updatedAt: updatedAt,
        }),
      },
    });
  } finally {
    lock.releaseLock();
  }
}

function deletePost_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const user = requireUser_(String(payload.token || ''));
    const id = String(payload.id || '');
    const sheet = getSheet_(AUTH_CONFIG.postsSheet);
    const post = getObjects_(sheet).find(function (item) {
      return String(item.id) === id;
    });

    if (!post) {
      return json_({ ok: false, code: 'NOT_FOUND', message: '게시글을 찾을 수 없습니다.' });
    }

    if (String(post.authorId) !== String(user.id)) {
      return json_({ ok: false, code: 'FORBIDDEN', message: '삭제 권한이 없습니다.' });
    }

    sheet.deleteRow(post.__rowNumber);
    return json_({ ok: true, message: '게시글이 삭제되었습니다.' });
  } finally {
    lock.releaseLock();
  }
}

function requireUser_(token) {
  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  const tokenHash = sha256_(token);
  const session = getObjects_(getSheet_(AUTH_CONFIG.sessionsSheet)).find(function (item) {
    return (
      constantTimeEqual_(String(item.tokenHash), tokenHash) &&
      new Date(item.expiresAt).getTime() > Date.now()
    );
  });

  if (!session) {
    throw new Error('로그인이 만료되었습니다.');
  }

  const user = getObjects_(getSheet_(AUTH_CONFIG.usersSheet)).find(function (item) {
    return String(item.id) === String(session.userId) && item.status === 'ACTIVE';
  });

  if (!user) {
    throw new Error('사용자 정보를 찾을 수 없습니다.');
  }

  return user;
}

function validatePost_(payload) {
  const status = payload.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';
  const title = cleanPostText_(payload.title, 100) || (status === 'DRAFT' ? '제목 없음' : '');
  const category = cleanText_(payload.category || '생각', 20);
  const summary = cleanPostText_(payload.summary, 300);
  const content = cleanPostText_(payload.content, 50000);

  if (status === 'PUBLISHED' && title.length < 2) {
    throw new Error('제목을 2자 이상 입력해 주세요.');
  }

  if (status === 'PUBLISHED' && content.length < 10) {
    throw new Error('본문을 10자 이상 입력해 주세요.');
  }

  return {
    title: title,
    category: category,
    summary: summary,
    content: content,
    status: status,
  };
}

function publicPost_(post) {
  return {
    id: String(post.id),
    title: String(post.title),
    category: String(post.category),
    summary: String(post.summary || ''),
    content: String(post.content),
    authorId: String(post.authorId),
    authorName: String(post.authorName),
    status: String(post.status),
    createdAt: toIsoString_(post.createdAt),
    updatedAt: toIsoString_(post.updatedAt),
  };
}

function toIsoString_(value) {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}

function cleanPostText_(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function validateSignup_(email, name, nickname, password) {
  if (!isValidEmail_(email)) {
    throw new Error('올바른 이메일을 입력해 주세요.');
  }

  if (name.length < 2 || nickname.length < 2) {
    throw new Error('이름과 필명은 2자 이상 입력해 주세요.');
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.');
  }
}

function hashPassword_(password, salt) {
  const pepper =
    PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');

  if (!pepper) {
    throw new Error('setupAuth()를 먼저 실행해 주세요.');
  }

  let value = salt + String(password) + pepper;

  for (let i = 0; i < AUTH_CONFIG.hashIterations; i += 1) {
    value = sha256_(value + salt + pepper);
  }

  return value;
}

function sha256_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(function (byte) {
      const normalized = byte < 0 ? byte + 256 : byte;
      return ('0' + normalized.toString(16)).slice(-2);
    })
    .join('');
}

function constantTimeEqual_(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

function createRandomToken_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function publicUser_(user) {
  return {
    id: String(user.id),
    email: String(user.email),
    name: String(user.name),
    nickname: String(user.nickname),
  };
}

function updateUserLastLogin_(sheet, rowNumber, date) {
  const lastLoginColumn = USER_HEADERS.indexOf('lastLoginAt') + 1;
  sheet.getRange(rowNumber, lastLoginColumn).setValue(date);
}

function deleteExpiredSessions_() {
  const sheet = getSheet_(AUTH_CONFIG.sessionsSheet);
  const sessions = getObjects_(sheet);
  const expiredRows = sessions
    .filter(function (session) {
      return new Date(session.expiresAt).getTime() <= Date.now();
    })
    .map(function (session) { return session.__rowNumber; })
    .sort(function (a, b) { return b - a; });

  expiredRows.forEach(function (rowNumber) {
    sheet.deleteRow(rowNumber);
  });
}

function loginAttemptKey_(email) {
  return 'login:' + sha256_(email).slice(0, 32);
}

function isLoginBlocked_(email) {
  const attempts = Number(
    CacheService.getScriptCache().get(loginAttemptKey_(email)) || 0
  );
  return attempts >= AUTH_CONFIG.maxLoginAttempts;
}

function recordFailedLogin_(email) {
  const cache = CacheService.getScriptCache();
  const key = loginAttemptKey_(email);
  const attempts = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(attempts), AUTH_CONFIG.loginBlockSeconds);
}

function clearFailedLogins_(email) {
  CacheService.getScriptCache().remove(loginAttemptKey_(email));
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('요청 본문이 없습니다.');
  }

  return JSON.parse(e.postData.contents);
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText_(value, maxLength) {
  return String(value || '')
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}

function getSheet_(name) {
  const sheet = ensureAuthSetup_().getSheetByName(name);

  if (!sheet) {
    throw new Error('인증용 시트를 준비하지 못했습니다.');
  }

  return sheet;
}

function ensureAuthSetup_() {
  const spreadsheet = SpreadsheetApp.openById(AUTH_CONFIG.spreadsheetId);

  createSheetIfMissing_(spreadsheet, AUTH_CONFIG.usersSheet, USER_HEADERS);
  createSheetIfMissing_(spreadsheet, AUTH_CONFIG.sessionsSheet, SESSION_HEADERS);
  createSheetIfMissing_(spreadsheet, AUTH_CONFIG.postsSheet, POST_HEADERS);

  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('PASSWORD_PEPPER')) {
    properties.setProperty(
      'PASSWORD_PEPPER',
      Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()
    );
  }

  return spreadsheet;
}

function getObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const headers = values[0];
  return values.slice(1)
    .filter(function (row) { return row[0]; })
    .map(function (row, rowIndex) {
      const item = { __rowNumber: rowIndex + 2 };
      headers.forEach(function (header, columnIndex) {
        item[header] = row[columnIndex];
      });
      return item;
    });
}

function createSheetIfMissing_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#22211f')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, headers.length);
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
