import formidable from "formidable";
import { readFile } from "node:fs/promises";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const DEFAULT_MODEL = "gpt-5.5";

export const config = {
  api: {
    bodyParser: false
  }
};

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function parseMultipart(request) {
  const form = formidable({
    multiples: false,
    maxFileSize: MAX_IMAGE_BYTES,
    filter(part) {
      return part.name === "image";
    }
  });

  return new Promise((resolve, reject) => {
    form.parse(request, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files });
    });
  });
}

function firstFile(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function extractJsonText(responsePayload) {
  if (typeof responsePayload.output_text === "string") {
    return responsePayload.output_text;
  }

  const textBlocks = [];
  for (const item of responsePayload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        textBlocks.push(content.text);
      }
    }
  }

  return textBlocks.join("\n").trim();
}

function coerceInterpretation(rawText) {
  const fallback = {
    title: "未能确定具体文物",
    period: "年代信息不确定",
    description: rawText || "模型没有返回可用解读。",
    visual_clues: "请尝试上传更清晰、包含完整轮廓与展牌信息的照片。",
    museum_context: "可结合展厅位置与馆方展牌继续核对。",
    visitor_tip: "靠近展牌拍摄文字信息，通常能显著提高解读质量。",
    confidence_note: "此结果基于照片可见信息推断，不能作为专业鉴定或正式馆藏编号依据。"
  };

  try {
    const parsed = JSON.parse(rawText);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

async function callOpenAI(imageFile) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("后端缺少 OPENAI_API_KEY 环境变量。");
    error.statusCode = 500;
    throw error;
  }

  const imageBuffer = await readFile(imageFile.filepath);
  const imageBase64 = imageBuffer.toString("base64");
  const mediaType = imageFile.mimetype;
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const prompt = [
    "你是卫城博物馆的中文参观辅助讲解员。",
    "请根据用户上传的展品照片，生成谨慎、清楚、适合现场参观阅读的中文解读。",
    "不要编造确定的馆藏编号、展厅编号或题名；如果无法确认，请明确说明不确定。",
    "输出必须是严格 JSON，不要使用 Markdown。",
    "JSON 字段必须包括：title, period, description, visual_clues, museum_context, visitor_tip, confidence_note。"
  ].join("\n");

  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            },
            {
              type: "input_image",
              image_url: `data:${mediaType};base64,${imageBase64}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      }
    })
  });

  const payload = await openAIResponse.json().catch(() => ({}));

  if (!openAIResponse.ok) {
    const error = new Error(payload.error?.message || "OpenAI 图像解读请求失败。");
    error.statusCode = openAIResponse.status;
    throw error;
  }

  return coerceInterpretation(extractJsonText(payload));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "只支持 POST 请求。" });
    return;
  }

  try {
    const { files } = await parseMultipart(request);
    const imageFile = firstFile(files.image);

    if (!imageFile) {
      sendJson(response, 400, { error: "请上传字段名为 image 的图片。" });
      return;
    }

    if (!ACCEPTED_TYPES.has(imageFile.mimetype)) {
      sendJson(response, 415, { error: "目前只支持 JPG、PNG、WebP、HEIC 或 HEIF 图片。" });
      return;
    }

    if (imageFile.size > MAX_IMAGE_BYTES) {
      sendJson(response, 400, { error: "图片超过 8MB，请压缩后再上传。" });
      return;
    }

    const interpretation = await callOpenAI(imageFile);
    sendJson(response, 200, interpretation);
  } catch (error) {
    const isSizeError = error.code === 1009 || /maxFileSize/i.test(error.message || "");
    if (isSizeError) {
      sendJson(response, 400, { error: "图片超过 8MB，请压缩后再上传。" });
      return;
    }

    const statusCode = error.statusCode || 500;
    const message =
      statusCode >= 500
        ? "后端暂时无法完成解读，请检查部署环境变量或稍后再试。"
        : error.message;
    sendJson(response, statusCode, { error: message });
  }
}
