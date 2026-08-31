/* =====================================================================
 * site.js
 *
 * Everything content-editable lives in /content as plain .md files:
 *   content/personas/{general,recruiter,techlead,founder}.md
 *   content/countries/{XX}.md   (XX = ISO country code, e.g. DE, US, PK)
 *   content/countries/default.md (fallback if the visitor's country
 *                                  has no dedicated file)
 *
 * To change what a persona says or add a new one: edit / add a .md file
 * and, if it's a brand-new persona key, add one line to PERSONA_KEYS
 * below and a matching chip in index.html. No other code changes needed.
 *
 * To add visa info for a new country: drop content/countries/XX.md
 * (XX = ISO 3166-1 alpha-2 code). No code changes needed.
 * ===================================================================== */

const PERSONA_KEYS = ["general", "recruiter", "techlead", "founder"];
const WORKER_URL = "https://daddu.faiizii.workers.dev/";

/* ---------------------------------------------------------------------
 * Tiny frontmatter + markdown loader
 * ------------------------------------------------------------------- */

/** Splits "---\nkey: value\n---\nbody" into { meta, body }. */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };
  const meta = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = val;
  });
  return { meta, body: match[2].trim() };
}

/** Splits a persona body into { skills, experience, projects } blocks by "## Heading". */
function splitSections(body) {
  const sections = {};
  ("\n" + body).split(/\n##\s+/).filter(Boolean).forEach((block) => {
    const [headingLine, ...rest] = block.split("\n");
    sections[headingLine.trim().toLowerCase()] = rest.join("\n").trim();
  });
  return sections;
}

/** "A, B, C" -> ["A","B","C"] */
function parseSkills(content) {
  if (!content) return [];
  return content.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Splits an "Experience" block into job entries by "### Title\nDate\n- bullet\n- bullet". */
function parseExperience(content) {
  if (!content) return [];
  return ("\n" + content)
    .split(/\n###\s+/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").filter((l) => l.trim() !== "");
      const title = lines[0] || "";
      const date = lines[1] && !lines[1].trim().startsWith("-") ? lines[1] : "";
      const bulletLines = lines.slice(date ? 2 : 1);
      const bullets = bulletLines
        .filter((l) => l.trim().startsWith("-"))
        .map((l) => l.trim().replace(/^-\s*/, ""));
      return { title, date, bullets };
    });
}

/** Splits a "Projects" block into entries by "### Title\n<markdown body>". */
function parseProjects(content) {
  if (!content) return [];
  return ("\n" + content)
    .split(/\n###\s+/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const title = lines[0] || "";
      const body = lines.slice(1).join("\n").trim();
      return { title, bodyHtml: body ? marked.parseInline(body) : "" };
    });
}

async function fetchMarkdown(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return parseFrontmatter(await res.text());
}

/* ---------------------------------------------------------------------
 * Persona rendering
 * ------------------------------------------------------------------- */

const personaCache = new Map();
let currentPersonaKey = "general";

async function loadPersona(key) {
  if (personaCache.has(key)) return personaCache.get(key);
  const parsed = await fetchMarkdown(`content/personas/${key}.md`);
  personaCache.set(key, parsed);
  return parsed;
}

function renderPersona(key, { meta, body }) {
  document.getElementById("tagline").innerHTML = meta.tagline || "";
  document.getElementById("chatSubtitle").textContent = meta.chatSubtitle || "";

  const noteWrap = document.getElementById("personaNoteWrap");
  const noteEl = document.getElementById("personaNote");
  if (meta.note) {
    noteEl.textContent = meta.note;
    noteWrap.style.display = "block";
  } else {
    noteWrap.style.display = "none";
  }

  document.querySelectorAll(".chip[data-persona]").forEach((chip) => {
    chip.classList.toggle("is-selected", chip.dataset.persona === key);
  });

  const sections = splitSections(body);
  const skills = parseSkills(sections["skills"]);
  const experience = parseExperience(sections["experience"]);
  const projects = parseProjects(sections["projects"]);

  // Skills
  const skillsWrap = document.getElementById("skillsWrap");
  skillsWrap.innerHTML = skills
    .map((s) => `<span class="skill-tag">${s}</span>`)
    .join("");

  // Experience
  const expWrap = document.getElementById("experienceWrap");
  expWrap.innerHTML = experience
    .map(
      (job) => `
      <div style="margin-bottom:20px;">
        <p style="font-size:14.5px; margin-bottom:2px;"><b>${job.title}</b></p>
        ${job.date ? `<p style="font-size:12.5px; color:var(--md-sys-color-on-surface-variant); margin-bottom:6px;">${job.date}</p>` : ""}
        ${
          job.bullets.length
            ? `<ul style="font-size:14px; line-height:1.65; color:var(--md-sys-color-on-surface-variant); padding-left:20px;">
                 ${job.bullets.map((b) => `<li>${b}</li>`).join("")}
               </ul>`
            : ""
        }
      </div>`
    )
    .join("");

  // Projects
  const projSection = document.getElementById("projectsSection");
  const projWrap = document.getElementById("projectsWrap");
  if (projects.length === 0) {
    projSection.classList.add("is-hidden");
  } else {
    projSection.classList.remove("is-hidden");
    projWrap.innerHTML = projects
      .map(
        (p) => `
        <div style="margin-bottom:16px; padding:4px;">
          <p style="font-size:14.5px; font-weight:500; margin-bottom:4px;">${p.title}</p>
          <div style="font-size:14px; color:var(--md-sys-color-on-surface-variant);">${p.bodyHtml}</div>
        </div>`
      )
      .join("");
  }

  // Country visa box only makes sense for general / recruiter views
  updateVisaBoxVisibility(key);
}

async function selectPersona(key) {
  if (!PERSONA_KEYS.includes(key)) key = "general";
  try {
    const parsed = await loadPersona(key);
    renderPersona(key, parsed);
    currentPersonaKey = key;
  } catch (err) {
    console.error(err);
  }
}

/* ---------------------------------------------------------------------
 * "Download PDF" — prints just the resume pane as currently rendered,
 * so it always matches whichever persona is selected. No separate PDF
 * files to keep in sync with content/personas/*.md.
 * ------------------------------------------------------------------- */

function downloadResumeAsPdf() {
  const chip = document.querySelector(`.chip[data-persona="${currentPersonaKey}"]`);
  const label = chip ? chip.textContent.trim() : "Resume";
  const previousTitle = document.title;
  document.title = `Faizan Awan - ${label} Resume`;

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };
  window.addEventListener("afterprint", restoreTitle);

  window.print();
}

/* ---------------------------------------------------------------------
 * Country / visa box — detected from visitor IP, content from .md file
 * ------------------------------------------------------------------- */

let detectedCountryCode = null;

function updateVisaBoxVisibility(personaKey) {
  const box = document.getElementById("countryVisaBox");
  const shouldShow = personaKey === "general" || personaKey === "recruiter";
  box.classList.toggle("is-hidden", !shouldShow);
}

async function loadCountryVisaBox(code) {
  const box = document.getElementById("countryVisaBox");
  try {
    const { meta, body } = await fetchMarkdown(`content/countries/${code}.md`);
    box.innerHTML = `
      <h2 style="font-size:14px; letter-spacing:.06em; text-transform:uppercase; border-bottom:1px solid var(--md-sys-color-outline); padding-bottom:6px;">${meta.heading || "Visa & Relocation"}</h2>
      <div style="font-size:14px; line-height:1.7; color:var(--md-sys-color-on-surface-variant);">${marked.parse(body)}</div>`;
  } catch (err) {
    // Country file doesn't exist yet — fall back silently to default.md
    if (code !== "default") {
      await loadCountryVisaBox("default");
    } else {
      box.classList.add("is-hidden");
    }
  }
}

async function detectCountryAndLoadVisaBox() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) throw new Error("geo lookup failed");
    const data = await res.json();
    detectedCountryCode = (data.country_code || "").toUpperCase();
  } catch (err) {
    detectedCountryCode = null;
  }
  await loadCountryVisaBox(detectedCountryCode || "default");
}

/* ---------------------------------------------------------------------
 * Wiring
 * ------------------------------------------------------------------- */

document.getElementById("viewerTabs").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-persona]");
  if (chip) selectPersona(chip.dataset.persona);
});

document.getElementById("downloadPdfBtn").addEventListener("click", downloadResumeAsPdf);

selectPersona("general");
detectCountryAndLoadVisaBox();

/* ---------------------------------------------------------------------
 * Chat widget (unchanged behaviour, talks to the Cloudflare Worker)
 * ------------------------------------------------------------------- */

const chatWindow = document.getElementById("chatWindow");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function addBotBubble(html, isError = false) {
  const row = document.createElement("div");
  row.className = "msg-row bot";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.style.padding = "12px 15px";
  bubble.style.borderRadius = "16px";
  bubble.style.border = "1px solid var(--md-sys-color-outline)";
  if (isError) {
    bubble.style.background = "var(--md-sys-color-error-container)";
    bubble.style.borderColor = "var(--md-sys-color-error)";
    bubble.innerHTML = `<p style="margin:0;font-size:14px;color:var(--md-sys-color-error);">${html}</p>`;
  } else {
    bubble.style.background = "var(--md-sys-color-surface)";
    bubble.innerHTML = `<div style="font-size:14px;color:var(--md-sys-color-on-surface-variant);">${html}</div>`;
  }
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

function addUserBubble(text) {
  const row = document.createElement("div");
  row.className = "msg-row user";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.style.padding = "12px 15px";
  bubble.style.borderRadius = "16px";
  bubble.style.background = "var(--md-sys-color-primary)";
  bubble.innerHTML = `<p style="margin:0;font-size:14px;color:var(--md-sys-color-on-primary);">${escapeHtml(text)}</p>`;
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage() {
  const question = input.value.trim();
  if (!question) return;

  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;

  addUserBubble(question);
  const loadingRow = addBotBubble(
    `<span style="display:flex;align-items:center;gap:8px;"><span class="spinner"></span> Thinking…</span>`
  );

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: question }),
    });
    const data = await response.json();
    loadingRow.remove();

    if (response.ok && data.choices && data.choices[0]) {
      const parsed = marked.parse(data.choices[0].message.content);
      addBotBubble(parsed);
    } else {
      addBotBubble(escapeHtml(data.error || "Failed to fetch response."), true);
    }
  } catch (err) {
    loadingRow.remove();
    addBotBubble("Error contacting AI service. Please try again later.", true);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
