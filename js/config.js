/* 跃迹 YUEJI — 运行模式配置
 *
 * browser: 无登录，数据保存在当前浏览器（默认，适合直接发布）
 * local: 使用当前仓库里的 Python + SQLite 后端
 * supabase: GitHub Pages 静态前端 + Supabase Auth/Postgres
 *
 * GitHub Actions 部署时会生成一份 mode: 'browser' 的配置。
 */
window.YUEJI_CONFIG = {
  mode: 'browser',
  supabaseUrl: '',
  supabaseAnonKey: '',
  phoneEmailDomain: 'phone.yueji.app'
};
