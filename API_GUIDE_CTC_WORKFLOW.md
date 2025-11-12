# API Guide: CTC Workflow từ Bước 3 đến Hoàn thành

## Tổng quan Workflow

```
Step 3 (EXTRACTED) 
    ↓ [User bấm "Tiếp tục"]
Step 4 (CALCULATING) → Chạy calculation → (CALCULATED)
    ↓ [User review kết quả, bấm "Tiếp tục"]  
Step 5 (GENERATING_REPORTS) → Tạo bảng kê CTC → (COMPLETED)
```

---

## 1. Kiểm tra trạng thái lô hàng hiện tại

### Request
```bash
curl -X GET "http://localhost:3000/api/v1/co/lohang/691493d8b854cee3bb910fe2" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Response (Step 3 - Đã extract xong)
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Thành công",
  "data": {
    "_id": "691493d8b854cee3bb910fe2",
    "currentStep": 3,
    "status": "EXTRACTED",
    "criterionType": "CTC",
    "exchangeRate": 25000,
    "workflow": {
      "currentStep": 3,
      "totalSteps": 7,
      "steps": [
        {
          "step": 1,
          "name": "Upload Documents",
          "completed": true,
          "completedAt": "2025-11-12T13:45:00.000Z"
        },
        {
          "step": 2,
          "name": "Select Form & Criteria",
          "completed": true,
          "completedAt": "2025-11-12T13:46:00.000Z"
        },
        {
          "step": 3,
          "name": "Extract Data",
          "completed": true,
          "completedAt": "2025-11-12T13:48:00.000Z",
          "inProgress": false
        },
        {
          "step": 4,
          "name": "Calculate Consumption",
          "completed": false,
          "inProgress": false
        },
        {
          "step": 5,
          "name": "Generate Reports",
          "completed": false,
          "inProgress": false
        }
      ]
    }
  }
}
```

---

## 2. Bước 3 → 4: Chuyển sang Calculation

### Request
```bash
curl -X POST "http://localhost:3000/api/v1/co/lohang/691493d8b854cee3bb910fe2/continue" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Response (Calculation thành công)
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Đã hoàn thành calculation. Bấm tiếp tục để tạo bảng kê CTC.",
  "data": {
    "_id": "691493d8b854cee3bb910fe2",
    "currentStep": 4,
    "status": "CALCULATED",
    "workflow": {
      "currentStep": 4,
      "totalSteps": 7,
      "steps": [
        {
          "step": 4,
          "name": "Calculate Consumption",
          "completed": true,
          "completedAt": "2025-11-12T13:50:00.000Z",
          "inProgress": false
        }
      ]
    },
    "calculation": {
      "success": true,
      "status": "SUCCESS",
      "message": "Tính toán tiêu hao và phân bổ FIFO thành công",
      "warnings": [
        "SKU 5022064 - NPL \"调节脚钉 Chân tăng đơ\": Không tìm thấy trong VAT Invoice"
      ],
      "totalDetails": 77,
      "details": [
        {
          "skuCode": "5022064",
          "productName": "24\"x18\"x34\" vanity with ceramic vanity top",
          "quantitySku": 14,
          "maNl": "VanMDF",
          "soHd": "152",
          "ngayHd": "2025-05-30T00:00:00.000Z",
          "tenHang": "Ván MDF",
          "donViTinh": "M3",
          "soLuong": 3.5798,
          "donGia": 5001260,
          "thanhTien": 17905451.148,
          "tyGiaVndUsd": 26200,
          "donGiaUsd": 190.887786259542,
          "soLuongLamCo": 3.5798,
          "dvt": "M3",
          "triGiaCifUsd": 683.4876935033427,
          "hsCode": "",
          "xuatXu": "MUA VN KRXX",
          "normPerSku": 0.2557,
          "totalQuantityNeeded": 3.5798,
          "allocationOrder": 1,
          "status": "ALLOCATED"
        }
      ]
    }
  }
}
```

### Response (Calculation với warnings - Insufficient Stock)
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Đã hoàn thành calculation. Bấm tiếp tục để tạo bảng kê CTC.",
  "data": {
    "_id": "691493d8b854cee3bb910fe2",
    "currentStep": 4,
    "status": "CALCULATED_WITH_WARNINGS",
    "calculation": {
      "success": true,
      "status": "INSUFFICIENT_STOCK",
      "message": "Không đủ tồn kho NPL",
      "errors": [
        "NPL 'Thanh chắn nước làm bằng đá nhân tạo 787*102*25mm': Cần 30.0000 nhưng chỉ có 28.3200 trong kho",
        "NPL 'Thanh chắn nước làm bằng đá nhân tạo 1854*102*25mm': Cần 14.0000 nhưng chỉ có 7.6000 trong kho"
      ],
      "warnings": [],
      "totalDetails": 65
    }
  }
}
```

---

## 3. Xem chi tiết bảng Consumption (Optional)

### Request
```bash
curl -X GET "http://localhost:3000/api/v1/co/lohang/691493d8b854cee3bb910fe2/consumption" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Response
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Thành công",
  "data": {
    "lohangDraftId": "691493d8b854cee3bb910fe2",
    "details": [
      {
        "skuCode": "5022064",
        "productName": "24\"x18\"x34\" vanity with ceramic vanity top",
        "quantitySku": 14,
        "maNl": "VanMDF",
        "soHd": "152",
        "ngayHd": "2025-05-30T00:00:00.000Z",
        "tenHang": "Ván MDF",
        "donViTinh": "M3",
        "soLuong": 3.5798,
        "donGia": 5001260,
        "thanhTien": 17905451.148,
        "tyGiaVndUsd": 26200,
        "donGiaUsd": 190.887786259542,
        "soLuongLamCo": 3.5798,
        "dvt": "M3",
        "triGiaCifUsd": 683.4876935033427,
        "hsCode": "",
        "xuatXu": "MUA VN KRXX"
      }
    ],
    "summary": {
      "totalRecords": 77,
      "totalSkus": 8,
      "totalNplTypes": 19,
      "totalInvoices": 12,
      "totalThanhTienVnd": 2456789123.45,
      "totalTriGiaCifUsd": 98271.23
    }
  }
}
```

---

## 4. Bước 4 → 5: Tạo bảng kê CTC và hoàn thành

### Request
```bash
curl -X POST "http://localhost:3000/api/v1/co/lohang/691493d8b854cee3bb910fe2/continue" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Response (Thành công - Có CTC Reports)
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Đã chuyển sang bước 5 và tạo 8 bảng kê CTC",
  "data": {
    "_id": "691493d8b854cee3bb910fe2",
    "currentStep": 5,
    "status": "COMPLETED",
    "workflow": {
      "currentStep": 5,
      "totalSteps": 7,
      "steps": [
        {
          "step": 5,
          "name": "Generate Reports",
          "completed": true,
          "completedAt": "2025-11-12T13:52:00.000Z",
          "inProgress": false
        }
      ]
    },
    "calculation": {
      "details": [...],
      "totalDetails": 77
    },
    "ctcReports": {
      "success": true,
      "totalReports": 8,
      "reports": [
        {
          "skuCode": "5022064",
          "productName": "24\"x18\"x34\" vanity with ceramic vanity top (MDF, solid wood)",
          "excelUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v1699876543/ctc-reports/ctc_5022064_1699876543.xlsx",
          "conclusion": "ĐẠT TIÊU CHÍ CTC"
        },
        {
          "skuCode": "5022065",
          "productName": "30\"x18\"x34\" vanity with ceramic vanity top (MDF, solid wood)",
          "excelUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v1699876544/ctc-reports/ctc_5022065_1699876544.xlsx",
          "conclusion": "ĐẠT TIÊU CHÍ CTC"
        },
        {
          "skuCode": "5022040",
          "productName": "31\"x22\"x34\" vanity with White Carrara artificial stone",
          "excelUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v1699876545/ctc-reports/ctc_5022040_1699876545.xlsx",
          "conclusion": "KHÔNG ĐẠT TIÊU CHÍ CTC"
        }
      ]
    }
  }
}
```

### Response (Không phải tiêu chí CTC)
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Đã chuyển sang bước 5. Sẵn sàng hoàn thành quy trình.",
  "data": {
    "_id": "691493d8b854cee3bb910fe2",
    "currentStep": 5,
    "status": "COMPLETED",
    "criterionType": "RVC40",
    "ctcReports": null,
    "calculation": {
      "details": [...],
      "totalDetails": 77
    }
  }
}
```

---

## 5. Xem danh sách bảng kê CTC đã tạo

### Request
```bash
curl -X GET "http://localhost:3000/api/v1/co/lohang/691493d8b854cee3bb910fe2/ctc-reports" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Response
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Thành công",
  "data": {
    "lohangDraftId": "691493d8b854cee3bb910fe2",
    "criterionType": "CTC",
    "totalReports": 8,
    "reports": [
      {
        "skuCode": "5022064",
        "productName": "24\"x18\"x34\" vanity with ceramic vanity top (MDF, solid wood)",
        "excelUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v1699876543/ctc-reports/ctc_5022064_1699876543.xlsx",
        "publicId": "ctc-reports/ctc_5022064_1699876543",
        "conclusion": "ĐẠT TIÊU CHÍ CTC",
        "totalNPLValue": 1250.75,
        "fobExcludingChina": 1885.94,
        "ctcPercentage": 75.2,
        "createdAt": "2025-11-12T13:52:00.000Z"
      }
    ]
  }
}
```

---

## 6. Retry tạo bảng kê CTC (khi có lỗi)

### Request
```bash
curl -X POST "http://localhost:3000/api/v1/co/lohang/691493d8b854cee3bb910fe2/ctc-reports/retry" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Response
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Retry tạo bảng kê CTC thành công",
  "data": {
    "success": true,
    "totalReports": 8,
    "reports": [...]
  }
}
```

---

## 7. Xóa bảng kê CTC của một SKU

### Request
```bash
curl -X DELETE "http://localhost:3000/api/v1/co/lohang/691493d8b854cee3bb910fe2/ctc-reports/5022064" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Response
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Xóa bảng kê CTC thành công"
}
```

---

## Error Responses

### Calculation Failed
```json
{
  "success": false,
  "errorCode": 1,
  "message": "Lỗi tính toán consumption: Insufficient data",
  "error": "Error details..."
}
```

### CTC Generation Failed
```json
{
  "success": false,
  "errorCode": 1,
  "message": "Lỗi tạo bảng kê CTC: Missing NPL data for SKU 5022064",
  "error": "Error details..."
}
```

### Invalid Step Transition
```json
{
  "success": false,
  "errorCode": 1,
  "message": "Không thể continue từ bước 5. Lô hàng đang ở trạng thái: COMPLETED"
}
```

---

## Frontend Implementation Notes

### 1. **Step Detection**
```javascript
// Kiểm tra bước hiện tại
if (data.currentStep === 3 && data.status === 'EXTRACTED') {
  // Hiển thị nút "Tính toán Consumption"
}

if (data.currentStep === 4 && data.status === 'CALCULATED') {
  // Hiển thị kết quả calculation + nút "Tạo bảng kê CTC"
}

if (data.currentStep === 5 && data.status === 'COMPLETED') {
  // Hiển thị danh sách bảng kê CTC để download
}
```

### 2. **CTC Reports Handling**
```javascript
// Kiểm tra có CTC reports không
if (data.ctcReports && data.ctcReports.success) {
  data.ctcReports.reports.forEach(report => {
    // Tạo link download cho từng SKU
    console.log(`SKU ${report.skuCode}: ${report.excelUrl}`);
    console.log(`Kết luận: ${report.conclusion}`);
  });
}
```

### 3. **Error Handling**
```javascript
// Xử lý calculation warnings
if (data.calculation && data.calculation.status === 'INSUFFICIENT_STOCK') {
  // Hiển thị warnings về thiếu tồn kho
  data.calculation.errors.forEach(error => {
    console.warn(error);
  });
}
```

### 4. **Download Excel Files**
```javascript
// Download bảng kê CTC
function downloadCTCReport(excelUrl, skuCode) {
  const link = document.createElement('a');
  link.href = excelUrl;
  link.download = `CTC_Report_${skuCode}.xlsx`;
  link.click();
}
```

---

## Status Codes Summary

| Status | Meaning | Next Action |
|--------|---------|-------------|
| `EXTRACTED` | Đã extract 3 bảng | Bấm "Tính toán" |
| `CALCULATING` | Đang tính toán | Chờ... |
| `CALCULATED` | Tính toán thành công | Bấm "Tạo bảng kê" |
| `CALCULATED_WITH_WARNINGS` | Tính toán có cảnh báo | Bấm "Tạo bảng kê" |
| `COMPLETED` | Hoàn thành | Download bảng kê |

---

## Workflow Steps Summary

| Step | Name | Description |
|------|------|-------------|
| 3 | Extract Data | Trích xuất 3 bảng từ documents |
| 4 | Calculate Consumption | Tính toán tiêu hao NPL |
| 5 | Generate Reports | Tạo bảng kê CTC (nếu áp dụng) |
| 6 | Review Results | Review kết quả cuối cùng |
| 7 | Export CO | Xuất chứng nhận CO |
