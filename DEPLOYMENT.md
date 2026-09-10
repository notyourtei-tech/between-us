# 发布清单

本项目的持久化设计是：**Vercel（React 前端） + Supabase（免费 Auth 与 PostgreSQL） + Render（Node API 健康服务）**。用户的私密内容不会经过 Render，直接由 Supabase 的 Row Level Security 保护。

## 1. GitHub

在项目目录执行：

```powershell
git init
git add .
git commit -m "feat: launch Between Us"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/between-us.git
git push -u origin main
```

不要提交 `.env.local`。`.gitignore` 已处理好。

## 2. Supabase

创建免费项目后，运行 `supabase/schema.sql`。它会创建数据表和限制为“只能读写自己数据”的 RLS 策略；基金与大事记只有读取和新增权限、没有网页端删除策略，因此登录后的历史不会被意外取消。把 Project URL 与 anon key 填入 Vercel 的环境变量；不要使用 service_role key。

## 3. Vercel

1. 导入 GitHub 仓库，框架选择 Vite（一般会自动识别）。
2. Settings → Environment Variables 添加 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`。
3. 使用 `npm run build` 构建、`dist` 作为输出目录。
4. 部署。将最终的 `https://…vercel.app` 域名加入 Supabase Authentication → URL Configuration 的 Site URL / Redirect URLs。

## 4. Render

项目中已包含免费 Blueprint `render.yaml`。在 GitHub 仓库已推送后打开：

`https://dashboard.render.com/blueprint/new?repo=https://github.com/YOUR_NAME/between-us`

按提示连接 GitHub 并 Apply。Render 会从 `server/` 运行服务，`/health` 返回 200。部署成功后在 Environment 添加：

```text
ALLOWED_ORIGINS=https://YOUR_APP.vercel.app
```

可选地，在 Vercel 添加 `VITE_API_URL=https://between-us-api.onrender.com` 后重新部署。此 API 用于服务健康状态；个人数据依然只会存到 Supabase。
