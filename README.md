# 奶蛙在东秦

多块奶蛙立牌在东北大学秦皇岛分校各自流动的公开旅行日记。Next.js 负责页面和 API，Neon Postgres 保存各立牌的独立状态，Cloudflare R2 保存照片。

## 接棒规则

1. 管理员在 `/admin` 创建立牌名称和首位持有人手机号；每块立牌生成自己的 4 位数字交接码，仅显示一次。
2. 当前持有人在 `/upload` 选择手里的立牌，输入自己的手机号及该立牌的交接码，上传 1–3 张照片，使用 GPS 或手动选点，填写下家手机号。
3. 提交成功后页面只显示一次该立牌的新交接码。当前持有人须将其随立牌交给下家。同一立牌的并发提交仅允许一个成功，不同立牌可以同时流转。

首页合并展示所有立牌的照片时间线，并标明立牌名称。手机号、交接码和操作日志不在公开 API 中返回。正确手机号下连续输错 5 次交接码会锁定该立牌 15 分钟。

## 本地开发

需要 Node.js 20.9 或更新版本、Postgres 数据库以及 R2 存储桶。

```bash
npm ci
cp .env.example .env.local
# 编辑 .env.local，填入数据库、管理密钥和 R2 凭据
node --env-file=.env.local node_modules/.bin/tsx scripts/migrate.ts
npm run dev
```

`ADMIN_KEY` 应为至少 32 个随机字符，例如用 `openssl rand -hex 32` 生成。它同时用于签署管理员会话、加密当前手机号和计算手机号及交接码的摘要。**直接更换此密钥会使已有手机号无法解密，并让当前交接码失效**；更换前应备份当前手机号，然后重新初始化持有人状态。

环境变量：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | Neon Postgres 连接串，Vercel Marketplace 集成可注入 |
| `ADMIN_KEY` | 唯一的管理登录密钥，至少 32 字符 |
| `R2_ACCOUNT_ID` | Cloudflare 账号 ID |
| `R2_ACCESS_KEY_ID` | R2 对象读写访问密钥 ID |
| `R2_SECRET_ACCESS_KEY` | R2 对象读写访问密钥 Secret |
| `R2_BUCKET` | 私有 R2 存储桶名称 |
| `NEXT_PUBLIC_AMAP_KEY` | 高德 Web 端 JS API Key，供浏览器加载地图 |
| `AMAP_SECURITY_CODE` | 高德安全密钥，仅在服务端代理使用 |

`R2_ENDPOINT` 仅供本地测试指定 S3 兼容服务器；正式部署留空。

## Vercel 与 R2 部署

1. 将此目录作为 Vercel 项目的根目录部署。框架选择 Next.js。通过 Vercel Marketplace 连接 Neon，并确认生产环境有 `DATABASE_URL`。
2. 在 Cloudflare 创建**私有** R2 存储桶，创建仅针对该桶的对象读写密钥，并将上述 R2 环境变量配置到 Vercel Production。将 `ADMIN_KEY` 配置为 Vercel 加密环境变量。
3. 对 Neon 生产数据库依次运行 `db/001_init.sql` 和 `db/002_parallel_stands.sql`，或在已有生产 `DATABASE_URL` 的安全环境运行 `npm run db:migrate`。迁移脚本按文件名记录已应用版本，不会重复执行。旧的单立牌数据会归入「初代奶蛙」；旧交接码会停用，管理员需为它生成新的 4 位码。
4. 知道正式站点域名后，在 R2 桶设置以下 CORS。把来源替换为**准确的正式站点 origin**；如果使用自定义域名，也需将其加入列表。

```json
[
  {
    "AllowedOrigins": ["https://YOUR-SITE.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

5. 给 R2 桶的 `pending/` 前缀设置 **1 天后删除**的对象生命周期规则。成功提交的照片会复制到 `photos/` 前缀；此规则只清理放弃上传的临时照片。
6. 部署后访问 `/admin` 创建立牌或重置「初代奶蛙」的旧交接码；请将生成的 4 位码立即保存并线下交给对应持有人。生产环境不写入演示记录。

上传使用 5 分钟有效的 R2 预签名 PUT URL，文件不经过 Vercel Function。照片在浏览器逐级缩小并压缩为 WebP；浏览器不支持 WebP 编码时改用 JPEG。每张限制在 2.5 MB 内并移除 EXIF；完成上传后服务端检查对象，再复制到正式前缀并在 Postgres 事务内写入流转。公开照片使用 1 小时有效的预签名 GET URL。

## 验证

```bash
npm test
npm run typecheck
npm run build
```

`scripts/smoke-local.mjs` 是完整本地 API 测试，覆盖管理员验证、多立牌独立接棒、4 位码锁定、照片上传、日志、隐藏记录和改名。它**只允许**连接 `127.0.0.1:55432/naiwa_test`，会重置这个本地测试库；配合 `scripts/mock-r2.mjs` 和本地 Postgres 使用，不会接触生产数据库。

地图使用高德官方 JS API，并通过站内 `/_AMapService` 代理传递服务端安全密钥。已有照片和 GPS 定位的 WGS84 坐标在显示时转换为 GCJ-02；手动地图选点会转换回 WGS84 后再保存。请在高德控制台把站点域名加入 Key 的允许来源。校园初始视图坐标取自 [OpenStreetMap 地图数据](https://mapcarta.com/W696123388)。首页主视觉使用用户提供的 `naiwa_mascot.svg`，其他小插画仍为项目原有素材。
