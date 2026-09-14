const API_URL = "https://script.google.com/macros/s/AKfycbxhZSuMXfAafZ-lg5wfv87dnaOFTFDjt54V-LVuMizWhClkRj-bc1NDNZ5MMx6HlSv6oA/exec";

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({ action, ...params }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error("서버에 연결하지 못했습니다.");
  return response.json();
}

async function apiPost(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("서버에 연결하지 못했습니다.");
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function readingTime(content) {
  return `${Math.max(1, Math.ceil(String(content || "").length / 500))}분`;
}

function getStoredAuth() {
  const storage = localStorage.getItem("blogAuthToken")
    ? localStorage
    : sessionStorage;
  return {
    storage,
    token: storage.getItem("blogAuthToken"),
    user: storage.getItem("blogAuthUser"),
  };
}

function clearStoredAuth(auth = getStoredAuth()) {
  auth.storage.removeItem("blogAuthToken");
  auth.storage.removeItem("blogAuthUser");
}

const nav = document.querySelector(".site-nav");
const menuToggle = document.querySelector(".menu-toggle");
if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  });
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      nav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const storedAuth = getStoredAuth();
if (storedAuth.token) {
  document.querySelectorAll(".site-nav").forEach((menu) => {
    const loginLink = menu.querySelector('a[href="login.html"]');
    const signupLink = menu.querySelector('a[href="signup.html"]');

    if (signupLink) {
      signupLink.textContent = "프로필";
      signupLink.href = "profile.html";
      signupLink.setAttribute("aria-label", "내 프로필 보기");
    }

    if (loginLink) {
      loginLink.textContent = "로그아웃";
      loginLink.href = "#logout";
      loginLink.addEventListener("click", async (event) => {
        event.preventDefault();
        loginLink.setAttribute("aria-disabled", "true");
        loginLink.textContent = "로그아웃 중...";
        try {
          await apiPost({ action: "logout", token: storedAuth.token });
        } finally {
          clearStoredAuth(storedAuth);
          location.href = "index.html";
        }
      });
    }
  });
}

let posts = [];
let activeCategory = "all";
let visiblePosts = 4;
const postList = document.querySelector("#post-list");
const postSearch = document.querySelector("#post-search");
const categoryFilters = document.querySelectorAll("[data-filter]");
const emptyState = document.querySelector("#empty-state");
const loadMore = document.querySelector("#load-more");

function renderPosts() {
  if (!postList) return;
  const query = (postSearch?.value || "").trim().toLowerCase();
  const filtered = posts.filter(
    (post) =>
      (activeCategory === "all" || post.category === activeCategory) &&
      `${post.title} ${post.summary}`.toLowerCase().includes(query)
  );

  postList.innerHTML = filtered
    .slice(0, visiblePosts)
    .map((post) => {
      const href = `post-detail.html?id=${encodeURIComponent(post.id)}`;
      return `
        <article class="post-item">
          <div class="post-content">
            <div class="post-meta">
              <span class="category">${escapeHtml(post.category)}</span>
              <span>${formatDate(post.createdAt)}</span>
              <span>· ${readingTime(post.content)}</span>
            </div>
            <h3><a href="${href}">${escapeHtml(post.title)}</a></h3>
            <p class="post-excerpt">${escapeHtml(post.summary || post.content)}</p>
          </div>
          <a class="post-thumb placeholder" href="${href}" aria-label="${escapeHtml(post.title)} 읽기">${escapeHtml(post.category)}</a>
        </article>`;
    })
    .join("");

  if (emptyState) {
    emptyState.hidden = filtered.length > 0;
    emptyState.textContent = query || activeCategory !== "all"
      ? "조건에 맞는 글이 없습니다."
      : "아직 발행된 글이 없습니다.";
  }
  if (loadMore) loadMore.hidden = visiblePosts >= filtered.length;

  const popularList = document.querySelector("#popular-list");
  if (popularList) {
    popularList.innerHTML = posts.slice(0, 3).map((post, index) => `
      <li>
        <span>${String(index + 1).padStart(2, "0")}</span>
        <a href="post-detail.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a>
      </li>`).join("");
  }
}

async function loadPublishedPosts() {
  if (!postList) return;
  postList.innerHTML = '<p class="loading-message">게시글을 불러오는 중입니다.</p>';
  try {
    const result = await apiGet("listPosts");
    if (!result.ok) throw new Error(result.message);
    posts = result.data.posts || [];
    renderPosts();
  } catch (error) {
    postList.innerHTML = "";
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = error.message || "게시글을 불러오지 못했습니다.";
    }
    if (loadMore) loadMore.hidden = true;
  }
}

categoryFilters.forEach((button) => {
  button.addEventListener("click", () => {
    categoryFilters.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    activeCategory = button.dataset.filter;
    visiblePosts = 4;
    renderPosts();
  });
});
postSearch?.addEventListener("input", () => {
  visiblePosts = 4;
  renderPosts();
});
loadMore?.addEventListener("click", () => {
  visiblePosts += 4;
  renderPosts();
});
loadPublishedPosts();

document.querySelectorAll("[data-demo-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector(".form-status");
    if (form.checkValidity()) {
      if (status) status.textContent = form.dataset.message || "완료되었습니다.";
      form.reset();
    }
  });
});

document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.previousElementSibling;
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "보기" : "숨김";
  });
});

function showAuthMessage(form, message, isError = false) {
  const box = form.querySelector(".success-box");
  if (!box) return;
  box.hidden = false;
  box.classList.toggle("is-error", isError);
  box.textContent = message;
}

function validateAuthForm(form) {
  let valid = true;
  form.querySelectorAll("[required]").forEach((input) => {
    const error = input.closest(".field")?.querySelector(".field-error");
    if ((input.type === "checkbox" && !input.checked) || !input.value.trim()) {
      valid = false;
      if (error) error.textContent = "필수 입력 항목입니다.";
    } else if (input.type === "email" && !input.validity.valid) {
      valid = false;
      if (error) error.textContent = "올바른 이메일을 입력해 주세요.";
    } else if (
      input.name === "password" &&
      (input.value.length < 8 || !/[A-Za-z]/.test(input.value) || !/[0-9]/.test(input.value))
    ) {
      valid = false;
      if (error) error.textContent = "영문과 숫자를 포함해 8자 이상 입력해 주세요.";
    } else if (error) {
      error.textContent = "";
    }
  });

  const password = form.querySelector("[name=password]");
  const confirm = form.querySelector("[name=passwordConfirm]");
  if (confirm && password?.value !== confirm.value) {
    valid = false;
    confirm.closest(".field").querySelector(".field-error").textContent =
      "비밀번호가 일치하지 않습니다.";
  }
  if (!valid && form.querySelector("[name=terms]") && !form.querySelector("[name=terms]").checked) {
    showAuthMessage(form, "이용약관과 개인정보 처리방침에 동의해 주세요.", true);
  }
  return valid;
}

document.querySelectorAll(".auth-form").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateAuthForm(form)) return;

    const action = form.dataset.authAction;
    const button = form.querySelector("[type=submit]");
    const originalText = button.textContent;
    const formData = new FormData(form);
    button.disabled = true;
    button.textContent = action === "login" ? "로그인 중..." : "계정 생성 중...";
    showAuthMessage(form, "요청을 처리하고 있습니다.");

    try {
      const payload = {
        action,
        email: formData.get("email"),
        password: formData.get("password"),
      };
      if (action === "signup") {
        payload.name = formData.get("name");
        payload.nickname = formData.get("nickname");
      }

      const result = await apiPost(payload);
      if (!result.ok) throw new Error(result.message || "요청을 처리하지 못했습니다.");

      if (action === "login") {
        const target = formData.get("remember") ? localStorage : sessionStorage;
        const other = target === localStorage ? sessionStorage : localStorage;
        other.removeItem("blogAuthToken");
        other.removeItem("blogAuthUser");
        target.setItem("blogAuthToken", result.data.token);
        target.setItem("blogAuthUser", JSON.stringify(result.data.user));
        showAuthMessage(form, "로그인되었습니다. 프로필로 이동합니다.");
        const next = new URLSearchParams(location.search).get("next");
        setTimeout(() => {
          location.href = next === "write.html" ? next : "profile.html";
        }, 700);
      } else {
        form.reset();
        showAuthMessage(form, "회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
        setTimeout(() => { location.href = "login.html"; }, 900);
      }
    } catch (error) {
      showAuthMessage(form, error.message || "인증 서버와 통신하지 못했습니다.", true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
});

async function loadPostDetail() {
  const title = document.querySelector("[data-post-title]");
  if (!title) return;
  const id = new URLSearchParams(location.search).get("id");
  const errorBox = document.querySelector("[data-post-error]");

  if (!id) {
    errorBox.hidden = false;
    errorBox.textContent = "게시글 주소가 올바르지 않습니다.";
    return;
  }

  try {
    const result = await apiGet("getPost", { id });
    if (!result.ok) throw new Error(result.message);
    const post = result.data.post;
    title.textContent = post.title;
    document.title = `${post.title} — 기록의 온도`;
    document.querySelector("[data-post-category]").textContent = post.category;
    document.querySelectorAll("[data-post-author]").forEach((element) => {
      element.textContent = post.authorName;
    });
    document.querySelector("[data-post-date]").textContent = formatDate(post.createdAt);
    document.querySelector("[data-post-read]").textContent = `${readingTime(post.content)} 소요`;
    document.querySelector("[data-post-summary]").textContent = post.summary || post.content.slice(0, 180);
    document.querySelector("[data-post-content]").textContent = post.content;
    document.querySelector("[data-article]").hidden = false;
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = error.message || "게시글을 불러오지 못했습니다.";
  }
}
loadPostDetail();

const likeButton = document.querySelector("[data-like]");
likeButton?.addEventListener("click", () => {
  likeButton.classList.toggle("is-active");
  likeButton.setAttribute("aria-pressed", String(likeButton.classList.contains("is-active")));
  likeButton.textContent = likeButton.classList.contains("is-active") ? "♥" : "♡";
});
const copyButton = document.querySelector("[data-copy]");
copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    copyButton.textContent = "✓";
    setTimeout(() => { copyButton.textContent = "↗"; }, 1400);
  } catch {
    copyButton.textContent = "!";
  }
});

const editor = document.querySelector(".editor-form");
if (editor) {
  const auth = getStoredAuth();
  const title = editor.querySelector(".title-input");
  const summary = editor.querySelector(".summary-input");
  const body = editor.querySelector(".body-input");
  const category = editor.querySelector(".editor-category");
  const status = document.querySelector(".draft-status");
  const publishButton = document.querySelector('[form="editor-form"]');
  const draftButton = document.querySelector("[data-save]");
  let editId = new URLSearchParams(location.search).get("id");

  if (!auth.token) {
    status.textContent = "글을 쓰려면 로그인이 필요합니다.";
    publishButton.disabled = true;
    draftButton.disabled = true;
    setTimeout(() => { location.href = "login.html?next=write.html"; }, 900);
  } else {
    const draftKey = `blog-draft-${editId || "new"}`;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey));
      if (draft) {
        title.value = draft.title || "";
        summary.value = draft.summary || "";
        body.value = draft.body || "";
        category.value = draft.category || "개발";
      }
    } catch {}

    if (editId) {
      status.textContent = "게시글을 불러오는 중...";
      apiPost({ action: "myPosts", token: auth.token }).then((result) => {
        if (!result.ok) throw new Error(result.message);
        const post = result.data.posts.find((item) => item.id === editId);
        if (!post) throw new Error("수정할 게시글을 찾을 수 없습니다.");
        title.value = post.title;
        summary.value = post.summary;
        body.value = post.content;
        category.value = post.category;
        status.textContent = "게시글 수정";
      }).catch((error) => {
        status.textContent = error.message;
      });
    }

    const saveLocalDraft = () => {
      localStorage.setItem(draftKey, JSON.stringify({
        title: title.value,
        summary: summary.value,
        body: body.value,
        category: category.value,
      }));
    };

    const savePost = async (postStatus) => {
      saveLocalDraft();
      const button = postStatus === "DRAFT" ? draftButton : publishButton;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = postStatus === "DRAFT" ? "저장 중..." : "발행 중...";

      try {
        const result = await apiPost({
          action: editId ? "updatePost" : "createPost",
          token: auth.token,
          id: editId,
          title: title.value,
          summary: summary.value,
          content: body.value,
          category: category.value,
          status: postStatus,
        });
        if (!result.ok) throw new Error(result.message);
        editId = result.data.post.id;
        history.replaceState(null, "", `write.html?id=${encodeURIComponent(editId)}`);
        status.textContent = result.message;
        if (postStatus === "PUBLISHED") {
          localStorage.removeItem(draftKey);
          setTimeout(() => {
            location.href = `post-detail.html?id=${encodeURIComponent(editId)}`;
          }, 700);
        }
      } catch (error) {
        status.textContent = error.message || "게시글을 저장하지 못했습니다.";
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    };

    draftButton.addEventListener("click", () => savePost("DRAFT"));
    editor.addEventListener("submit", (event) => {
      event.preventDefault();
      savePost("PUBLISHED");
    });
  }

  document.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      const mark = button.dataset.format;
      const start = body.selectionStart;
      const end = body.selectionEnd;
      const selected = body.value.slice(start, end);
      body.setRangeText(mark + selected + mark, start, end, "select");
      body.focus();
    });
  });
}

async function loadMyPosts() {
  const manager = document.querySelector("#my-posts-section");
  const list = document.querySelector("#my-posts");
  if (!manager || !list || !storedAuth.token) return;
  manager.hidden = false;
  list.innerHTML = '<p class="loading-message">내 글을 불러오는 중입니다.</p>';

  try {
    const result = await apiPost({ action: "myPosts", token: storedAuth.token });
    if (!result.ok) throw new Error(result.message);
    const myPosts = result.data.posts || [];
    list.innerHTML = myPosts.length
      ? myPosts.map((post) => `
        <article class="manage-post">
          <div>
            <span class="status-badge ${post.status === "PUBLISHED" ? "published" : ""}">
              ${post.status === "PUBLISHED" ? "발행됨" : "임시저장"}
            </span>
            <h4>${escapeHtml(post.title)}</h4>
            <p>${formatDate(post.updatedAt)} 수정</p>
          </div>
          <div class="manage-actions">
            <a class="button secondary" href="write.html?id=${encodeURIComponent(post.id)}">수정</a>
            <button class="button danger" type="button" data-delete-post="${escapeHtml(post.id)}">삭제</button>
          </div>
        </article>`).join("")
      : '<div class="empty-manage"><p>아직 작성한 글이 없습니다.</p><a class="button primary" href="write.html">첫 글 쓰기</a></div>';
  } catch (error) {
    list.innerHTML = `<p class="manage-error">${escapeHtml(error.message)}</p>`;
  }
}

document.querySelector("#my-posts")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-post]");
  if (!button) return;
  if (!confirm("이 게시글을 삭제할까요? 삭제 후 복구할 수 없습니다.")) return;

  button.disabled = true;
  try {
    const result = await apiPost({
      action: "deletePost",
      token: storedAuth.token,
      id: button.dataset.deletePost,
    });
    if (!result.ok) throw new Error(result.message);
    await loadMyPosts();
  } catch (error) {
    alert(error.message || "게시글을 삭제하지 못했습니다.");
    button.disabled = false;
  }
});
loadMyPosts();
