# Cloudinary Setup Guide - Excel Reports Upload

## 🎯 Vấn đề
Ở bước 5 (Quản lý C/O), hệ thống xuất Excel nhưng chỉ lưu vào source code thay vì upload lên Cloudinary.

## ✅ Nguyên nhân
File `ReportGenerator.service.js` kiểm tra `process.env.CLOUDINARY_URL`:
- Nếu có → Upload lên Cloudinary
- Nếu không → Lưu local vào `/reports`

## 🔧 Cách Cấu Hình

### Bước 1: Tạo Cloudinary Account
1. Truy cập https://cloudinary.com
2. Đăng ký tài khoản miễn phí
3. Vào Dashboard → Settings → API Keys
4. Lấy thông tin:
   - Cloud Name
   - API Key
   - API Secret

### Bước 2: Cấu Hình `.env.dev`
Thêm vào file `.env.dev` (hoặc `.env.production`):

```bash
# Format 1: Dùng CLOUDINARY_URL (Recommended)
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME

# Ví dụ:
CLOUDINARY_URL=cloudinary://123456789:abcdefghijklmnop@mycloud
```

Hoặc

```bash
# Format 2: Dùng từng biến (Alternative)
CLOUDINARY_CLOUD_NAME=mycloud
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abcdefghijklmnop
```

### Bước 3: Kiểm Tra Cấu Hình

#### Cách 1: Kiểm tra qua logs
Khi server khởi động, nếu thấy:
```
☁️ Using Cloudinary SDK for Excel reports
```
→ Cấu hình thành công ✅

Nếu thấy:
```
📁 Using local file storage for Excel reports
```
→ Chưa cấu hình Cloudinary, đang lưu local ❌

#### Cách 2: Test API
```bash
curl -X POST http://localhost:3000/api/v1/co/lohang/:id/continue \
  -H "Content-Type: application/json" \
  -d '{"reGenerateReports": true}'
```

Kiểm tra response:
- Nếu `excelUrl` là `https://res.cloudinary.com/...` → Upload thành công ✅
- Nếu `excelUrl` là `/reports/...` → Đang lưu local ❌

## 📋 Danh Sách Biến Cần Thiết

| Biến | Bắt buộc | Mô tả |
|------|---------|-------|
| `CLOUDINARY_URL` | ✅ | Kết nối đầy đủ đến Cloudinary |
| `CLOUDINARY_CLOUD_NAME` | ⚠️ | Chỉ cần nếu không dùng `CLOUDINARY_URL` |
| `CLOUDINARY_API_KEY` | ⚠️ | Chỉ cần nếu không dùng `CLOUDINARY_URL` |
| `CLOUDINARY_API_SECRET` | ⚠️ | Chỉ cần nếu không dùng `CLOUDINARY_URL` |

## 🔐 Bảo Mật

⚠️ **KHÔNG** commit `.env.dev` lên Git!

Đã thêm vào `.gitignore`:
```
.env
.env.dev
.env.production
.env.local
```

## 📁 Cấu Trúc Thư Mục Cloudinary

Reports sẽ được upload vào:
```
cloudinary://cloud_name/reports/
  ├── ctc_SKU001_1234567890.xlsx
  ├── ctc_SKU002_1234567891.xlsx
  └── ...
```

## 🐛 Troubleshooting

### Lỗi: "Cloudinary upload failed"
**Nguyên nhân**: API Key/Secret sai hoặc hết hạn
**Giải pháp**: 
1. Kiểm tra lại thông tin từ Cloudinary Dashboard
2. Regenerate API Key nếu cần

### Lỗi: "CLOUDINARY_URL is not set"
**Nguyên nhân**: Biến môi trường không được set
**Giải pháp**:
1. Kiểm tra `.env.dev` có biến `CLOUDINARY_URL` không
2. Restart server sau khi thêm biến
3. Kiểm tra logs: `☁️ Using Cloudinary SDK...`

### Excel vẫn lưu vào `/reports` thay vì Cloudinary
**Nguyên nhân**: `CLOUDINARY_URL` không được nhận
**Giải pháp**:
1. Kiểm tra format: `cloudinary://KEY:SECRET@CLOUD_NAME`
2. Không có khoảng trắng hoặc ký tự đặc biệt
3. Restart server

## ✨ Kết Quả Mong Đợi

Sau khi cấu hình đúng:

1. **Bước 5 - Tạo bảng kê**:
   ```
   ☁️ Uploading Excel to Cloudinary...
   ✅ Cloudinary upload successful: https://res.cloudinary.com/...
   ```

2. **Response API**:
   ```json
   {
     "success": true,
     "data": {
       "ctcReports": {
         "reports": [
           {
             "skuCode": "SKU001",
             "excelUrl": "https://res.cloudinary.com/mycloud/image/upload/v1234567890/reports/ctc_SKU001_1234567890.xlsx"
           }
         ]
       }
     }
   }
   ```

3. **Database** - `lohangDraft.ctcReports`:
   ```json
   [
     {
       "skuCode": "SKU001",
       "excelUrl": "https://res.cloudinary.com/...",
       "publicId": "reports/ctc_SKU001_1234567890"
     }
   ]
   ```

## 📚 Tham Khảo

- Cloudinary Docs: https://cloudinary.com/documentation
- Node.js SDK: https://github.com/cloudinary/cloudinary_npm
- API Reference: https://cloudinary.com/documentation/image_upload_api
