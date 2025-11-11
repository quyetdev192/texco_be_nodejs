# DOCUMENT TYPES - HƯỚNG DẪN CHO FRONTEND

## 📋 DANH SÁCH LOẠI TÀI LIỆU

### **Backend Document Types (CHÍNH XÁC)**

```javascript
// Từ model Document - Line 16-19
enum DocumentType {
  "VAT_INVOICE",           // Hóa đơn GTGT (NPL)
  "IMPORT_DECLARATION",    // Tờ khai nhập khẩu
  "PURCHASE_LIST",         // Danh sách mua hàng
  "NPL_ORIGIN_CERT",       // C/O xuất xứ NPL
  "EXPORT_DECLARATION",    // Tờ khai xuất khẩu
  "COMMERCIAL_INVOICE",    // Hóa đơn thương mại xuất khẩu
  "BILL_OF_LADING",        // Vận đơn
  "BOM"                    // Bảng định mức (Bill of Materials)
}
```

---

## 🎯 MAPPING CHO FRONTEND

### **1. Tài liệu BẮT BUỘC cho C/O Processing**

| Loại tài liệu | Document Type (BE) | Mô tả | Bắt buộc |
|--------------|-------------------|-------|----------|
| **Hóa đơn xuất khẩu** | `COMMERCIAL_INVOICE` | Invoice xuất khẩu (có danh sách sản phẩm) | ✅ BẮT BUỘC |
| **Tờ khai xuất khẩu** | `EXPORT_DECLARATION` | Tờ khai hải quan xuất khẩu | ⚠️ Tùy chọn |
| **Hóa đơn GTGT NPL** | `VAT_INVOICE` | Hóa đơn mua nguyên phụ liệu trong nước | ✅ BẮT BUỘC |
| **Bảng định mức** | `BOM` | Bảng định mức nguyên vật liệu | ✅ BẮT BUỘC |

### **2. Tài liệu BỔ SUNG (không bắt buộc)**

| Loại tài liệu | Document Type (BE) | Mô tả |
|--------------|-------------------|-------|
| Tờ khai nhập khẩu | `IMPORT_DECLARATION` | Tờ khai nhập NPL |
| Danh sách mua hàng | `PURCHASE_LIST` | Purchase list |
| C/O NPL | `NPL_ORIGIN_CERT` | Giấy chứng nhận xuất xứ NPL |
| Vận đơn | `BILL_OF_LADING` | B/L |

---

## 🔄 WORKFLOW XỬ LÝ TÀI LIỆU

### **Backend xử lý như sau:**

```javascript
// 1. Phân loại documents
const invoiceDoc = documents.find(d => 
  d.documentType === 'COMMERCIAL_INVOICE'
);

const declarationDoc = documents.find(d => 
  d.documentType === 'EXPORT_DECLARATION'
);

const vatInvoiceDocs = documents.filter(d => 
  d.documentType === 'VAT_INVOICE'
);

const bomDocs = documents.filter(d => 
  d.documentType === 'BOM'
);

// 2. Extract theo thứ tự
// GIAI ĐOẠN 1: Extract Product Table (từ COMMERCIAL_INVOICE)
// GIAI ĐOẠN 2: Extract NPL Table (từ VAT_INVOICE)
// GIAI ĐOẠN 3: Extract BOM Table (từ BOM)
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

### **1. Tên file vs Document Type**

❌ **SAI:**
```javascript
// FE đặt tên file: "Bảng định mức.pdf"
// Nhưng chọn type: "BILL_OF_MATERIALS" ← KHÔNG TỒN TẠI!
```

✅ **ĐÚNG:**
```javascript
// FE đặt tên file: "Bảng định mức.pdf"
// Chọn type: "BOM" ← CHÍNH XÁC!
```

### **2. Mapping từ tên file sang Document Type**

Frontend nên có logic gợi ý:

```javascript
function suggestDocumentType(fileName) {
  const name = fileName.toLowerCase();
  
  if (name.includes('định mức') || name.includes('bom')) {
    return 'BOM';
  }
  
  if (name.includes('hóa đơn gtgt') || name.includes('vat')) {
    return 'VAT_INVOICE';
  }
  
  if (name.includes('commercial invoice') || name.includes('invoice')) {
    return 'COMMERCIAL_INVOICE';
  }
  
  if (name.includes('tờ khai xuất')) {
    return 'EXPORT_DECLARATION';
  }
  
  if (name.includes('tờ khai nhập')) {
    return 'IMPORT_DECLARATION';
  }
  
  if (name.includes('b/l') || name.includes('vận đơn')) {
    return 'BILL_OF_LADING';
  }
  
  if (name.includes('c/o')) {
    return 'NPL_ORIGIN_CERT';
  }
  
  return null; // Yêu cầu user chọn thủ công
}
```

---

## 📝 VALIDATION RULES

### **Khi tạo Bundle/C/O Draft:**

```javascript
// Frontend nên validate:
const requiredTypes = ['COMMERCIAL_INVOICE', 'VAT_INVOICE', 'BOM'];

function validateDocuments(documents) {
  const types = documents.map(d => d.documentType);
  
  for (const required of requiredTypes) {
    if (!types.includes(required)) {
      return {
        valid: false,
        message: `Thiếu tài liệu: ${getDocumentTypeName(required)}`
      };
    }
  }
  
  return { valid: true };
}

function getDocumentTypeName(type) {
  const names = {
    'COMMERCIAL_INVOICE': 'Hóa đơn xuất khẩu',
    'VAT_INVOICE': 'Hóa đơn GTGT (NPL)',
    'BOM': 'Bảng định mức',
    'EXPORT_DECLARATION': 'Tờ khai xuất khẩu',
    'IMPORT_DECLARATION': 'Tờ khai nhập khẩu',
    'PURCHASE_LIST': 'Danh sách mua hàng',
    'NPL_ORIGIN_CERT': 'C/O NPL',
    'BILL_OF_LADING': 'Vận đơn'
  };
  return names[type] || type;
}
```

---

## 🎨 UI SUGGESTIONS

### **Dropdown cho FE:**

```javascript
const documentTypeOptions = [
  { 
    value: 'COMMERCIAL_INVOICE', 
    label: 'Hóa đơn xuất khẩu (Commercial Invoice)',
    required: true,
    icon: '📄'
  },
  { 
    value: 'VAT_INVOICE', 
    label: 'Hóa đơn GTGT - NPL (VAT Invoice)',
    required: true,
    icon: '🧾'
  },
  { 
    value: 'BOM', 
    label: 'Bảng định mức (Bill of Materials)',
    required: true,
    icon: '📊'
  },
  { 
    value: 'EXPORT_DECLARATION', 
    label: 'Tờ khai xuất khẩu',
    required: false,
    icon: '📋'
  },
  { 
    value: 'IMPORT_DECLARATION', 
    label: 'Tờ khai nhập khẩu',
    required: false,
    icon: '📋'
  },
  { 
    value: 'PURCHASE_LIST', 
    label: 'Danh sách mua hàng',
    required: false,
    icon: '📝'
  },
  { 
    value: 'NPL_ORIGIN_CERT', 
    label: 'C/O xuất xứ NPL',
    required: false,
    icon: '🏆'
  },
  { 
    value: 'BILL_OF_LADING', 
    label: 'Vận đơn (B/L)',
    required: false,
    icon: '🚢'
  }
];
```

---

## 🔍 DEBUG CHECKLIST

Khi AI không chạy cho file "Bảng định mức.pdf":

- [ ] Kiểm tra `documentType` trong DB: Phải là `"BOM"` (không phải `"BILL_OF_MATERIALS"` hay `"Bảng định mức"`)
- [ ] Kiểm tra `ocrResult`: Phải có nội dung (không rỗng)
- [ ] Kiểm tra `status`: Phải là `"OCR_COMPLETED"`
- [ ] Kiểm tra log BE: Có dòng `"bomCount: X"` với X > 0

### **Query MongoDB để debug:**

```javascript
// Kiểm tra document type
db.documents.find({ fileName: /định mức/i }).pretty()

// Kết quả mong đợi:
{
  "_id": ObjectId("..."),
  "fileName": "Bảng định mức.pdf",
  "documentType": "BOM",  // ← PHẢI LÀ "BOM"
  "status": "OCR_COMPLETED",
  "ocrResult": "... nội dung OCR ..."
}
```

---

## 📞 API REFERENCE

### **Upload Document:**

```bash
POST /api/v1/documents/upload

Body:
{
  "fileName": "Bảng định mức.pdf",
  "documentType": "BOM",  # ← CHÍNH XÁC!
  "bundleId": "...",
  "base64Content": "...",
  "mimeType": "application/pdf"
}
```

### **Update Document Type:**

```bash
PATCH /api/v1/documents/:id

Body:
{
  "documentType": "BOM"  # ← Sửa lại nếu sai
}
```

---

## ✅ CHECKLIST CHO FE

- [ ] Sử dụng đúng 8 document types từ enum
- [ ] Implement auto-suggest dựa vào tên file
- [ ] Validate có đủ 3 loại bắt buộc trước khi tạo C/O
- [ ] Hiển thị icon/badge cho loại bắt buộc
- [ ] Cho phép user sửa type nếu auto-suggest sai
- [ ] Log document type khi upload để debug

---

**Cập nhật:** 11/11/2025  
**Version:** 1.0  
**Contact:** Backend Team
