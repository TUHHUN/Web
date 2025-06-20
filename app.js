// app.js

const levels = {
  "2bac": {
    name_ar: "ثانية باك",
    name_fr: "2ème Bac",
    branches: {
      svt: {
        name_ar: "علوم تجريبية",
        name_fr: "Sciences Expérimentales",
        subjects: {
          "العربية": 3,
          "الفرنسية": 4,
          "الفلسفة": 2,
          "التربية الإسلامية": 1,
          "التاريخ والجغرافيا": 1,
          "الرياضيات": 5,
          "علوم الحياة والأرض": 6,
          "الفيزياء والكيمياء": 6,
          "الإنجليزية": 2
        }
      },
      math_a: {
        name_ar: "علوم رياضية أ",
        name_fr: "Maths A",
        subjects: {
          "العربية": 3,
          "الفرنسية": 4,
          "الفلسفة": 2,
          "التربية الإسلامية": 1,
          "الرياضيات": 9,
          "الفيزياء والكيمياء": 7,
          "الإنجليزية": 2
        }
      },
      literary: {
        name_ar: "آداب وعلوم إنسانية",
        name_fr: "Littéraire",
        subjects: {
          "العربية": 6,
          "الفرنسية": 3,
          "الفلسفة": 4,
          "التاريخ والجغرافيا": 4,
          "التربية الإسلامية": 1,
          "الإنجليزية": 2
        }
      },
      economy: {
        name_ar: "اقتصاد وتدبير",
        name_fr: "Économie et Gestion",
        subjects: {
          "العربية": 2,
          "الفرنسية": 3,
          "الفلسفة": 2,
          "الرياضيات": 3,
          "المحاسبة والرياضيات المالية": 6,
          "الاقتصاد العام والإحصاء": 5,
          "القانون": 2
        }
      }
    }
  },
  // يمكنك إضافة المزيد من المستويات والشُعب حسب الحاجة
};

const levelSelect = document.getElementById("level-select");
const branchSelect = document.getElementById("branch-select");
const examTypeSelect = document.getElementById("exam-type-select");
const startBtn = document.getElementById("start-btn");

const gradesSection = document.getElementById("grades-section");
const subjectsContainer = document.getElementById("subjects-container");
const finalAverageSpan = document.getElementById("final-average");
const askAiBtn = document.getElementById("ask-ai-btn");
const backBtn = document.getElementById("back-btn");

const aiSection = document.getElementById("ai-section");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const sendChatBtn = document.getElementById("send-chat-btn");
const backToGradesBtn = document.getElementById("back-to-grades-btn");

let selectedLevel = "";
let selectedBranch = "";
let selectedExamType = "";
let gradesData = {};

function populateBranches() {
  branchSelect.innerHTML = '<option value="">-- اختر -- / -- Choisir --</option>';
  if (!selectedLevel) {
    branchSelect.disabled = true;
    return;
  }
  const branches = levels[selectedLevel]?.branches;
  for (const key in branches) {
    const b = branches[key];
    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${b.name_ar} / ${b.name_fr}`;
    branchSelect.appendChild(option);
  }
  branchSelect.disabled = false;
}

function populateExamTypes() {
  examTypeSelect.disabled = !selectedBranch;
}

function enableStart() {
  startBtn.disabled = !(selectedLevel && selectedBranch && selectedExamType);
}

levelSelect.addEventListener("change", e => {
  selectedLevel = e.target.value;
  populateBranches();
  examTypeSelect.value = "";
  selectedBranch = "";
  selectedExamType = "";
  enableStart();
});

branchSelect.addEventListener("change", e => {
  selectedBranch = e.target.value;
  populateExamTypes();
  examTypeSelect.value = "";
  selectedExamType = "";
  enableStart();
});

examTypeSelect.addEventListener("change", e => {
  selectedExamType = e.target.value;
  enableStart();
});

startBtn.addEventListener("click", () => {
  startBtn.disabled = true;
  loadSubjects();
  document.getElementById("selection-section").classList.add("hidden");
  gradesSection.classList.remove("hidden");
});

backBtn.addEventListener("click", () => {
  gradesSection.classList.add("hidden");
  aiSection.classList.add("hidden");
  document.getElementById("selection-section").classList.remove("hidden");
  startBtn.disabled = false;
  gradesData = {};
  finalAverageSpan.textContent = "0";
  subjectsContainer.innerHTML = "";
  saveData();
});

askAiBtn.addEventListener("click", () => {
  gradesSection.classList.add("hidden");
  aiSection.classList.remove("hidden");
  loadChat();
});

backToGradesBtn.addEventListener("click", () => {
  aiSection.classList.add("hidden");
  gradesSection.classList.remove("hidden");
});

function loadSubjects() {
  subjectsContainer.innerHTML = "";
  gradesData = loadData() || {};
  const subjects = levels[selectedLevel].branches[selectedBranch].subjects;
  for (const subject in subjects) {
    const coeff = subjects[subject];
    const row = document.createElement("div");
    row.className = "subject-row";

    const label = document.createElement("label");
    label.textContent = `${subject} (المعامل: ${coeff})`;
    row.appendChild(label);

    const inputsDiv = document.createElement("div");
    inputsDiv.className = "subject-inputs";

    // For simplicity: فقط خانة نقطة نهائية (يمكن توسعة للفروض والأنشطة)
    const input = document.createElement("input");
    input.type = "number";
    input.min = 0;
    input.max = 20;
    input.placeholder = "0-20";
    input.value = gradesData[subject] || "";
    input.addEventListener("input", () => {
      gradesData[subject] = parseFloat(input.value) || 0;
      saveData();
      updateFinalAverage();
    });
    inputsDiv.appendChild(input);

    row.appendChild(inputsDiv);
    subjectsContainer.appendChild(row);
  }
  updateFinalAverage();
}

function updateFinalAverage() {
  const subjects = levels[selectedLevel].branches[selectedBranch].subjects;
  let total = 0;
  let coeffSum = 0;
  for (const subject in subjects) {
    const coeff = subjects[subject];
    const grade = gradesData[subject] || 0;
    total += grade * coeff;
    coeffSum += coeff;
  }
  const avg = coeffSum ? (total / coeffSum).toFixed(2) : 0;
  finalAverageSpan.textContent = avg;
}

function saveData() {
  const key = `${selectedLevel}_${selectedBranch}_${selectedExamType}_grades`;
  localStorage.setItem(key, JSON.stringify(gradesData));
}

function loadData() {
  const key = `${selectedLevel}_${selectedBranch}_${selectedExamType}_grades`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

// ==== AI Chat Logic ====

const openaiApiKey = ""; // ضع مفتاح OpenAI API هنا أو من ملف .env في النسخة الحقيقية

sendChatBtn.addEventListener("click", async () => {
  const question = chatInput.value.trim();
  if (!question) return;
  appendChatMessage("user", question);
  chatInput.value = "";
  appendChatMessage("bot", "جارٍ الرد...");
  try {
    const response = await fetchOpenAI(question);
    replaceLastBotMessage(response);
  } catch (err) {
    replaceLastBotMessage("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
  }
});

function appendChatMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = "chat-message " + sender;
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function replaceLastBotMessage(text) {
  const msgs = chatMessages.getElementsByClassName("bot");
  if (msgs.length === 0) return;
  msgs[msgs.length - 1].textContent = text;
}

async function fetchOpenAI(question) {
  if (!openaiApiKey) return "API Key not set.";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "أنت مساعد ذكي لتحليل نقاط الطالب وإعطاء نصائح لتحسين المعدل.",
        },
        {
          role: "user",
          content: question,
        },
      ],
      max_tokens: 500,
    }),
  });
  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  } else {
    return "لم أتمكن من الحصول على إجابة من الذكاء الاصطناعي.";
  }
}

// ==== تحميل المحادثة السابقة (إن وجدت) ====

function loadChat() {
  chatMessages.innerHTML = "";
  appendChatMessage(
    "bot",
    "مرحباً! اسألني أي شيء عن معدلك، المواد الضعيفة، وكيف ترفع مستواك."
  );
}

