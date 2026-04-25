## pnpm中快速执行指定workspace下的script命令
pnpm 扫描到每个目录后，会读取该目录下的 package.json，把里面的 name 字段作为这个包在 workspace 中的唯一标识。
```yaml
# pnpm-workspace.yaml
packages:
  - internal/*
  - packages/*
  - apps/*
  - scripts/*
  - docs
  - playground
```

```bash
# -F 过滤指定的包名 (-F 必须大写)
pnpm -F @vben/vite-config run stub

# 也可以提供路径
pnpm -F ./internal/vite-config run stub
```

## 忽略git commit 时定义的校验钩子并直接提交
```bash
git commit -m '' --no-verify
```

## pnpm 和 npm sciprts中的钩子script
在这个 scripts 中，属于 pnpm/npm 内置生命周期钩子（会在特定时机自动触发）的只有这 3 个：

```bash
# package.json中的scripts
preinstall	执行 pnpm install 之前自动运行
postinstall	执行 pnpm install 之后自动运行
prepare	执行 pnpm install 之后自动运行（如果包未打包）；或在 pnpm publish 发布之前自动运行
```

pnpm 还有一个约定：自定义脚本也可以加 pre / post 前缀。比如如果你有：
```json
"scripts": {
  "prebuild": "echo before build",
  "build": "turbo build",
  "postbuild": "echo after build"
}
```

当你手动执行 pnpm run build 时，pnpm 会自动按顺序执行 prebuild → build → postbuild。

## pnpm-worksapce 安装依赖
memorepo项目一定要在根目录安装依赖，如果用pnpm -F 指定项目进行install的话，根目录的pnpm-workspace.yaml的依赖关系也会改变

## 快速验证nodejs中的依赖位置
```bash
# 这会根据nodejs的依赖解析规则一层一层的解析依赖，并输出依赖的具体位置
# 即： 当前package.json没有就会寻找上层的package.json
# pnpm-workspace.yaml安装依赖时，实际上依赖都在根目录的node_modules中，子项目的node_modules实际上时建立了一层软连接
node -e "console.log(require.resolve('packageName'))"
```
