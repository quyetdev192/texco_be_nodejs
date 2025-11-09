# Frontend Guide - Quản Lý Hồ Sơ C/O

Base URL: `http://localhost:3000/api/v1`
Auth: `Authorization: Bearer <token>`

---

## API List (Theo thứ tự workflow)

### 1. GET /co-applications - Danh sách hồ sơ
Query: page, limit, status, formType, search

### 2. GET /co-applications/:id - Chi tiết hồ sơ
Response có linkedDocuments với uploadedBy.role (SUPPLIER/STAFF)

### 3. GET /co-bundles - Load bộ chứng từ để tạo mới
Response: bundles (tất cả status), documentCount

### 4. POST /co-applications - Tạo C/O mới
Body: `{ bundleId }`

### 5. POST /co-applications/:id/upload-ocr - Upload bổ sung + OCR
Body: `{ documents: [{ fileName, storagePath, documentType, note, ocrPages }] }`
DocumentTypes: EXPORT_DECLARATION, COMMERCIAL_INVOICE, BOM, BILL_OF_LADING, VAT_INVOICE, IMPORT_DECLARATION, OTHER

### 6. GET /co-applications/:id/ocr-status - Check OCR
Response: `{ ocrStatus, total, processing, completed, failed, failedDocuments }`
Poll mỗi 3-5s sau upload

### 7. POST /co-applications/:id/retry-ocr - Retry OCR lỗi
Body: `{ documentId }`

### 8. POST /co-applications/:id/select-form-type - Chọn loại form
Body: `{ formType: "FORM_B" | "FORM_E" }`

### 9. POST /co-applications/:id/auto-fill-form-b - Auto-fill FORM_B
Chỉ dùng khi formType = FORM_B
Response: invoiceNo, exportDeclarationNo, consigneeInfo, transportInfo

### 10. POST /co-applications/:id/ai-lookup-rules - AI tra cứu luật (FORM_E)
Chỉ dùng khi formType = FORM_E
Response: suggestedCriteria, hsCode, productName

### 11. POST /co-applications/:id/select-criteria - Chọn tiêu chí (FORM_E)
Body: `{ criterion: "CTSH" | "CTC" | "RVC40" | "RVC50" | "WO" | "PE" }`

### 12. POST /co-applications/:id/ai-generate-breakdown - AI tạo bảng kê (FORM_E)
Body lần đầu: `{}`
Body có correction: `{ correctionNotes: "..." }`
Response: materialsBreakdown[], logicCheck
Có thể gọi nhiều lần với correctionNotes khác nhau

### 13. POST /co-applications/:id/match-rules - Legacy
Body: `{ formType }`

### 14. POST /co-applications/:id/apply-criterion - Legacy
Body: `{ criterion, reAnalyze }`

### 15. POST /co-applications/:id/export-pdf - Export PDF bảng kê
Response: `{ pdfUrl, filename }`

---

## Workflow FORM_B:
1→2→3→4→5→6→7(nếu lỗi)→8(FORM_B)→9→15

## Workflow FORM_E:
1→2→3→4→5→6→7(nếu lỗi)→8(FORM_E)→10→11→12(loop với corrections)→15

---

## Document Object Fields:
- uploadedBy: { role: "SUPPLIER" | "STAFF" }
- approvedBy: Staff C/O
- coApplicationId: null (bundle gốc) | ID (upload bổ sung)
- bundleId: Bundle gốc
- status: OCR_PROCESSING | OCR_COMPLETED | REJECTED
- ocrResult: Text OCR
- ocrPages: [{ page, ocrStoragePath, mimeType }]

## Phân biệt document:
```js
// NCC upload (từ bundle)
doc.uploadedBy.role === "SUPPLIER" && !doc.coApplicationId

// Staff upload bổ sung
doc.uploadedBy.role === "STAFF" && doc.coApplicationId
```
