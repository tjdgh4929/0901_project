const projects = [
  {
    title: "개인 프로필 페이지",
    description: "HTML, CSS, JavaScript를 사용해 만든 한 페이지 개인 포트폴리오입니다.",
    tags: ["HTML", "CSS", "JavaScript"],
    link: "https://github.com/example/profile-page",
  },
  {
    title: "할 일 관리 앱",
    description: "사용자가 할 일을 추가, 완료, 삭제할 수 있는 간단한 웹 앱입니다.",
    tags: ["JavaScript", "DOM", "LocalStorage"],
    link: "https://github.com/example/todo-app",
  },
  {
    title: "반응형 랜딩 페이지",
    description: "모바일과 데스크톱 화면에 맞춰 레이아웃이 변하는 웹 페이지입니다.",
    tags: ["HTML", "CSS", "Responsive"],
    link: "https://github.com/example/landing-page",
  },
];

const nav = document.querySelector(".site-nav");
const menuToggle = document.querySelector(".menu-toggle");
const projectList = document.querySelector("#project-list");
const contactButton = document.querySelector("[data-contact='email']");
const contactMessage = document.querySelector("#contact-message");

function renderProjects() {
  if (!projectList) {
    return;
  }

  projectList.innerHTML = projects
    .map(
      (project) => `
        <article class="project-card">
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          <ul class="project-tags">
            ${project.tags.map((tag) => `<li>${tag}</li>`).join("")}
          </ul>
          <a class="button secondary" href="${project.link}" target="_blank" rel="noreferrer">GitHub 보기</a>
        </article>
      `
    )
    .join("");
}

function closeMenu() {
  if (!nav || !menuToggle) {
    return;
  }

  nav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "메뉴 열기");
}

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
  });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    const target = document.querySelector(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    closeMenu();
  });
});

if (contactButton && contactMessage) {
  contactButton.addEventListener("click", () => {
    contactMessage.textContent = "기본 메일 앱을 열어 연락할 수 있습니다.";
  });
}

renderProjects();
