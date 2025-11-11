# Excel Files - Skip OCR

## Vấn đề

Khi upload file Excel (BOM), hệ thống vẫn chạy OCR → **Lãng phí thời gian** vì Excel không cần OCR.

## Giải pháp

### 1. Auto-detect Excel files khi upload

```javascript
// Detect Excel file
const isExcelFile = d.storagePath && (
    d.storagePath.endsWith('.xlsx') || 
    d.storagePath.endsWith('.xls') ||
    d.storagePath.toLowerCase().includes('.xlsx') ||
    d.storagePath.toLowerCase().includes('.xls')
);
```

### 2. Set status = OCR_COMPLETED cho Excel

```javascript
let status = 'OCR_PROCESSING';
let ocrPages = [];

if (isExcelFile) {
    // File Excel không cần OCR
    status = 'OCR_COMPLETED';
    ocrPages = [];
    console.log(`✅ File Excel detected: ${d.fileName} - Skip OCR`);
} else {
    // File PDF/Image cần OCR
    ocrPages = Array.isArray(d.ocrPages)
        ? d.ocrPages.filter(p => p && p.ocrStoragePath)
        : [];

    if (ocrPages.length === 0) {
        failed.push({ index: idx, message: 'Thiếu ocrPages' });
        return;
    }
}
```

### 3. Skip OCR job cho Excel files

```javascript
// Khởi chạy OCR cho từng document mới (bỏ qua Excel files)
for (const doc of inserted) {
    if (doc.isExcelFile) {
        console.log(`⏭️ Skip OCR for Excel file: ${doc.fileName}`);
        continue;
    }
    setImmediate(() => startOcrJob(doc._id).catch(() => {}));
}
```

### 4. Thêm field `isExcelFile` vào Document model

```javascript
// src/api/models/document.model.js

ocrResult: { type: String, default: '' },
needsGeminiDetection: { type: Boolean, default: false },
isExcelFile: { type: Boolean, default: false }, // ✅ NEW
```

## Workflow

### NCC upload documents

```
1. NCC upload bundle (bao gồm BOM Excel)
   → POST /api/v1/documents/create

2. Detect Excel file:
   ✅ BOM.xlsx → isExcelFile = true
   ✅ status = 'PENDING_REVIEW'
   ✅ ocrPages = []

3. Staff approve bundle:
   ✅ Excel files → Skip OCR job
   ✅ PDF/Image files → Run OCR job
```

### Staff upload bổ sung

```
1. Staff upload BOM Excel bổ sung
   → POST /api/v1/review/documents/:bundleId/add

2. Detect Excel file:
   ✅ BOM.xlsx → isExcelFile = true
   ✅ status = 'OCR_COMPLETED' (không cần OCR)
   ✅ ocrPages = []

3. Auto-link to lohangDraft:
   ✅ Document linked
   ✅ Skip OCR job
```

## Code Changes

### 1. `document.handle.js` - supplierCreate

```javascript
// Line 169-191
const isExcelFile = d.storagePath && (
    d.storagePath.endsWith('.xlsx') || 
    d.storagePath.endsWith('.xls') ||
    d.storagePath.toLowerCase().includes('.xlsx') ||
    d.storagePath.toLowerCase().includes('.xls')
);

let ocrPages = [];

if (!isExcelFile) {
    // File PDF/Image cần OCR
    ocrPages = Array.isArray(d.ocrPages)
        ? d.ocrPages.filter(p => p && p.ocrStoragePath)
        : [];

    if (ocrPages.length === 0) {
        failed.push({ index: idx, message: 'Thiếu ocrPages' });
        return;
    }
} else {
    console.log(`✅ File Excel detected: ${d.fileName} - Skip OCR`);
}

docsToInsert.push({
    ...
    ocrPages: ocrPages,
    status: 'PENDING_REVIEW',
    isExcelFile: isExcelFile
});
```

### 2. `document.handle.js` - staffAddDocuments

```javascript
// Line 977-1003
const isExcelFile = d.storagePath && (
    d.storagePath.endsWith('.xlsx') || 
    d.storagePath.endsWith('.xls') ||
    d.storagePath.toLowerCase().includes('.xlsx') ||
    d.storagePath.toLowerCase().includes('.xls')
);

let status = 'OCR_PROCESSING';
let ocrPages = [];

if (isExcelFile) {
    // File Excel không cần OCR
    status = 'OCR_COMPLETED';
    ocrPages = [];
    console.log(`✅ File Excel detected: ${d.fileName} - Skip OCR`);
} else {
    // File PDF/Image cần OCR
    ocrPages = Array.isArray(d.ocrPages)
        ? d.ocrPages.filter(p => p && p.ocrStoragePath)
        : [];

    if (ocrPages.length === 0) {
        failed.push({ index: idx, message: 'Thiếu ocrPages' });
        return;
    }
}

docsToInsert.push({
    ...
    status: status, // OCR_COMPLETED cho Excel
    isExcelFile: isExcelFile
});
```

### 3. `document.handle.js` - Skip OCR job

```javascript
// Line 1098-1105
for (const doc of inserted) {
    if (doc.isExcelFile) {
        console.log(`⏭️ Skip OCR for Excel file: ${doc.fileName}`);
        continue;
    }
    setImmediate(() => startOcrJob(doc._id).catch(() => {}));
}
```

### 4. `document.model.js` - Add field

```javascript
// Line 42
isExcelFile: { type: Boolean, default: false },
```

## Benefits

- ⚡ **Nhanh hơn**: Không cần chờ OCR cho Excel files
- ✅ **Chính xác hơn**: Parse trực tiếp từ Excel (100% accuracy)
- 💰 **Tiết kiệm**: Không tốn resource cho OCR không cần thiết
- 🎯 **Tự động**: Detect và skip OCR tự động

## Testing

### Test case 1: NCC upload BOM Excel

```bash
POST /api/v1/documents/create
{
  "bundleName": "Test Bundle",
  "documents": [
    {
      "fileName": "BOM.xlsx",
      "storagePath": "https://s3.../BOM.xlsx",
      "documentType": "BOM"
      // Không cần ocrPages ✅
    }
  ]
}

# Expected:
✅ File Excel detected: BOM.xlsx - Skip OCR
✅ Document created with status: PENDING_REVIEW
✅ isExcelFile: true
```

### Test case 2: Staff upload BOM Excel bổ sung

```bash
POST /api/v1/review/documents/:bundleId/add
{
  "documents": [
    {
      "fileName": "BOM.xlsx",
      "storagePath": "https://s3.../BOM.xlsx",
      "documentType": "BOM"
      // Không cần ocrPages ✅
    }
  ]
}

# Expected:
✅ File Excel detected: BOM.xlsx - Skip OCR
✅ Document created with status: OCR_COMPLETED
✅ isExcelFile: true
⏭️ Skip OCR for Excel file: BOM.xlsx
```

### Test case 3: Upload mixed files

```bash
POST /api/v1/review/documents/:bundleId/add
{
  "documents": [
    {
      "fileName": "BOM.xlsx",
      "storagePath": "https://s3.../BOM.xlsx",
      "documentType": "BOM"
    },
    {
      "fileName": "Invoice.pdf",
      "storagePath": "https://s3.../Invoice.pdf",
      "documentType": "COMMERCIAL_INVOICE",
      "ocrPages": [...]
    }
  ]
}

# Expected:
✅ File Excel detected: BOM.xlsx - Skip OCR
✅ Invoice.pdf → Run OCR job
```

## Notes

- ✅ Excel files: `.xlsx`, `.xls`
- ✅ Case-insensitive detection
- ✅ Backward compatible (PDF/Image vẫn chạy OCR bình thường)
- ✅ Auto-link to lohangDraft vẫn hoạt động
