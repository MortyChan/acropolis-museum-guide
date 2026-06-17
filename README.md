# 卫城博物馆文物解读助手

一个中文为主的参观辅助网站。用户上传在卫城博物馆拍摄的照片后，前端把图片发送到 Vercel Serverless 接口，后端代理调用 OpenAI 视觉模型并返回中文解读。

## 功能

- 图片上传、拖拽、预览和大小校验
- 通过 `POST /api/interpret` 生成文物解读
- 结果包含可能文物、历史背景、艺术特征、馆内语境、参观提示和不确定性说明
- OpenAI API Key 只保存在后端环境变量中

## 本地运行

1. 安装依赖：

   ```bash
   npm install
   ```

2. 创建 `.env.local`：

   ```bash
   OPENAI_API_KEY=你的 OpenAI API Key
   OPENAI_MODEL=gpt-5.5
   ```

3. 启动 Vercel 本地开发服务：

   ```bash
   npm run start
   ```

4. 打开 Vercel 输出的本地地址。

## 部署

### Vercel

1. 将仓库连接到 Vercel。
2. 在 Vercel 项目环境变量中设置 `OPENAI_API_KEY`。
3. 可选设置 `OPENAI_MODEL`，默认值为 `gpt-5.5`。
4. 部署后记录 Vercel 域名，例如 `https://acropolis-museum-guide.vercel.app`。

### GitHub Pages

如果前端放在 GitHub Pages，而 API 放在 Vercel，请把 `config.js` 中的接口地址改为 Vercel 域名：

```js
window.ACROPOLIS_GUIDE_CONFIG = {
  apiEndpoint: "https://acropolis-museum-guide.vercel.app/api/interpret"
};
```

然后在 GitHub 仓库的 Pages 设置中，选择从默认分支根目录发布。

## 接口

`POST /api/interpret`

- 请求格式：`multipart/form-data`
- 图片字段名：`image`
- 支持格式：JPG、PNG、WebP、HEIC、HEIF
- 最大图片：8MB

响应示例：

```json
{
  "title": "可能是帕台农神庙相关雕塑片段",
  "period": "古典时期，具体年代需结合展牌确认",
  "description": "这类作品常与雅典城邦宗教、公共纪念和神庙装饰有关。",
  "visual_clues": "可见大理石质感、人体衣褶和高浮雕处理。",
  "museum_context": "卫城博物馆中类似作品通常需要结合帕台农神庙展陈线索理解。",
  "visitor_tip": "观察衣褶方向、身体姿态和旁边展牌中的来源说明。",
  "confidence_note": "照片无法提供完整展牌和比例信息，因此不能确定具体馆藏编号。"
}
```

## 注意

AI 解读仅作参观辅助，不能替代馆方说明牌、专业鉴定或正式学术出版物。
