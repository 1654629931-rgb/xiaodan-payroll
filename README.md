# 员工工资统计手机端程序

这是一个面向小型会计公司内部使用的手机端工资统计应用，采用 `React + Vite` 开发，数据默认保存在浏览器本地，可反复编辑。

## 已实现功能

- 员工信息管理：新增、编辑、删除员工档案，支持记录岗位、联系方式、薪资账户、备注
- 任务薪资库：新增、编辑、删除任务项，为每个任务设置固定金额
- 工资核算：勾选员工已完成任务后自动累计工资
- 扣款与调整：支持录入扣款事项、补贴项目、直接人工调整金额
- 记录查看：可查看员工当期工资、累计工资和历史工资记录，并支持二次编辑
- 本地保存：所有数据自动写入浏览器本地存储，刷新页面后仍可保留

## 页面说明

- `总览`：查看员工人数、任务数量、当期工资总额、累计工资总额
- `员工`：维护员工档案，并快速跳转到工资核算
- `任务价目`：维护任务薪资标准
- `工资核算`：按员工和月份维护工资明细，查看历史记录

## 本地运行

```bash
npm install
npm run dev
```

启动后在浏览器打开本地地址即可使用。

## 生产构建

```bash
npm run build
```

构建产物会生成在 `dist` 目录。

## 上传到 GitHub

建议上传整个项目源码目录，不要上传 `node_modules` 和 `dist`，仓库里保留这些文件即可：

- `src`
- `public`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `README.md`
- `.gitignore`

如果你在本地电脑操作，可以执行：

```bash
git init
git add .
git commit -m "初始化员工工资统计程序"
git branch -M main
git remote add origin 你的GitHub仓库地址
git push -u origin main
```

## 别人如何运行

别人从 GitHub 拉取后，在项目目录执行：

```bash
npm install
npm run dev
```

然后在浏览器打开终端提示的地址即可。

## 在线部署

项目已兼容静态部署，并已附带 GitHub Pages 自动发布工作流。

把项目上传到 GitHub 后，可按下面方式启用在线访问：

1. 进入 GitHub 仓库
2. 打开 `Settings`
3. 进入 `Pages`
4. 在 `Build and deployment` 中选择 `GitHub Actions`
5. 之后每次推送到 `main` 分支，都会自动发布

## 适合后续扩展的方向

- 增加数据导出为 Excel / PDF
- 增加登录口令或本地密码保护
- 增加员工筛选、任务分类、月份复制
- 增加云端同步或局域网部署
