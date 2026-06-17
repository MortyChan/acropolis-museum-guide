const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const config = window.ACROPOLIS_GUIDE_CONFIG || {};
const apiEndpoint = config.apiEndpoint || "/api/interpret";

const form = document.querySelector("#interpretForm");
const input = document.querySelector("#imageInput");
const dropZone = document.querySelector("#dropZone");
const previewCard = document.querySelector("#previewCard");
const previewImage = document.querySelector("#previewImage");
const fileMeta = document.querySelector("#fileMeta");
const submitButton = document.querySelector("#submitButton");
const resetButton = document.querySelector("#resetButton");
const statusLine = document.querySelector("#statusLine");
const emptyState = document.querySelector("#emptyState");
const resultCard = document.querySelector("#resultCard");

const fields = {
  title: document.querySelector("#resultTitle"),
  period: document.querySelector("#resultPeriod"),
  description: document.querySelector("#resultDescription"),
  visual_clues: document.querySelector("#resultVisualClues"),
  museum_context: document.querySelector("#resultMuseumContext"),
  visitor_tip: document.querySelector("#resultVisitorTip"),
  confidence_note: document.querySelector("#resultConfidence")
};

let selectedFile = null;
let previewUrl = null;

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(message, type = "info") {
  statusLine.textContent = message;
  statusLine.classList.toggle("is-error", type === "error");
}

function resetSelection() {
  selectedFile = null;
  input.value = "";
  submitButton.disabled = true;
  resetButton.disabled = true;
  previewCard.classList.add("is-empty");
  previewImage.removeAttribute("src");
  fileMeta.textContent = "尚未选择图片";
  setStatus("");

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

function validateFile(file) {
  if (!file) {
    return "请选择一张图片。";
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "目前只支持 JPG、PNG、WebP、HEIC 或 HEIF 图片。";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "图片超过 8MB，请压缩后再上传。";
  }

  return "";
}

function selectFile(file) {
  const validationError = validateFile(file);
  if (validationError) {
    resetSelection();
    setStatus(validationError, "error");
    return;
  }

  selectedFile = file;
  submitButton.disabled = false;
  resetButton.disabled = false;
  previewCard.classList.remove("is-empty");

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  fileMeta.textContent = `${file.name} · ${formatFileSize(file.size)}`;
  setStatus("照片已准备好，可以开始解读。");
}

function normalizeResult(data) {
  return {
    title: data.title || "未能确定具体文物",
    period: data.period || "年代信息不确定",
    description: data.description || "暂未生成历史背景。",
    visual_clues: data.visual_clues || "暂未生成视觉线索。",
    museum_context: data.museum_context || "暂未生成馆内语境。",
    visitor_tip: data.visitor_tip || "请结合展牌文字、展厅位置和馆方说明继续观察。",
    confidence_note:
      data.confidence_note ||
      "此结果基于照片可见信息推断，不能作为专业鉴定或正式馆藏编号依据。"
  };
}

function renderResult(data) {
  const result = normalizeResult(data);
  Object.entries(fields).forEach(([key, element]) => {
    element.textContent = result[key];
  });
  emptyState.hidden = true;
  resultCard.hidden = false;
}

async function interpretImage() {
  const validationError = validateFile(selectedFile);
  if (validationError) {
    setStatus(validationError, "error");
    return;
  }

  const formData = new FormData();
  formData.append("image", selectedFile);

  submitButton.disabled = true;
  resetButton.disabled = true;
  setStatus("正在分析照片，请稍等...");

  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      body: formData
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "解读失败，请稍后再试。");
    }

    renderResult(payload);
    setStatus("解读完成。");
  } catch (error) {
    setStatus(error.message || "网络连接异常，请检查后端地址或稍后再试。", "error");
  } finally {
    submitButton.disabled = false;
    resetButton.disabled = false;
  }
}

input.addEventListener("change", (event) => {
  selectFile(event.target.files[0]);
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  selectFile(event.dataTransfer.files[0]);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  interpretImage();
});

resetButton.addEventListener("click", () => {
  resetSelection();
});
