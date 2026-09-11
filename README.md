# Between Us · 我们的倒数日

一个为异地情侣和纪念日而做的私密小站：数着下一次见面的日子、记住相识与初见、一起攒下见面基金，并把小事装进时光册。

## 已实现

- 邮箱注册 / 登录（Supabase Auth 免费额度）
- 双人共享空间：一方创建邀请码、另一方加入；双方看到同一份内容并都能编辑
- PostgreSQL 行级安全策略：只有这对情侣的两个已登录账户能读写自己的空间
- 下一次见面倒计时、上次到下次的时间进度、相识和初见天数
- 基础倒数、相识/在一起天数、初见过去天数、相见进度与百日里程碑
- 见面基金支持日元（JPY）、美元（USD）、白俄罗斯卢布（BYN）、人民币（CNY）；双方每一笔均可任选币种，实时折合、双方累计和共同累计
- 只追加的攒钱记录和大事记；数据库没有提供删除策略，历史不会被网页端误删
- 响应式精致界面；没有配置云端时能以本地演示模式完整预览
- Render 健康检查 API 和 Vercel 前端构建配置

## 本地运行

```bash
npm install
copy .env.example .env.local
npm run dev
```

## 接入免费登录与永不丢失的记录

1. 在 [Supabase](https://supabase.com/) 新建一个免费项目。
2. 在 SQL Editor 粘贴并运行 [`supabase/schema.sql`](supabase/schema.sql)。它会创建双人共享空间、邀请码与实时同步权限。
3. 在 Authentication → Providers 确认 Email 已开启；正式上线前可在 URL Configuration 填入 Vercel 域名。
4. 将 Project Settings → API 中的 Project URL 与 anon key 填入 `.env.local`：

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`anon key` 是用于浏览器端、受 RLS 保护的公开键；不要将 Supabase `service_role` key 放进前端或 GitHub。汇率通过无需 API key 的 ExchangeRate-API 获取并在界面中标明更新时刻，适合估算而非实际结售汇。

## 发布顺序

1. 在 GitHub 新建一个空仓库，然后推送本项目。
2. 在 Vercel 导入该仓库，添加两个 `VITE_SUPABASE_*` 环境变量后部署前端。
3. 在 Render 通过仓库创建 Blueprint。它会读取 [`render.yaml`](render.yaml)，只部署 `server/` 的 API；把 Vercel 域名填入 `ALLOWED_ORIGINS`。
4. 将 Render API 地址（可选）填入 Vercel 的 `VITE_API_URL`，然后重新部署。

详见 [`DEPLOYMENT.md`](DEPLOYMENT.md)。
