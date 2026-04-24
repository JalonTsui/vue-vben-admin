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
