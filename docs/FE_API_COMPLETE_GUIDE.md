# API Guide - Quản Lý Hồ Sơ C/O - Chi Tiết Đầy Đủ

## Base Configuration
```javascript
const API_BASE = 'http://localhost:3000/api/v1';
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

---

## 1. Danh Sách Hồ Sơ C/O

**GET** `/co-applications?page=1&limit=10&status=DRAFT`

```javascript
const listCoApplications = async (page = 1, limit = 10, filters = {}) => {
  const params = new URLSearchParams({
    page,
    limit,
    ...filters // status, formType, search
  });
  
  const response = await fetch(`${API_BASE}/co-applications?${params}`, {
    headers
  });
  
  return response.json();
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [{
      "_id": "...",
      "companyId": { "name": "...", "taxCode": "..." },
      "staffUser": { "fullName": "...", "role": "STAFF" },
      "status": "DRAFT",
      "formType": null,
      "ocrStatus": "COMPLETED",
      "linkedDocumentsCount": 5
    }],
    "pagination": { "total": 15, "page": 1, "totalPages": 2 }
  }
}
```

---

## 2. Chi Tiết Hồ Sơ

**GET** `/co-applications/:id`

```javascript
const getCoDetail = async (coId) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}`, {
    headers
  });
  
  return response.json();
};
```

**Response có linkedDocuments với uploadedBy:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "linkedDocuments": [{
      "fileName": "HopDong.pdf",
      "uploadedBy": {
        "fullName": "Trần Văn B",
        "role": "SUPPLIER"
      },
      "coApplicationId": null,
      "status": "OCR_COMPLETED"
    }]
  }
}
```

---

## 3. Load Bộ Chứng Từ

**GET** `/co-bundles?page=1&limit=10`

```javascript
const loadBundles = async () => {
  const response = await fetch(`${API_BASE}/co-bundles?page=1&limit=50`, {
    headers
  });
  
  return response.json();
};
```

---

## 4. Tạo C/O Mới

**POST** `/co-applications`

```javascript
const createCo = async (bundleId) => {
  const response = await fetch(`${API_BASE}/co-applications`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ bundleId })
  });
  
  return response.json();
};
```

---

## 5. Upload Bổ Sung + OCR

**POST** `/co-applications/:id/upload-ocr`

```javascript
const uploadDocuments = async (coId, documents) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}/upload-ocr`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ documents })
  });
  
  return response.json();
};

// Example documents array
const documents = [
  {
    fileName: "ToKhaiXK.pdf",
    storagePath: "https://cloudinary.com/...",
    documentType: "EXPORT_DECLARATION",
    note: "Tờ khai xuất khẩu",
    ocrPages: [{
      page: 1,
      ocrStoragePath: "https://cloudinary.com/ocr/page1.png",
      mimeType: "image/png"
    }]
  }
];
```

**Document Types:**
- EXPORT_DECLARATION
- COMMERCIAL_INVOICE
- BOM
- BILL_OF_LADING
- VAT_INVOICE
- IMPORT_DECLARATION
- PURCHASE_LIST
- NPL_ORIGIN_CERT
- OTHER

---

## 6. Check OCR Status (Poll mỗi 3-5s)

**GET** `/co-applications/:id/ocr-status`

```javascript
const checkOcrStatus = async (coId) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}/ocr-status`, {
    headers
  });
  
  return response.json();
};

// Polling example
const pollOcrStatus = async (coId) => {
  const interval = setInterval(async () => {
    const { data } = await checkOcrStatus(coId);
    
    if (data.ocrStatus === 'COMPLETED') {
      clearInterval(interval);
      console.log('OCR hoàn thành!');
    } else if (data.ocrStatus === 'FAILED') {
      clearInterval(interval);
      console.log('OCR lỗi:', data.failedDocuments);
    }
  }, 3000);
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ocrStatus": "PROCESSING",
    "total": 6,
    "processing": 2,
    "completed": 4,
    "failed": 0,
    "failedDocuments": []
  }
}
```

---

## 7. Retry OCR

**POST** `/co-applications/:id/retry-ocr`

```javascript
const retryOcr = async (coId, documentId) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}/retry-ocr`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ documentId })
  });
  
  return response.json();
};
```

---

## 8. Chọn Loại Form

**POST** `/co-applications/:id/select-form-type`

```javascript
const selectFormType = async (coId, formType) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}/select-form-type`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ formType }) // "FORM_B" or "FORM_E"
  });
  
  return response.json();
};
```

---

## 9. FORM_B: Auto-fill

**POST** `/co-applications/:id/auto-fill-form-b`

```javascript
const autoFillFormB = async (coId) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}/auto-fill-form-b`, {
    method: 'POST',
    headers
  });
  
  return response.json();
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceNo": "131755",
    "exportDeclarationNo": "307569909999",
    "consigneeInfo": "NPK GROUP, INC, USA",
    "transportInfo": "BY SEA, EVER MATCH V.1315E"
  }
}
```

**Sau bước này với FORM_B → Chuyển thẳng sang Export PDF (bước 15)**

---

## 10. FORM_E: AI Tra Cứu Luật

**POST** `/co-applications/:id/ai-lookup-rules`

```javascript
const aiLookupRules = async (coId) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}/ai-lookup-rules`, {
    method: 'POST',
    headers
  });
  
  return response.json();
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestedCriteria": "RVC40 HOẶC CTSH",
    "hsCode": "940360",
    "productName": "Tủ phòng tắm"
  }
}
```

---

## 11. FORM_E: Chọn Tiêu Chí

**POST** `/co-applications/:id/select-criteria`

```javascript
const selectCriteria = async (coId, criterion) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}/select-criteria`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ criterion }) // "CTSH", "CTC", "RVC40", etc.
  });
  
  return response.json();
};
```

**Criteria Options:**
- WO - Wholly Obtained
- CTC - Change in Tariff Classification
- CTSH - Change in Tariff Sub-Heading
- RVC40 - Regional Value Content 40%
- RVC50 - Regional Value Content 50%
- PE - Processing Exception

---

## 12. FORM_E: AI Tạo Bảng Kê (Có thể loop)

**POST** `/co-applications/:id/ai-generate-breakdown`

```javascript
const aiGenerateBreakdown = async (coId, correctionNotes = null) => {
  const body = correctionNotes ? { correctionNotes } : {};
  
  const response = await fetch(`${API_BASE}/co-applications/${coId}/ai-generate-breakdown`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  
  return response.json();
};

// Lần đầu
await aiGenerateBreakdown(coId);

// Có correction
await aiGenerateBreakdown(coId, "Thiếu NPL 'Vít', trị giá 'Chậu sứ' sai");
```

**Response:**
```json
{
  "success": true,
  "data": {
    "materialsBreakdown": [
      {
        "name": "Chậu sứ",
        "hsCode": "691010",
        "isOriginating": false,
        "value": 50000,
        "originCountry": "Trung Quốc",
        "sourceRef": "TK 107260069999"
      },
      {
        "name": "Gỗ MDF",
        "hsCode": "441112",
        "isOriginating": true,
        "value": 80000,
        "originCountry": "Việt Nam",
        "sourceRef": "HĐ VAT 00000197"
      }
    ],
    "logicCheck": {
      "pass": true,
      "message": "Đạt tiêu chí CTSH"
    }
  }
}
```

---

## 15. Export PDF Bảng Kê

**POST** `/co-applications/:id/export-pdf`

```javascript
const exportPdf = async (coId) => {
  const response = await fetch(`${API_BASE}/co-applications/${coId}/export-pdf`, {
    method: 'POST',
    headers
  });
  
  return response.json();
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pdfUrl": "https://cloudinary.com/BKE_CTSH_307569909999.pdf",
    "filename": "BKE_CTSH_307569909999.pdf"
  }
}
```

---

## Complete Workflow Examples

### FORM_B Flow:
```javascript
// 1. Load bundles
const bundles = await loadBundles();

// 2. Create C/O
const { data: { coApplication } } = await createCo(selectedBundleId);
const coId = coApplication._id;

// 3. Upload documents
await uploadDocuments(coId, documents);

// 4. Poll OCR status
await pollOcrStatus(coId);

// 5. Select FORM_B
await selectFormType(coId, 'FORM_B');

// 6. Auto-fill
await autoFillFormB(coId);

// 7. Export PDF
const { data: { pdfUrl } } = await exportPdf(coId);
```

### FORM_E Flow:
```javascript
// Steps 1-4 giống FORM_B

// 5. Select FORM_E
await selectFormType(coId, 'FORM_E');

// 6. AI lookup rules
const { data: { suggestedCriteria } } = await aiLookupRules(coId);

// 7. Select criteria
await selectCriteria(coId, 'CTSH');

// 8. AI generate breakdown (có thể loop)
let result = await aiGenerateBreakdown(coId);

// 9. Nếu cần correction
if (needCorrection) {
  result = await aiGenerateBreakdown(coId, correctionNotes);
}

// 10. Export PDF
const { data: { pdfUrl } } = await exportPdf(coId);
```

---

## Phân Biệt Document Source

```javascript
const getDocumentSource = (doc) => {
  if (doc.uploadedBy.role === 'SUPPLIER' && !doc.coApplicationId) {
    return 'NCC upload (từ bundle gốc)';
  }
  
  if (doc.uploadedBy.role === 'STAFF' && doc.coApplicationId) {
    return 'Staff C/O upload bổ sung';
  }
  
  return 'Unknown';
};
```

---

## Error Handling

```javascript
const apiCall = async (url, options) => {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'API Error');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
```
