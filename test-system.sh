#!/bin/bash

# CryptoPulse 测试脚本
# 验证系统是否正常工作

set -e

echo "=== CryptoPulse 系统测试 ==="
echo ""

# 测试1: 检查必需文件
echo "测试1: 检查必需文件..."
required_files=(
  "generate-daily-report.sh"
  "scripts/fetch-data.js"
  "scripts/generate-report.js"
  "package.json"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ 缺少必需文件: $file"
    exit 1
  fi
  echo "✓ $file"
done

# 测试2: 检查目录结构
echo ""
echo "测试2: 检查目录结构..."
required_dirs=(
  "scripts"
  "data"
  "en/2026"
  "zh/2026"
)

for dir in "${required_dirs[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "❌ 缺少目录: $dir"
    exit 1
  fi
  echo "✓ $dir"
done

# 测试3: 运行数据获取脚本
echo ""
echo "测试3: 运行数据获取脚本..."
if node scripts/fetch-data.js > /dev/null 2>&1; then
  echo "✓ 数据获取脚本运行成功"
else
  echo "❌ 数据获取脚本运行失败"
  exit 1
fi

# 测试4: 检查数据文件
echo ""
echo "测试4: 检查数据文件..."
if [ -f "data/raw-data.json" ]; then
  echo "✓ 数据文件已生成"
  # 检查文件内容
  if grep -q "timestamp" "data/raw-data.json"; then
    echo "✓ 数据文件格式正确"
  else
    echo "❌ 数据文件格式错误"
    exit 1
  fi
else
  echo "❌ 数据文件未生成"
  exit 1
fi

# 测试5: 运行报告生成脚本
echo ""
echo "测试5: 运行报告生成脚本..."
if node scripts/generate-report.js > /dev/null 2>&1; then
  echo "✓ 报告生成脚本运行成功"
else
  echo "❌ 报告生成脚本运行失败"
  exit 1
fi

# 测试6: 检查报告文件
echo ""
echo "测试6: 检查报告文件..."
TODAY=$(date +%Y-%m-%d)
if [ -f "en/2026/${TODAY}.md" ]; then
  echo "✓ 英文报告已生成: en/2026/${TODAY}.md"
else
  echo "❌ 英文报告未生成"
  exit 1
fi

if [ -f "zh/2026/${TODAY}.md" ]; then
  echo "✓ 中文报告已生成: zh/2026/${TODAY}.md"
else
  echo "❌ 中文报告未生成"
  exit 1
fi

# 测试7: 检查报告内容
echo ""
echo "测试7: 检查报告内容..."
if grep -q "CryptoPulse" "en/2026/${TODAY}.md"; then
  echo "✓ 英文报告内容正确"
else
  echo "❌ 英文报告内容错误"
  exit 1
fi

if grep -q "CryptoPulse" "zh/2026/${TODAY}.md"; then
  echo "✓ 中文报告内容正确"
else
  echo "❌ 中文报告内容错误"
  exit 1
fi

# 测试8: 测试主脚本
echo ""
echo "测试8: 测试主脚本..."
if ./generate-daily-report.sh --no-git > /dev/null 2>&1; then
  echo "✓ 主脚本运行成功"
else
  echo "❌ 主脚本运行失败"
  exit 1
fi

echo ""
echo "=== 所有测试通过！==="
echo "CryptoPulse 系统运行正常。"
echo ""
echo "使用方法:"
echo "  ./generate-daily-report.sh          # 生成日报并提交到 Git"
echo "  ./generate-daily-report.sh --no-git # 生成日报但不提交"
echo "  node scripts/fetch-data.js          # 仅获取数据"
echo "  node scripts/generate-report.js     # 仅生成报告"