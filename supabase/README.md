# 跃迹 × Supabase 部署指南

目标架构：

```
GitHub 仓库
  └─ GitHub Pages（静态前端）
       └─ Supabase Auth + Postgres
```

- 手机号只作为登录名。
- 密码由 Supabase Auth 哈希保存。
- 不发送短信验证码。
- 前端使用 Supabase `anon` key，数据安全依靠 Postgres RLS。

---

## 1. 创建 Supabase 项目

1. 打开 https://supabase.com ，注册并创建免费项目。
2. 等待数据库初始化完成。
3. 进入 **SQL Editor**，执行本目录的 [`schema.sql`](./schema.sql)。
4. 进入 **Authentication → Providers → Email**：
   - 启用 Email provider；
   - **关闭 Confirm email**（必须关闭，否则注册后无法直接登录）；
   - 不需要配置 Phone/SMS。
5. 进入 **Authentication → URL Configuration**：
   - Site URL 填 GitHub Pages 地址，例如：
     `https://<你的用户名>.github.io/<仓库名>/`
   - Redirect URLs 可暂时留空。
6. 在 **Project Settings → API** 获取：
   - Project URL
   - `anon` public key

> `anon` key 可以出现在前端，它不是 service_role key。不要把 `service_role` key 写进网页或提交到仓库。

---

## 2. 配置 GitHub

1. 将仓库推送到 GitHub。
2. 在 **Settings → Secrets and variables → Actions** 添加：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. 在 **Settings → Secrets and variables → Actions → Variables** 新增：
   - `YUEJI_MODE` = `supabase`

   工作流会根据这个变量生成 Supabase 配置；不设置时默认发布无登录 browser 模式。
4. 在 **Settings → Pages** 中把 Source 设为 **GitHub Actions**。
5. 推送到 `main`，工作流会自动构建并发布。
6. 发布完成后打开 Pages 地址。

工作流只发布：

- `index.html`
- `css/`
- `js/`
- `vendor/`
- `assets/`

不会发布 `server.py`、`tests/`、`data/` 或本地 SQLite 数据库。

---

## 3. 手机号登录的实现方式

Supabase 的 phone auth 需要短信 OTP。为了不发短信，这里使用 **Email/Password Auth**，但前端只让用户看到手机号：

```text
手机号 13800008888
  → 内部 email: 13800008888@phone.yueji.app
  → Supabase signUp / signInWithPassword
```

- 用户不需要看到或输入 email。
- 密码由 Supabase 处理。
- 不需要短信。
- 邮箱确认必须关闭，因为这个内部邮箱不接收邮件。

手机号唯一性由内部 email 唯一性 + `profiles.phone UNIQUE` 保证。

登录后可在「我的 → 账号安全 → 修改密码」验证当前密码并设置新密码；这不会发送邮件或短信。

> `phoneEmailDomain` 一旦有账号就不要再修改，否则内部 email 会变化，老账号将无法用原来的手机号登录。

---

## 4. 本地预览 Supabase 模式

修改 `js/config.js`：

```js
window.YUEJI_CONFIG = {
  mode: 'supabase',
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'eyJ...',
  phoneEmailDomain: 'phone.yueji.app'
};
```

然后用任意静态服务器打开根目录，例如：

```bash
python3 -m http.server 8080
```

不需要启动 `server.py`。

> GitHub Pages 工作流会自动生成 `dist/js/config.js`，不需要把真实 key 提交到仓库。

---

## 5. 把本地 SQLite 数据迁到 Supabase

1. 本地启动 `server.py`，登录后使用「导出数据」下载 JSON。
2. 在 Supabase 版本中注册新账号并完成首次引导。
3. 进入「导入数据」，选择该 JSON。

导入会写入 activities / weights；运动记录里的 `stream`、`strength` 明细会一起保留。

---

## 6. 免费额度与限制

- Supabase 免费项目有数据库大小、月活和休眠策略，以官网当前价格页为准。
- GitHub Pages 对公开仓库免费；私有仓库的 Pages 需要 GitHub 付费计划。
- 自定义域名需要自己购买域名；`*.github.io` 免费。
- 免费版没有 SLA，适合个人/小范围使用。

## 7. 重要限制

- 手机号没有经过短信验证，只是登录名；别人可以抢注未注册的手机号。
- 没有短信/真实邮箱，**忘记密码无法自助找回**；已登录用户可以在账号安全里修改密码，但忘记旧密码时仍需后续加恢复码/可选真实邮箱。
- 不要把这个方案用于金融、医疗等高敏感场景。
- 如果主要用户在中国大陆，GitHub Pages / Supabase 的访问速度可能不稳定；正式上线可考虑腾讯云 CloudBase 或阿里云，并处理备案。

## 8. 常见问题

**注册后提示需要邮箱确认**

关闭 Supabase 的 **Confirm email**。

**登录提示手机号或密码不正确**

检查手机号是否 11 位、密码是否至少 8 位；Supabase 免费项目可能有 Auth 速率限制。

**页面提示 Supabase 客户端加载失败**

确认 GitHub Pages 产物里包含 `vendor/supabase.js`，并且 `dist/js/config.js` 里有 URL 和 anon key。

**RLS 报错 / 没有权限**

确认已执行 `schema.sql` 里的 RLS policy 和 grant，并且登录会话有效。
