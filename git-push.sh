#!/bin/bash

# Auto git push script
# Tự động add, commit và push lên git

echo "🚀 Bắt đầu tự động upload lên git..."

# Kiểm tra có thay đổi gì không
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ Không có thay đổi nào để commit"
    exit 0
fi

# Add tất cả file thay đổi
echo "📁 Đang add files..."
git add .

# Tạo commit message với timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMMIT_MSG="Auto update - $TIMESTAMP

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Commit
echo "💾 Đang commit..."
git commit -m "$COMMIT_MSG"

# Push lên remote
echo "⬆️ Đang push lên git..."
git push

echo "✅ Hoàn thành! Đã upload lên git thành công."