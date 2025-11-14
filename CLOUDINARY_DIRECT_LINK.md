# Cloudinary Direct Link - Frontend Guide

## ✅ Thay Đổi Backend
- ✅ Xóa endpoint download: `GET /api/v1/co/reports/download/:publicId`
- ✅ Backend trả về `excelUrl` là link Cloudinary trực tiếp (secure_url)
- ✅ Frontend chỉ cần dùng link này để tải file

## 📥 Cách Tải File Excel

### Option 1: Link HTML (Đơn giản nhất)
```jsx
// Trong component React
<a 
  href={report.excelUrl} 
  download={`${report.skuCode}.xlsx`}
  target="_blank"
  rel="noopener noreferrer"
>
  📥 Tải Excel
</a>
```

### Option 2: JavaScript Click
```javascript
// Khi bấm nút download
const downloadExcel = (excelUrl, fileName) => {
  const link = document.createElement('a');
  link.href = excelUrl;
  link.download = fileName;
  link.target = '_blank';
  link.click();
};

// Sử dụng
downloadExcel(report.excelUrl, `${report.skuCode}.xlsx`);
```

### Option 3: Window Open (Mở tab mới)
```javascript
window.open(report.excelUrl, '_blank');
```

## 🔗 Response Format từ Backend

```json
{
  "success": true,
  "errorCode": 0,
  "message": "Tạo bảng kê CTC thành công",
  "data": {
    "totalReports": 2,
    "reports": [
      {
        "skuCode": "SKU-001",
        "productName": "Product A",
        "excelUrl": "https://res.cloudinary.com/..../reports/cth_SKU-001_1763127250865.xlsx",
        "conclusion": "ĐẠT TIÊU CHÍ CTH",
        "totalNPLValue": 5000,
        "fobExcludingChina": 8000,
        "ctcPercentage": 80
      }
    ]
  }
}
```

## 🎯 Lợi Ích
✅ **Đơn giản**: Frontend chỉ cần dùng link trực tiếp
✅ **Nhanh**: Không qua server, tải trực tiếp từ Cloudinary
✅ **Bảo mật**: Link Cloudinary có expiration (tùy cấu hình)
✅ **Tiết kiệm**: Không tốn bandwidth server

## ⚠️ Lưu Ý
- Link Cloudinary có thể bị lộ nếu user inspect element
- Nếu cần bảo mật cao, hãy sử dụng signed URLs từ Cloudinary
- Hiện tại sử dụng public URLs (không signed)

## 📝 Cập Nhật Frontend
Tìm tất cả chỗ gọi `/api/v1/co/reports/download/` và thay bằng:
```javascript
// Cũ (xóa)
const url = `/api/v1/co/reports/download/${report.publicId}`;

// Mới (dùng excelUrl trực tiếp)
const url = report.excelUrl;
```
