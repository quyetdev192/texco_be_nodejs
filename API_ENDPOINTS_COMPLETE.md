# TÀI LIỆU API ENDPOINTS HOÀN CHỈNH - TEXCO C/O SYSTEM

## TỔNG QUAN

Hệ thống có **27 API endpoints** được chia thành 6 nhóm chính:
1. **Authentication & User Management** (9 APIs)
2. **Document Management - Supplier** (3 APIs) 
3. **Document Management - Staff** (5 APIs)
4. **C/O Processing Workflow** (7 APIs) - ⭐ CẬP NHẬT
5. **Extracted Tables Management** (2 APIs)
6. **Health Check** (1 API)

### 📋 **WORKFLOW SYSTEM** - ⭐ MỚI NHẤT

Hệ thống có **8 bước workflow** rõ ràng với tracking đầy đủ:

**Workflow Response Format:**
```json
{
  "workflow": {
    "currentStep": 3,
    "status": "DATA_EXTRACTING",
    "canProceed": false,
    "message": "Data extraction in progress. Please wait...",
    "steps": [...],
    "nextAction": {
      "type": "WAIT",
      "label": "Extracting Data...",
      "polling": true,
      "pollingInterval": 5000
    }
  }
}
```

**Lợi ích:**
- ✅ FE biết đang ở bước nào (`currentStep`)
- ✅ Biết action tiếp theo là gì (`nextAction`)
- ✅ **Prevent spam** - Không cho phép bấm loạn xạ
- ✅ **Smart navigation** - Vào lại đúng màn hình
- ✅ **Polling support** - Tự động polling khi async

**Chi tiết:** Xem file `WORKFLOW_GUIDE.md`

### 🆕 API MỚI - Error Handling & Smart Re-extraction

**1. Retry Extraction API:**
```
POST /api/v1/co/lohang/:id/retry-extraction
```
- Retry toàn bộ khi extraction thất bại
- Chỉ hoạt động khi `status === "EXTRACTION_FAILED"`
- Tự động reset errors và chạy lại extraction
- FE nên polling để kiểm tra status sau khi retry

**2. Re-extract Table với User Note:** ⭐ **MỚI NHẤT**
```
POST /api/v1/co/lohang/:id/re-extract-table
```
- Re-extract **chỉ 1 bảng cụ thể** (PRODUCT, NPL, BOM)
- User thêm **ghi chú** mô tả vấn đề (VD: "Thiếu sản phẩm X", "Sai đơn vị Y")
- AI nhận note và **phân tích lại có chú ý** đến ghi chú
- Không ảnh hưởng các bảng khác
- Ghi chú được lưu vào DB để audit

## ⚡ CẢI TIẾN MỚI

### 1. Tự động xác định loại chứng từ (3 LỚP THÔNG MINH)
- **Lớp 1:** User chọn `documentType` thủ công (ưu tiên cao nhất)
- **Lớp 2:** Tự động detect từ tên file (HDVAT, Invoice, BOM, TKNK, etc.)
- **Lớp 3:** AI Gemini phân tích nội dung OCR để xác định (fallback)
- **Không bắt buộc** user phải chọn type - hệ thống tự xử lý
- Giảm thiểu lỗi do user chọn sai loại chứng từ

### 2. STAFF có thể upload bổ sung file
- STAFF có thể thêm file vào bundle của NCC bất kỳ lúc nào
- Kể cả sau khi đã duyệt và OCR xong
- Tự động chạy OCR cho file mới

### 3. Workflow linh hoạt hơn
- NCC upload (không cần chọn type) → STAFF xem → STAFF có thể bổ sung thêm file → Duyệt
- Sau khi duyệt → STAFF vẫn có thể bổ sung file → OCR lại tự động
- AI tự động phân tích và xác định loại chứng từ nếu cần

---


## 2. DOCUMENT MANAGEMENT - SUPPLIER (NCC)

### 2.1. NCC - Danh sách bộ chứng từ của mình
```
GET /api/v1/documents
```
**Role:** SUPPLIER  
**Headers:** `Authorization: Bearer {token}`  
**Query params:** 
- `?status=PENDING_REVIEW|APPROVED|REJECTED`
- `?page=1&limit=20`

**Response:**
```json
{
  "success": true,
  "data": {
    "bundles": [
      {
        "_id": "673f8a1b2c3d4e5f6a7b8c9d",
        "bundleName": "Bộ NPL tháng 11",
        "status": "PENDING_REVIEW",
        "documentCount": 3,
        "createdAt": "2024-11-09T15:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20
    }
  }
}
```

### 2.2. NCC - Tạo bộ chứng từ mới
```
POST /api/v1/documents
```
**Role:** SUPPLIER  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "bundleName": "Bộ NPL tháng 11",
  "documents": [
    {
      "fileName": "HDVAT_NPL_Thang11.pdf",
      "documentType": "HDVAT_NPL",
      "storagePath": "https://s3.amazonaws.com/...",
      "note": "Hóa đơn VAT tháng 11",
      "ocrPages": [
        {
          "page": 1,
          "ocrStoragePath": "https://s3.amazonaws.com/ocr/page1.jpg"
        }
      ]
    }
  ]
}
```

**⚡ Lưu ý mới - 3 LỚP TỰ ĐỘNG:**
- `documentType` là **OPTIONAL** (không bắt buộc)
- **Lớp 1:** Nếu user cung cấp `documentType` → Sử dụng ngay
- **Lớp 2:** Nếu không cung cấp → Tự động detect từ `fileName`:
  - `HDVAT_*.pdf` → `VAT_INVOICE`
  - `Invoice_*.pdf` → `COMMERCIAL_INVOICE`
  - `BOM_*.xlsx` → `BOM`
  - `TKNK_*.pdf` → `IMPORT_DECLARATION`
  - `PurchaseList_*.pdf` → `PURCHASE_LIST`
- **Lớp 3:** Nếu không detect được từ filename → **AI Gemini phân tích nội dung OCR**
  - Sau khi OCR xong, Gemini đọc nội dung và xác định loại chứng từ
  - Độ tin cậy > 60% mới áp dụng
  - Kết quả ghi vào field `note` của document

**Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Tải bộ chứng từ thành công",
  "data": {
    "bundle": {
      "_id": "673f8a1b2c3d4e5f6a7b8c9d",
      "bundleName": "Bộ NPL tháng 11",
      "status": "PENDING_REVIEW",
      "createdAt": "2024-11-09T15:00:00.000Z"
    },
    "documents": [
      {
        "_id": "673f8a1b2c3d4e5f6a7b8c9e",
        "fileName": "HDVAT_NPL_Thang11.pdf",
        "documentType": "VAT_INVOICE",
        "documentType_text": "Hóa đơn VAT",
        "status": "PENDING_REVIEW"
      }
    ],
    "failed": [],
    "warnings": [
      {
        "index": 0,
        "fileName": "HDVAT_NPL_Thang11.pdf",
        "detectedType": "VAT_INVOICE",
        "message": "Đã tự động xác định loại chứng từ"
      }
    ]
  }
}
```

### 2.3. NCC - Cập nhật bộ chứng từ
```
PUT /api/v1/documents/:bundleId
```
**Role:** SUPPLIER  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "bundleName": "Bộ NPL tháng 11 - Updated",
  "documents": [...]
}
```

---

## 3. DOCUMENT MANAGEMENT - STAFF (NHÂN VIÊN C/O)

### 3.1. STAFF - Danh sách bộ chứng từ chờ duyệt
```
GET /api/v1/review/documents
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Query params:** 
- `?status=PENDING_REVIEW|APPROVED|REJECTED`
- `?bundleId=673f8a1b2c3d4e5f6a7b8c9d` (lọc theo bundle cụ thể)
- `?supplierName=ncc1.texco`
- `?page=1&limit=20`

**Response:**
```json
{
  "success": true,
  "data": {
    "bundles": [
      {
        "_id": "673f8a1b2c3d4e5f6a7b8c9d",
        "bundleName": "Bộ NPL tháng 11",
        "supplierName": "ncc1.texco",
        "status": "PENDING_REVIEW",
        "documentCount": 3,
        "createdAt": "2024-11-09T15:00:00.000Z"
      }
    ]
  }
}
```

**Lưu ý:** Khi có query param `?bundleId=xxx`, API này trả về **danh sách documents** trong bundle đó:
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "_id": "673f8a1b2c3d4e5f6a7b8c9e",
        "fileName": "HDVAT.pdf",
        "documentType": "HDVAT_NPL",
        "status": "OCR_COMPLETED",
        "ocrText": "Extracted text..."
      }
    ]
  }
}
```

### 3.2. STAFF - Duyệt/Từ chối bộ chứng từ
```
PUT /api/v1/review/documents/:bundleId/review
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "action": "APPROVE|REJECT",
  "comment": "OK" 
}
```

**Response khi APPROVE:**
```json
{
  "success": true,
  "message": "Đã duyệt bộ chứng từ, OCR đang chạy",
  "data": {
    "bundleId": "673f8a1b2c3d4e5f6a7b8c9d",
    "status": "APPROVED",
    "documentIds": ["673f8a1b2c3d4e5f6a7b8c9e"]
  }
}
```

### 3.3. STAFF - Retry OCR cho 1 document cụ thể
```
PUT /api/v1/review/documents/:bundleId/ocr-retry/:documentId
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Đã khởi chạy lại OCR cho chứng từ",
  "data": {
    "documentId": "673f8a1b2c3d4e5f6a7b8c9e",
    "status": "OCR_PROCESSING"
  }
}
```

### 3.4. STAFF - Retry OCR cho tất cả documents lỗi trong bundle
```
PUT /api/v1/review/documents/:bundleId/ocr-retry
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Đã khởi chạy lại OCR cho các chứng từ lỗi trong bộ",
  "data": {
    "bundleId": "673f8a1b2c3d4e5f6a7b8c9d",
    "retryCount": 2,
    "documentIds": ["673f8a1b...", "673f8a1c..."]
  }
}
```

### 3.5. ⚡ STAFF - Bổ sung file vào bundle (KỂ CẢ SAU KHI ĐÃ DUYỆT)
```
POST /api/v1/review/documents/:bundleId/add
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "documents": [
    {
      "fileName": "BOM_SanPham_A.xlsx",
      "storagePath": "https://s3.amazonaws.com/...",
      "note": "Bổ sung BOM sản phẩm A",
      "ocrPages": [
        {
          "page": 1,
          "ocrStoragePath": "https://s3.amazonaws.com/ocr/bom_page1.jpg"
        }
      ]
    }
  ]
}
```

**⚡ Đặc điểm:**
- STAFF có thể bổ sung file **bất kỳ lúc nào**
- Kể cả khi bundle đã ở trạng thái `APPROVED`, `OCR_COMPLETED`
- `documentType` **OPTIONAL** - tự động detect từ tên file
- File mới sẽ tự động chạy OCR ngay lập tức
- Bundle status sẽ chuyển về `OCR_PROCESSING` nếu đã hoàn thành

**Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Đã bổ sung chứng từ và khởi chạy OCR",
  "data": {
    "bundle": {
      "_id": "673f8a1b2c3d4e5f6a7b8c9d",
      "bundleName": "Bộ NPL tháng 11",
      "status": "OCR_PROCESSING",
      "reviewNotes": [
        {
          "by": "690...",
          "byUsername": "nv1.texco",
          "byFullName": "Nguyễn Văn A",
          "note": "Đã bổ sung 1 chứng từ mới",
          "action": "ADD_DOCUMENTS",
          "createdAt": "2024-11-09T16:30:00.000Z"
        }
      ]
    },
    "documents": [
      {
        "_id": "673f8a1b2c3d4e5f6a7b8c9e",
        "fileName": "HDVAT_NPL_Thang11.pdf",
        "documentType": "VAT_INVOICE",
        "status": "OCR_COMPLETED"
      },
      {
        "_id": "673f8a1b2c3d4e5f6a7b8c9f",
        "fileName": "BOM_SanPham_A.xlsx",
        "documentType": "BOM",
        "status": "OCR_PROCESSING"
      }
    ],
    "addedCount": 1,
    "failed": [],
    "warnings": [
      {
        "index": 0,
        "fileName": "BOM_SanPham_A.xlsx",
        "detectedType": "BOM",
        "message": "Đã tự động xác định loại chứng từ"
      }
    ]
  }
}
```

**CURL Example:**
```bash
curl -X POST http://localhost:3000/api/v1/review/documents/673f8a1b2c3d4e5f6a7b8c9d/add \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "fileName": "BOM_SanPham_A.xlsx",
        "storagePath": "https://s3.amazonaws.com/texco/bom_product_a.xlsx",
        "note": "Bổ sung BOM sản phẩm A",
        "ocrPages": [
          {
            "page": 1,
            "ocrStoragePath": "https://s3.amazonaws.com/texco/ocr/bom_page1.jpg"
          }
        ]
      }
    ]
  }'
```

---

## 4. C/O PROCESSING WORKFLOW - ⚡ LUỒNG MỚI CHÍNH XÁC

### 📌 FLOW QUẢN LÝ C/O - TẠO MỚI vs TIẾP TỤC

#### 🎯 MÀN HÌNH QUẢN LÝ C/O (Trang chủ)

Khi vào màn hình quản lý C/O, hệ thống sẽ:
1. **Load danh sách C/O**: `GET /api/v1/co/list`
   - Hiển thị tất cả C/O (draft + hoàn thành)
   - C/O có `status=DRAFT` → Hiển thị nút **"Tiếp tục"**
   - C/O có `status=COMPLETED` → Hiển thị nút **"Xem chi tiết"** hoặc **"Xuất Excel"**

2. **Nút "Tạo mới"** → Chuyển sang flow tạo C/O mới

---

#### 🔄 FLOW 1: KHI BẤM "TIẾP TỤC" C/O DRAFT

```
BƯỚC 1: User click "Tiếp tục" trên C/O draft
   → Gọi: GET /api/v1/co/lohang/:lohangDraftId
   → Lấy chi tiết C/O draft: bundleId, documents, status, formType, criterionType

BƯỚC 2: Kiểm tra trạng thái và tiếp tục từ bước đang dở
   - Nếu status = DRAFT và chưa có formType → Chuyển đến Bước 4 (Chọn Form)
   - Nếu status = DRAFT và đã có formType → Chuyển đến Bước 5 (Xác nhận)
   - Nếu status = DATA_CONFIRMED → Chuyển đến Bước 6 (Tính toán)
   - Nếu status = CALCULATING → Hiển thị tiến độ
   - Nếu status = COMPLETED → Hiển thị kết quả + Xuất Excel

BƯỚC 3: (Optional) Upload bổ sung file
   → Gọi: POST /api/v1/review/documents/:bundleId/add
   → Hoặc: PUT /api/v1/review/documents/:bundleId/documents/:documentId (Sửa)
   → Hoặc: DELETE /api/v1/review/documents/:bundleId/documents/:documentId (Xoá)

BƯỚC 4: Chọn Form E/B và Tiêu chí
   → Gọi: PUT /api/v1/co/lohang/:lohangDraftId/setup
   → Hệ thống bắt đầu trích xuất dữ liệu từ Invoice, BOM

BƯỚC 5: Xác nhận dữ liệu
   → Gọi: PUT /api/v1/co/lohang/:lohangDraftId/confirm

BƯỚC 6: Bắt đầu tính toán
   → Gọi: POST /api/v1/co/calculate/:lohangDraftId

BƯỚC 7: Xem kết quả và xuất Excel
   → Gọi: GET /api/v1/co/export/:lohangDraftId?skuCode=SKU001
```

---

#### ➕ FLOW 2: KHI BẤM "TẠO MỚI" C/O

```
BƯỚC 1: User click "Tạo mới"
   → Hiển thị danh sách bundle đã OCR xong
   → Gọi: GET /api/v1/review/documents?status=OCR_COMPLETED

BƯỚC 2: User chọn bundle
   → Gọi: POST /api/v1/co/create
   → Body: { "bundleId": "673f8a1b2c3d4e5f6a7b8c9d" }
   → Hệ thống tạo C/O draft ngay lập tức
   → Trả về: lohangDraftId, invoiceNo, documents[]

BƯỚC 3: (Optional) Upload bổ sung file vào bundle
   → Gọi: POST /api/v1/review/documents/:bundleId/add (Thêm file)
   → Gọi: PUT /api/v1/review/documents/:bundleId/documents/:documentId (Sửa file)
   → Gọi: DELETE /api/v1/review/documents/:bundleId/documents/:documentId (Xoá file)
   → User có toàn quyền thêm/sửa/xoá file

BƯỚC 4: User bấm "Tiếp tục" → Chọn Form E/B và Tiêu chí
   → Gọi: PUT /api/v1/co/lohang/:lohangDraftId/setup
   → Body: { "formType": "FORM_E", "exchangeRate": 24500, "criterionType": "CTC" }
   → Hệ thống bắt đầu trích xuất dữ liệu từ Invoice, BOM
   → Status chuyển sang DATA_EXTRACTING → DRAFT (chờ confirm)

BƯỚC 5: (Optional) Cập nhật cấu hình nếu cần
   → Gọi: PUT /api/v1/co/lohang/:lohangDraftId/config

BƯỚC 6: User xác nhận dữ liệu
   → Gọi: PUT /api/v1/co/lohang/:lohangDraftId/confirm
   → Status chuyển sang DATA_CONFIRMED

BƯỚC 7: User bấm "Tính toán"
   → Gọi: POST /api/v1/co/calculate/:lohangDraftId
   → Hệ thống chạy async (không chờ)
   → Status chuyển sang CALCULATING

BƯỚC 8: User kiểm tra tiến độ
   → Gọi: GET /api/v1/co/lohang/:lohangDraftId
   → Xem processedSkuCount / totalSkuCount
   → Khi status = COMPLETED → Hiển thị kết quả

BƯỚC 9: User xuất Excel
   → Gọi: GET /api/v1/co/export/:lohangDraftId?skuCode=SKU001
```

---

| Hành động | API sử dụng | Mô tả |
|-----------|-------------|-------|
| **Xem danh sách C/O** | `GET /api/v1/co/list` | Hiển thị tất cả C/O (draft + hoàn thành) |
| **Tiếp tục C/O draft** | `GET /api/v1/co/lohang/:id` | Lấy chi tiết C/O draft để tiếp tục |
| **Xem danh sách bundle** | `GET /api/v1/review/documents?status=OCR_COMPLETED` | Xem bundle đã OCR xong |
| **Tạo C/O mới** | `POST /api/v1/co/create` | Tạo C/O draft từ bundle (chỉ cần bundleId) |
| **Thêm file vào bundle** | `POST /api/v1/review/documents/:bundleId/add` | Thêm file mới vào bundle |
| **Sửa file trong bundle** | `PUT /api/v1/review/documents/:bundleId/documents/:documentId` | Cập nhật file trong bundle |
| **Xoá file khỏi bundle** | `DELETE /api/v1/review/documents/:bundleId/documents/:documentId` | Xoá file khỏi bundle |
| **Chọn Form + Tiêu chí** | `PUT /api/v1/co/lohang/:id/setup` | Setup Form E/B + tiêu chí + trích xuất dữ liệu |
| **Cập nhật cấu hình** | `PUT /api/v1/co/lohang/:id/config` | Cập nhật formType, exchangeRate, criterionType |
| **Xác nhận dữ liệu** | `PUT /api/v1/co/lohang/:id/confirm` | Xác nhận dữ liệu trước khi tính toán |
| **Tính toán FIFO** | `POST /api/v1/co/calculate/:id` | Bắt đầu tính toán phân bổ FIFO |
| **Xuất Excel** | `GET /api/v1/co/export/:id?skuCode=xxx` | Xuất Excel bảng kê |
---

### BƯỚC 1: XEM DANH SÁCH

#### 4.1. STAFF - Danh sách C/O đã tạo (bao gồm draft và hoàn thành)
```
GET /api/v1/co/list
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Query params:** 
- `?status=DRAFT|DATA_CONFIRMED|CALCULATING|COMPLETED|FAILED` (lọc theo trạng thái)
- `?invoiceNo=INV-2024-001` (tìm theo số invoice)
- `?formType=FORM_E|FORM_B` (lọc theo loại form)
- `?page=1&limit=20`

**⚡ Đặc điểm:**
- Hiển thị tất cả C/O (draft + hoàn thành)
- Các C/O có status = DRAFT sẽ có **nút "Tiếp tục"**
- Click "Tiếp tục" → Gọi API 4.12 để lấy chi tiết C/O draft
- Click "Tạo mới" → Chuyển sang bước 2 (xem danh sách bundle)

**Response:**
```json
{
  "success": true,
  "data": {
    "coList": [
      {
        "_id": "673fac3d4e5f6a7b8c9d0e1f",
        "bundleId": "673f8a1b2c3d4e5f6a7b8c9d",
        "bundleName": "Lô hàng xuất khẩu tháng 11",
        "invoiceNo": "INV-2024-001",
        "formType": "FORM_E",
        "criterionType": "CTC",
        "exchangeRate": 24500,
        "status": "DRAFT",
        "totalSkuCount": 3,
        "processedSkuCount": 0,
        "createdAt": "2024-11-09T16:00:00.000Z",
        "updatedAt": "2024-11-09T16:30:00.000Z"
      },
      {
        "_id": "673fac3d4e5f6a7b8c9d0e20",
        "bundleId": "673f8a1b2c3d4e5f6a7b8c9e",
        "bundleName": "Lô hàng xuất khẩu tháng 10",
        "invoiceNo": "INV-2024-002",
        "formType": "FORM_B",
        "criterionType": "RVC40",
        "exchangeRate": 24600,
        "status": "COMPLETED",
        "totalSkuCount": 5,
        "processedSkuCount": 5,
        "createdAt": "2024-10-15T10:00:00.000Z",
        "completedAt": "2024-10-16T14:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

**CURL Example:**
```bash
# Lấy tất cả C/O
curl -X GET http://localhost:3000/api/v1/co/list \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Lọc C/O draft
curl -X GET "http://localhost:3000/api/v1/co/list?status=DRAFT" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Tìm theo invoice
curl -X GET "http://localhost:3000/api/v1/co/list?invoiceNo=INV-2024-001" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

#### 4.2. STAFF - Danh sách bộ chứng từ đã duyệt (để chọn tạo C/O)
```
GET /api/v1/review/documents?status=APPROVED
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Query params:** 
- `?status=APPROVED|OCR_COMPLETED` (chỉ lấy bundle đã duyệt)
- `?supplierName=ncc1.texco` (lọc theo NCC)
- `?bundleName=Lô hàng` (tìm theo tên bundle)
- `?page=1&limit=20`

**Response:**
```json
{
  "success": true,
  "data": {
    "bundles": [
      {
        "_id": "673f8a1b2c3d4e5f6a7b8c9d",
        "bundleName": "Lô hàng xuất khẩu tháng 11",
        "supplierName": "ncc1.texco",
        "supplierFullName": "Công ty TNHH ABC",
        "status": "APPROVED",
        "documentCount": 3,
        "documents": [
          {
            "_id": "673f8a1b2c3d4e5f6a7b8c9e",
            "fileName": "Invoice_Nov.pdf",
            "documentType": "INVOICE",
            "status": "OCR_COMPLETED"
          },
          {
            "_id": "673f8a1b2c3d4e5f6a7b8c9f",
            "fileName": "BOM_Products.xlsx",
            "documentType": "BOM",
            "status": "OCR_COMPLETED"
          },
          {
            "_id": "673f8a1b2c3d4e5f6a7b8ca0",
            "fileName": "PackingList.pdf",
            "documentType": "PACKING_LIST",
            "status": "OCR_COMPLETED"
          }
        ],
        "createdAt": "2024-11-09T15:00:00.000Z",
        "approvedAt": "2024-11-09T16:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20
    }
  }
}
```

**CURL Example:**
```bash
# Lấy tất cả bundle đã duyệt
curl -X GET "http://localhost:3000/api/v1/review/documents?status=APPROVED" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Tìm theo tên bundle
curl -X GET "http://localhost:3000/api/v1/review/documents?status=APPROVED&bundleName=Lô%20hàng%20xuất%20khẩu" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### BƯỚC 2: TẠO C/O TỪ BUNDLE

#### 4.3. ⚡ STAFF - Tạo C/O draft từ bundle (Bước 1)
```
POST /api/v1/co/create
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "bundleId": "673f8a1b2c3d4e5f6a7b8c9d"
}
```

**⚡ Đặc điểm:**
- STAFF chỉ cần chọn bundle đã OCR xong (status = OCR_COMPLETED)
- Hệ thống tự động tạo C/O draft ngay lập tức
- Tự động lấy tất cả documents trong bundle
- Tự động phân loại: Invoice, Packing List, BOM
- **Chưa trích xuất dữ liệu** - chỉ tạo draft
- Status = DRAFT (chưa hoàn thành)
- **Chưa cần chọn Form E/B và tiêu chí** - sẽ chọn ở bước sau

**Response:**
```json
{
  "success": true,
  "message": "Đã tạo C/O draft thành công",
  "data": {
    "lohangDraft": {
      "_id": "673fac3d4e5f6a7b8c9d0e1f",
      "bundleId": "673f8a1b2c3d4e5f6a7b8c9d",
      "invoiceNo": "INV-2024-001",
      "status": "DRAFT",
      "documentCount": 3,
      "documents": [
        {
          "_id": "673f8a1b2c3d4e5f6a7b8c9e",
          "fileName": "Invoice_Nov.pdf",
          "documentType": "INVOICE"
        },
        {
          "_id": "673f8a1b2c3d4e5f6a7b8c9f",
          "fileName": "BOM_Products.xlsx",
          "documentType": "BOM"
        },
        {
          "_id": "673f8a1b2c3d4e5f6a7b8ca0",
          "fileName": "PackingList.pdf",
          "documentType": "PACKING_LIST"
        }
      ],
      "createdAt": "2024-11-09T16:00:00.000Z"
    }
  }
}
```

**CURL Example:**
```bash
curl -X POST http://localhost:3000/api/v1/co/create \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": "673f8a1b2c3d4e5f6a7b8c9d"
  }'
```

---

### BƯỚC 3: QUẢN LÝ FILE TRONG BUNDLE (THÊM/SỬA/XOÁ)

#### 4.4. ⚡ STAFF - Thêm file vào bundle
```
POST /api/v1/review/documents/:bundleId/add
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "documents": [
    {
      "fileName": "BOM_Additional.xlsx",
      "storagePath": "https://s3.amazonaws.com/...",
      "note": "BOM bổ sung cho sản phẩm mới",
      "ocrPages": [
        {
          "page": 1,
          "ocrStoragePath": "https://s3.amazonaws.com/ocr/bom_add_page1.jpg"
        }
      ]
    }
  ]
}
```

**⚡ Đặc điểm:**
- STAFF có toàn quyền thêm file vào bundle
- `documentType` **OPTIONAL** - tự động detect từ tên file
- **Tự động chạy OCR** ngay sau khi upload
- Bundle status chuyển về `OCR_PROCESSING`
- Có thể thêm bất kỳ lúc nào (trước hoặc sau khi tạo C/O)

**Response:**
```json
{
  "success": true,
  "message": "Đã bổ sung 1 chứng từ và khởi chạy OCR",
  "data": {
    "bundle": {
      "_id": "673f8a1b2c3d4e5f6a7b8c9d",
      "bundleName": "Lô hàng xuất khẩu tháng 11",
      "status": "OCR_PROCESSING",
      "documentCount": 4
    },
    "addedDocuments": [
      {
        "_id": "673fac3d4e5f6a7b8c9d0e20",
        "fileName": "BOM_Additional.xlsx",
        "documentType": "BOM",
        "status": "OCR_PROCESSING",
        "ocrJobId": "ocr_job_12345"
      }
    ],
    "warnings": [
      {
        "fileName": "BOM_Additional.xlsx",
        "detectedType": "BOM",
        "message": "Đã tự động xác định loại chứng từ"
      }
    ]
  }
}
```

**CURL Example:**
```bash
curl -X POST http://localhost:3000/api/v1/review/documents/673f8a1b2c3d4e5f6a7b8c9d/add \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "fileName": "BOM_Additional.xlsx",
        "storagePath": "https://s3.amazonaws.com/texco/bom_add.xlsx",
        "note": "BOM bổ sung",
        "ocrPages": [
          {
            "page": 1,
            "ocrStoragePath": "https://s3.amazonaws.com/texco/ocr/bom_add_p1.jpg"
          }
        ]
      }
    ]
  }'
```

---

#### 4.5. ⚡ STAFF - Sửa/Cập nhật file trong bundle
```
PUT /api/v1/review/documents/:bundleId/documents/:documentId
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "fileName": "BOM_Products_Updated.xlsx",
  "storagePath": "https://s3.amazonaws.com/texco/bom_updated.xlsx",
  "note": "Cập nhật BOM mới nhất",
  "documentType": "BOM",
  "ocrPages": [
    {
      "page": 1,
      "ocrStoragePath": "https://s3.amazonaws.com/texco/ocr/bom_updated_p1.jpg"
    }
  ]
}
```

**⚡ Đặc điểm:**
- STAFF có toàn quyền sửa file trong bundle
- Có thể thay đổi: fileName, storagePath, note, documentType, ocrPages
- **Tự động chạy OCR lại** sau khi cập nhật
- Document status chuyển về `OCR_PROCESSING`
- **Tất cả field đều optional** - chỉ cập nhật field được gửi lên

**Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "message": "Đã cập nhật chứng từ và khởi chạy OCR",
  "data": {
    "document": {
      "_id": "673f8a1b2c3d4e5f6a7b8c9f",
      "fileName": "BOM_Products_Updated.xlsx",
      "documentType": "BOM",
      "status": "OCR_PROCESSING",
      "updatedAt": "2024-11-09T17:00:00.000Z"
    }
  }
}
```

**CURL Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/review/documents/673f8a1b2c3d4e5f6a7b8c9d/documents/673f8a1b2c3d4e5f6a7b8c9f \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "BOM_Products_Updated.xlsx",
    "storagePath": "https://s3.amazonaws.com/texco/bom_updated.xlsx",
    "note": "Cập nhật BOM mới nhất",
    "ocrPages": [
      {
        "page": 1,
        "ocrStoragePath": "https://s3.amazonaws.com/texco/ocr/bom_updated_p1.jpg"
      }
    ]
  }'
```

---

#### 4.6. ⚡ STAFF - Xoá file khỏi bundle
```
DELETE /api/v1/review/documents/:bundleId/documents/:documentId
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`

**⚡ Đặc điểm:**
- STAFF có toàn quyền xoá file khỏi bundle
- Xoá vĩnh viễn, không thể khôi phục
- Cập nhật lại `documentCount` của bundle

**Response:**
```json
{
  "success": true,
  "message": "Đã xoá chứng từ khỏi bundle",
  "data": {
    "bundle": {
      "_id": "673f8a1b2c3d4e5f6a7b8c9d",
      "documentCount": 2
    },
    "deletedDocumentId": "673f8a1b2c3d4e5f6a7b8c9f"
  }
}
```

**CURL Example:**
```bash
curl -X DELETE http://localhost:3000/api/v1/review/documents/673f8a1b2c3d4e5f6a7b8c9d/documents/673f8a1b2c3d4e5f6a7b8c9f \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

#### 4.7. ⚡ STAFF - Retry OCR khi lỗi
```
PUT /api/v1/review/documents/:bundleId/ocr-retry
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "documentIds": ["673fac3d4e5f6a7b8c9d0e20"]
}
```

**⚡ Đặc điểm:**
- Retry OCR cho các documents bị lỗi
- Có thể retry từng document hoặc toàn bộ bundle
- Nếu không truyền `documentIds` → Retry tất cả documents lỗi trong bundle

**Response:**
```json
{
  "success": true,
  "message": "Đã khởi chạy lại OCR cho 1 chứng từ",
  "data": {
    "bundle": {
      "_id": "673f8a1b2c3d4e5f6a7b8c9d",
      "status": "OCR_PROCESSING"
    },
    "retriedDocuments": [
      {
        "_id": "673fac3d4e5f6a7b8c9d0e20",
        "fileName": "BOM_Additional.xlsx",
        "status": "OCR_PROCESSING",
        "retryCount": 1
      }
    ]
  }
}
```

**CURL Example:**
```bash
# Retry document cụ thể
curl -X PUT http://localhost:3000/api/v1/review/documents/673f8a1b2c3d4e5f6a7b8c9d/ocr-retry \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["673fac3d4e5f6a7b8c9d0e20"]
  }'

# Retry tất cả documents lỗi
curl -X PUT http://localhost:3000/api/v1/review/documents/673f8a1b2c3d4e5f6a7b8c9d/ocr-retry \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

### BƯỚC 4: CHỌN FORM VÀ TIÊU CHÍ

#### 4.8. ⚡ STAFF - Chọn Form E/B và Tiêu chí (Bước 2)
```
PUT /api/v1/co/lohang/:lohangDraftId/setup
```
**Role:** STAFF  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "formType": "FORM_E",
  "exchangeRate": 24500,
  "criterionType": "CTC"
}
```

**⚡ Đặc điểm:**
- Sau khi upload bổ sung xong (hoặc không cần upload)
- STAFF chọn Form E hoặc Form B
- Chọn tiêu chí: CTC, CTSH, RVC40, RVC45
- Nhập tỷ giá
- Hệ thống bắt đầu trích xuất dữ liệu từ documents
- Tạo sku_drafts và lưu BOM vào raw_bom_data
- Status chuyển sang DATA_EXTRACTING

**Response:**
```json
{
  "success": true,
  "message": "Đã cập nhật cấu hình và bắt đầu trích xuất dữ liệu",
  "data": {
    "_id": "673fac3d4e5f6a7b8c9d0e1f",
    "formType": "FORM_E",
    "exchangeRate": 24500,
    "criterionType": "CTC",
    "status": "DATA_EXTRACTING",
    "totalSkuCount": 3
  }
}
```

**CURL Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/co/lohang/673fac3d4e5f6a7b8c9d0e1f/setup \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "formType": "FORM_E",
    "exchangeRate": 24500,
    "criterionType": "CTC"
  }'
```

# TÀI LIỆU API - BẢNG TỔNG HỢP DỮ LIỆU (EXTRACTED TABLES)

## TỔNG QUAN

Sau khi nhân viên chọn **Form E/B** và **Tiêu chí** (CTC, RVC40, etc.), hệ thống sẽ tự động:

1. **Trích xuất dữ liệu** từ 4 loại file chính bằng AI:
   - Hóa đơn thương mại (Commercial Invoice)
   - Tờ khai xuất khẩu (Export Declaration)
   - Hóa đơn GTGT (VAT Invoice)
   - Bảng định mức (BOM)

2. **Tổng hợp dữ liệu** thành 3 bảng:
   - **Bảng Tổng hợp Sản phẩm Xuất khẩu** (Giai đoạn 1)
   - **Bảng Nhập kho NPL** (Giai đoạn 2)
   - **Bảng Định mức** (Giai đoạn 3)

3. **Lưu vào DB** để nhân viên có thể:
   - Xem và phân tích
   - Chỉnh sửa nếu cần
   - Xác nhận trước khi tính toán

---

## LUỒNG SỬ DỤNG

### BƯỚC 1: Chọn Form và Tiêu chí

```http
PUT /api/v1/co/lohang/:lohangDraftId/setup
```

**Request Body:**
```json
{
  "formType": "FORM_E",
  "exchangeRate": 24500,
  "criterionType": "CTC"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã cập nhật cấu hình thành công",
  "data": {
    "_id": "673fac3d4e5f6a7b8c9d0e1f",
    "formType": "FORM_E",
    "exchangeRate": 24500,
    "criterionType": "CTC",
    "status": "SETUP_COMPLETED",
    "totalSkuCount": 0
  }
}
```

**Lưu ý:** 
- API này CHỈ lưu cấu hình, KHÔNG trích xuất dữ liệu
- Status sẽ là `SETUP_COMPLETED`
- Nhân viên cần bấm nút "Tiếp tục" để trigger extraction

---

### BƯỚC 2: Trigger Trích xuất và Tổng hợp (Khi bấm "Tiếp tục")

```http
POST /api/v1/co/lohang/:lohangDraftId/extract-tables
```

**Response:**
```json
{
  "success": true,
  "message": "Đã bắt đầu trích xuất và tổng hợp dữ liệu",
  "data": {
    "_id": "673fac3d4e5f6a7b8c9d0e1f",
    "status": "DATA_EXTRACTING"
  }
}
```

**Lưu ý:** 
- Sau khi gọi API này, hệ thống sẽ chạy **async** để trích xuất dữ liệu
- Status sẽ chuyển từ `DATA_EXTRACTING` → `DRAFT` khi hoàn thành
- Có thể mất 30-60 giây tùy vào số lượng file

---

### BƯỚC 3: Kiểm tra tiến độ

```http
GET /api/v1/co/lohang/:lohangDraftId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lohangDraft": {
      "_id": "673fac3d4e5f6a7b8c9d0e1f",
      "status": "DRAFT",
      "totalSkuCount": 3
    }
  }
}
```

**Status:**
- `SETUP_COMPLETED`: Đã setup form, chờ trigger extraction
- `DATA_EXTRACTING`: Đang trích xuất dữ liệu (async)
- `DRAFT`: Trích xuất thành công, sẵn sàng để xem/sửa
- `EXTRACTION_FAILED`: Trích xuất thất bại, cần retry

---

### BƯỚC 3.1: Xử lý lỗi và Retry

#### **Khi extraction thất bại:**

```http
GET /api/v1/co/lohang/:lohangDraftId
```

**Response (có lỗi):**
```json
{
  "success": true,
  "data": {
    "lohangDraft": {
      "_id": "673fac3d4e5f6a7b8c9d0e1f",
      "status": "EXTRACTION_FAILED",
      "totalSkuCount": 0,
      "extractionErrors": [
        {
          "step": "EXTRACT_PRODUCT_TABLE",
          "error": "Không thể parse JSON từ Gemini response",
          "details": "Error: Expected double-quoted property name...",
          "timestamp": "2025-11-11T12:25:30.000Z"
        },
        {
          "step": "EXTRACT_BOM_TABLE",
          "error": "Lỗi trích xuất dữ liệu: Không thể parse JSON",
          "details": "Error: ...",
          "timestamp": "2025-11-11T12:25:35.000Z"
        }
      ]
    }
  }
}
```

#### **Retry Extraction:**

```http
POST /api/v1/co/lohang/:lohangDraftId/retry-extraction
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "673fac3d4e5f6a7b8c9d0e1f",
    "status": "DATA_EXTRACTING",
    "message": "Đang retry trích xuất dữ liệu"
  }
}
```

**Lưu ý:**
- Chỉ có thể retry khi `status === "EXTRACTION_FAILED"`
- Sau khi retry, hệ thống sẽ reset `extractionErrors` và chạy lại extraction
- FE nên polling để kiểm tra status sau khi retry

#### **Hiển thị lỗi trên FE:**

```javascript
// Kiểm tra status
if (lohangDraft.status === 'EXTRACTION_FAILED') {
  // Hiển thị thông báo lỗi
  const errorMessages = lohangDraft.extractionErrors.map(err => {
    const stepName = {
      'EXTRACT_PRODUCT_TABLE': 'Bảng Sản phẩm Xuất khẩu',
      'EXTRACT_NPL_TABLE': 'Bảng Nhập kho NPL',
      'EXTRACT_BOM_TABLE': 'Bảng Định mức BOM'
    }[err.step] || err.step;
    
    return `${stepName}: ${err.error}`;
  });
  
  // Show alert với nút Retry
  showAlert({
    title: 'Trích xuất dữ liệu thất bại',
    messages: errorMessages,
    actions: [
      { label: 'Retry', onClick: () => retryExtraction(lohangDraftId) },
      { label: 'Xem chi tiết', onClick: () => showErrorDetails(lohangDraft.extractionErrors) }
    ]
  });
}
```

#### **Các loại lỗi thường gặp:**

| Step | Lỗi | Nguyên nhân | Giải pháp |
|------|-----|-------------|-----------|
| `EXTRACT_PRODUCT_TABLE` | Không thể parse JSON | AI trả về JSON không hợp lệ | Retry, AI sẽ tạo lại |
| `EXTRACT_PRODUCT_TABLE` | HS Code missing | OCR không đọc được HS Code | Nhân viên sửa sau khi extract |
| `EXTRACT_NPL_TABLE` | Unit rỗng | OCR không đọc được đơn vị | Hệ thống tự động gợi ý |
| `EXTRACT_BOM_TABLE` | Lỗi parse JSON | BOM format phức tạp | Retry hoặc sửa thủ công |

---

### BƯỚC 3.2: Re-extract bảng cụ thể với User Note

Khi một bảng bị sai (VD: thiếu sản phẩm, sai HS Code, sai định mức), user có thể:
1. **Thêm ghi chú** mô tả vấn đề
2. **Yêu cầu AI phân tích lại** chỉ bảng đó (không ảnh hưởng bảng khác)

#### **API Re-extract Table:**

```http
POST /api/v1/co/lohang/:lohangDraftId/re-extract-table
```

**Request Body:**
```json
{
  "tableType": "PRODUCT",
  "userNote": "Thiếu sản phẩm SKU-5022066 (Wooden Chair) trong Invoice, vui lòng kiểm tra lại và thêm vào"
}
```

**Các giá trị `tableType`:**
- `PRODUCT` - Bảng Sản phẩm Xuất khẩu
- `NPL` - Bảng Nhập kho NPL
- `BOM` - Bảng Định mức

**Response:**
```json
{
  "success": true,
  "data": {
    "tableType": "PRODUCT",
    "status": "SUCCESS",
    "message": "Đã re-extract bảng Sản phẩm thành công",
    "totalProducts": 8
  }
}
```

#### **Ví dụ User Notes:**

**1. Bảng Sản phẩm thiếu item:**
```json
{
  "tableType": "PRODUCT",
  "userNote": "Thiếu sản phẩm 'Wooden Dining Table' (SKU: 5022070) ở trang 2 của Invoice. Vui lòng thêm vào với HS Code 94036090"
}
```

**2. Bảng NPL sai đơn vị:**
```json
{
  "tableType": "NPL",
  "userNote": "Ván MDF 4.75mm có đơn vị là 'M3' chứ không phải 'Tấm'. Vui lòng sửa lại tất cả các loại ván thành đơn vị M3"
}
```

**3. Bảng BOM sai định mức:**
```json
{
  "tableType": "BOM",
  "userNote": "Định mức Ván MDF cho SKU-5022064 là 0.028 M3/cái chứ không phải 0.28. Vui lòng kiểm tra lại các định mức, có vẻ bị nhầm dấu thập phân"
}
```

#### **Workflow với User Note:**

```javascript
// 1. User xem bảng và phát hiện lỗi
const productTable = await getProductTable(lohangDraftId);
// → Phát hiện thiếu 1 sản phẩm

// 2. User thêm note và yêu cầu re-extract
await reExtractTable(lohangDraftId, {
  tableType: 'PRODUCT',
  userNote: 'Thiếu sản phẩm SKU-5022066 ở trang 2 Invoice'
});

// 3. AI nhận note và phân tích lại
// → AI sẽ chú ý đặc biệt đến trang 2 và SKU-5022066
// → Kết quả mới sẽ bao gồm sản phẩm bị thiếu

// 4. User kiểm tra lại
const updatedTable = await getProductTable(lohangDraftId);
// → Đã có đủ 8 sản phẩm ✅
```

#### **Lợi ích:**

1. ✅ **Không cần re-extract toàn bộ** - Chỉ extract lại bảng bị lỗi
2. ✅ **AI hiểu context** - User note giúp AI biết chính xác vấn đề
3. ✅ **Tiết kiệm thời gian** - Không ảnh hưởng các bảng đã đúng
4. ✅ **Lưu lại note** - Ghi chú được lưu vào DB để audit

---

### BƯỚC 4: Lấy dữ liệu đã tổng hợp
- `DATA_EXTRACTING`: Đang trích xuất dữ liệu
- `DRAFT`: Đã hoàn thành trích xuất, chờ xem và chỉnh sửa
- `EXTRACTION_FAILED`: Lỗi khi trích xuất

---

### BƯỚC 4: Xem tất cả bảng tổng hợp

```http
GET /api/v1/co/lohang/:lohangDraftId/tables
```

**Response:**
```json
{
  "success": true,
  "message": "Lấy tất cả bảng tổng hợp thành công",
  "data": {
    "productTable": {
      "_id": "...",
      "lohangDraftId": "673fac3d4e5f6a7b8c9d0e1f",
      "status": "EXTRACTED",
      "products": [...],
      "totalProducts": 3,
      "totalFobValueUsd": 5436.34,
      "aiConfidence": 92
    },
    "nplTable": {
      "_id": "...",
      "lohangDraftId": "673fac3d4e5f6a7b8c9d0e1f",
      "status": "EXTRACTED",
      "materials": [...],
      "totalMaterials": 15,
      "totalValueVnd": 125000000,
      "aiConfidence": 88
    },
    "bomTable": {
      "_id": "...",
      "lohangDraftId": "673fac3d4e5f6a7b8c9d0e1f",
      "status": "EXTRACTED",
      "bomData": [...],
      "totalMaterials": 12,
      "totalSkus": 3,
      "aiConfidence": 90
    },
    "hasProductTable": true,
    "hasNplTable": true,
    "hasBomTable": true
  }
}
```

---

## CHI TIẾT CÁC BẢNG

### 1. BẢNG TỔNG HỢP SẢN PHẨM XUẤT KHẨU

#### Lấy bảng sản phẩm

```http
GET /api/v1/co/lohang/:lohangDraftId/tables/products
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "lohangDraftId": "673fac3d4e5f6a7b8c9d0e1f",
    "bundleId": "673f8a1b2c3d4e5f6a7b8c9d",
    "status": "EXTRACTED",
    "products": [
      {
        "stt": 1,
        "skuCode": "5022064",
        "productName": "24\" Vanity Cabinet",
        "hsCode": "94036090",
        "quantity": 14.00,
        "unit": "PCS",
        "unitPriceUsd": 134.71,
        "fobValueUsd": 1885.94,
        "exchangeRate": 26005,
        "fobValueVnd": 49039427.70,
        "sourceInvoiceId": "...",
        "sourceDeclarationId": "...",
        "isEdited": false,
        "editedFields": [],
        "editHistory": []
      },
      {
        "stt": 2,
        "skuCode": "5022065",
        "productName": "30\" Vanity Cabinet",
        "hsCode": "94036090",
        "quantity": 16.00,
        "unit": "PCS",
        "unitPriceUsd": 159.40,
        "fobValueUsd": 2550.40,
        "exchangeRate": 26005,
        "fobValueVnd": 66334772.00,
        "sourceInvoiceId": "...",
        "sourceDeclarationId": "...",
        "isEdited": false,
        "editedFields": [],
        "editHistory": []
      }
    ],
    "totalProducts": 2,
    "totalQuantity": 30,
    "totalFobValueUsd": 4436.34,
    "totalFobValueVnd": 115374199.70,
    "aiConfidence": 92,
    "aiModel": "gemini-2.5-flash",
    "aiVersion": "1.0.0",
    "warnings": [],
    "extractedAt": "2024-11-11T04:30:00.000Z",
    "updatedAt": "2024-11-11T04:30:00.000Z"
  }
}
```

#### Cập nhật 1 sản phẩm

```http
PUT /api/v1/co/lohang/:lohangDraftId/tables/products/:productIndex
```

**Request Body:**
```json
{
  "skuCode": "5022064-UPDATED",
  "productName": "24\" Vanity Cabinet - White",
  "quantity": 15.00,
  "unitPriceUsd": 135.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cập nhật sản phẩm thành công",
  "data": {
    "status": "EDITED",
    "products": [
      {
        "stt": 1,
        "skuCode": "5022064-UPDATED",
        "productName": "24\" Vanity Cabinet - White",
        "quantity": 15.00,
        "unitPriceUsd": 135.00,
        "isEdited": true,
        "editedFields": ["skuCode", "productName", "quantity", "unitPriceUsd"],
        "editHistory": [
          {
            "editedAt": "2024-11-11T05:00:00.000Z",
            "editedBy": "690...",
            "fieldName": "quantity",
            "oldValue": "14",
            "newValue": "15"
          }
        ]
      }
    ]
  }
}
```

---

### 2. BẢNG NHẬP KHO NPL

#### Lấy bảng NPL

```http
GET /api/v1/co/lohang/:lohangDraftId/tables/npl
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "lohangDraftId": "673fac3d4e5f6a7b8c9d0e1f",
    "status": "EXTRACTED",
    "materials": [
      {
        "stt": 1,
        "nplCode": "VanMDF",
        "nplName": "Ván MDF 4.75mm",
        "hsCode": "44111400",
        "invoiceNo": "00000197",
        "invoiceDate": "2025-06-30T00:00:00.000Z",
        "quantityImported": 13.5741,
        "unit": "M3",
        "unitPriceVnd": 6375000,
        "totalValueVnd": 86534887.50,
        "originCountry": "MUA VN KRXX",
        "supplierName": "Công ty TNHH ABC",
        "sourceVatInvoiceId": "...",
        "isEdited": false,
        "editedFields": [],
        "editHistory": []
      }
    ],
    "totalMaterials": 1,
    "totalQuantity": 13.5741,
    "totalValueVnd": 86534887.50,
    "aiConfidence": 88,
    "aiModel": "gemini-2.5-flash",
    "aiVersion": "1.0.0"
  }
}
```

#### Cập nhật 1 NPL

```http
PUT /api/v1/co/lohang/:lohangDraftId/tables/npl/:nplIndex
```

**Request Body:**
```json
{
  "nplName": "Ván MDF 4.75mm - Grade A",
  "quantityImported": 14.00,
  "unitPriceVnd": 6400000
}
```

---

### 3. BẢNG ĐỊNH MỨC (BOM)

#### Lấy bảng BOM

```http
GET /api/v1/co/lohang/:lohangDraftId/tables/bom
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "lohangDraftId": "673fac3d4e5f6a7b8c9d0e1f",
    "status": "EXTRACTED",
    "bomData": [
      {
        "stt": 1,
        "nplCode": "VanMDF",
        "nplName": "Ván MDF 4.75mm",
        "hsCode": "44111400",
        "unit": "M3",
        "normPerSku": {
          "5022064": 0.027243883,
          "5022065": 0.033040253
        },
        "sourceBomId": "...",
        "isEdited": false,
        "editedFields": [],
        "editHistory": []
      },
      {
        "stt": 2,
        "nplCode": "GoCaoSu",
        "nplName": "Gỗ cao su ghép",
        "hsCode": "44072997",
        "unit": "M3",
        "normPerSku": {
          "5022064": 0.00240786,
          "5022065": 0.00266626
        },
        "sourceBomId": "...",
        "isEdited": false,
        "editedFields": [],
        "editHistory": []
      }
    ],
    "skuList": [
      {
        "skuCode": "5022064",
        "productName": "24\" Vanity Cabinet"
      },
      {
        "skuCode": "5022065",
        "productName": "30\" Vanity Cabinet"
      }
    ],
    "totalMaterials": 2,
    "totalSkus": 2,
    "aiConfidence": 90
  }
}
```

#### Cập nhật định mức trong BOM

```http
PUT /api/v1/co/lohang/:lohangDraftId/tables/bom/:bomIndex
```

**Request Body:**
```json
{
  "nplName": "Ván MDF 4.75mm - Updated",
  "normPerSku": {
    "5022064": 0.028000000,
    "5022065": 0.034000000
  }
}
```

---

### 4. XÁC NHẬN TẤT CẢ BẢNG

Sau khi xem và chỉnh sửa xong, nhân viên xác nhận tất cả bảng:

```http
PUT /api/v1/co/lohang/:lohangDraftId/tables/confirm
```

**Response:**
```json
{
  "success": true,
  "message": "Đã xác nhận tất cả bảng tổng hợp",
  "data": {
    "productTableConfirmed": true,
    "nplTableConfirmed": true,
    "bomTableConfirmed": true
  }
}
```

**Lưu ý:**
- Sau khi confirm, status của các bảng sẽ chuyển từ `EXTRACTED` hoặc `EDITED` → `CONFIRMED`
- Có thể tiếp tục chỉnh sửa sau khi confirm (status sẽ quay lại `EDITED`)

---

## LUỒNG HOÀN CHỈNH

```
1. POST /co/create
   → Tạo C/O draft từ bundle

2. POST /review/documents/:bundleId/add (optional)
   → Upload bổ sung file nếu cần

3. PUT /co/lohang/:id/setup
   → Chọn Form E/B + Tiêu chí
   → CHỈ lưu cấu hình, status = SETUP_COMPLETED

4. POST /co/lohang/:id/extract-tables
   → Nhân viên bấm "Tiếp tục"
   → **AI bắt đầu trích xuất dữ liệu và tạo 3 bảng tổng hợp**
   → Status = DATA_EXTRACTING → DRAFT (thành công)
   → Status = DATA_EXTRACTING → EXTRACTION_FAILED (có lỗi)

4.1. POST /co/lohang/:id/retry-extraction (nếu có lỗi)
   → Retry extraction khi status = EXTRACTION_FAILED
   → Reset errors và chạy lại extraction
   → Status = DATA_EXTRACTING → DRAFT hoặc EXTRACTION_FAILED

5. GET /co/lohang/:id/tables
   → Xem tất cả bảng tổng hợp

6. PUT /co/lohang/:id/tables/products/:index (optional)
   → Chỉnh sửa sản phẩm nếu cần

7. PUT /co/lohang/:id/tables/npl/:index (optional)
   → Chỉnh sửa NPL nếu cần

8. PUT /co/lohang/:id/tables/bom/:index (optional)
   → Chỉnh sửa định mức nếu cần

9. PUT /co/lohang/:id/tables/confirm
   → Xác nhận tất cả bảng

10. PUT /co/lohang/:id/confirm
    → Xác nhận dữ liệu trước khi tính toán

11. POST /co/calculate/:id
    → Bắt đầu tính toán FIFO

12. GET /co/export/:id?skuCode=xxx
    → Xuất Excel bảng kê
```

---

## TÍNH NĂNG NỔI BẬT

### 1. AI Training để Extract Data Chính Xác

- Sử dụng **Gemini 2.5 Flash** với prompt được tối ưu cho từng loại file
- Độ tin cậy (confidence) được tính toán và hiển thị
- Tự động đồng bộ thông tin giữa các chứng từ (Invoice + Tờ khai)

### 2. Edit History (Lịch sử chỉnh sửa)

Mỗi lần chỉnh sửa đều được ghi lại:
```json
{
  "editHistory": [
    {
      "editedAt": "2024-11-11T05:00:00.000Z",
      "editedBy": "690abc123",
      "fieldName": "quantity",
      "oldValue": "14",
      "newValue": "15"
    }
  ]
}
```

### 3. Tự động tính lại tổng

Khi chỉnh sửa, hệ thống tự động tính lại:
- `totalQuantity`
- `totalFobValueUsd`
- `totalFobValueVnd`
- `totalValueVnd`

### 4. Status Tracking

Mỗi bảng có status riêng:
- `EXTRACTED`: Vừa được AI trích xuất
- `EDITED`: Đã được nhân viên chỉnh sửa
- `CONFIRMED`: Đã được xác nhận

---

## LƯU Ý QUAN TRỌNG

1. **AI Confidence**: Nếu độ tin cậy < 80%, nên kiểm tra kỹ dữ liệu
2. **Edit History**: Không thể xóa lịch sử chỉnh sửa
3. **Index**: Bắt đầu từ 0 (productIndex=0 là sản phẩm đầu tiên)
4. **Async Processing**: Trích xuất dữ liệu chạy async, cần kiểm tra status
5. **Map Type**: `normPerSku` trong BOM là Map, cần convert khi gửi lên

---

## ERROR CODES

| Code | Message | Giải pháp |
|------|---------|-----------|
| 404 | Chưa có bảng tổng hợp | Chờ AI extraction hoàn thành |
| 400 | Index không hợp lệ | Kiểm tra lại index (0-based) |
| 500 | Lỗi trích xuất dữ liệu | Kiểm tra OCR data và retry |

---

## CURL EXAMPLES

### Lấy tất cả bảng
```bash
curl -X GET http://localhost:3000/api/v1/co/lohang/673fac3d4e5f6a7b8c9d0e1f/tables \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Cập nhật sản phẩm
```bash
curl -X PUT http://localhost:3000/api/v1/co/lohang/673fac3d4e5f6a7b8c9d0e1f/tables/products/0 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 15.00,
    "unitPriceUsd": 135.00
  }'
```

### Xác nhận tất cả bảng
```bash
curl -X PUT http://localhost:3000/api/v1/co/lohang/673fac3d4e5f6a7b8c9d0e1f/tables/confirm \
  -H "Authorization: Bearer YOUR_TOKEN"
```

