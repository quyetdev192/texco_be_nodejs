# Test Upload BOM Bổ Sung

## Workflow Test

### 1. Kiểm tra lohangDraft hiện tại

```bash
# MongoDB query
db.lohang_drafts.findOne({ _id: ObjectId("6912fda9145d7f4767602e33") })

# Check linkedDocuments
{
  "_id": "6912fda9145d7f4767602e33",
  "linkedDocuments": [
    "doc1_id", // COMMERCIAL_INVOICE
    "doc2_id", // EXPORT_DECLARATION
    "doc3_id"  // VAT_INVOICE
  ]
}
```

### 2. Upload BOM bổ sung

```bash
POST /api/v1/review/documents/:bundleId/add
{
  "documents": [
    {
      "fileName": "BOM.xlsx",
      "storagePath": "s3://...",
      "documentType": "BOM",
      "ocrPages": [
        {
          "page": 1,
          "ocrStoragePath": "https://..."
        }
      ]
    }
  ]
}
```

### 3. Kiểm tra log server

Sau khi upload, xem log:

```
✅ Auto-linked 1 new documents to lohangDraft 6912fda9145d7f4767602e33
```

HOẶC

```
⚠️ No lohangDraft found for bundle 6912f1ab31e62ca9171a0476. Documents not linked.
```

### 4. Kiểm tra DB sau khi upload

```bash
# MongoDB query
db.lohang_drafts.findOne({ _id: ObjectId("6912fda9145d7f4767602e33") })

# linkedDocuments phải có thêm BOM
{
  "_id": "6912fda9145d7f4767602e33",
  "linkedDocuments": [
    "doc1_id", // COMMERCIAL_INVOICE
    "doc2_id", // EXPORT_DECLARATION  
    "doc3_id", // VAT_INVOICE
    "doc4_id"  // BOM (newly added) ✅
  ]
}
```

### 5. Đợi OCR hoàn thành

Kiểm tra document status:

```bash
db.documents.findOne({ _id: ObjectId("doc4_id") })

# Status phải là OCR_COMPLETED
{
  "_id": "doc4_id",
  "documentType": "BOM",
  "status": "OCR_COMPLETED", ✅
  "ocrResult": "..." // OCR text
}
```

### 6. Re-extract BOM

```bash
POST /api/v1/co/lohang/6912fda9145d7f4767602e33/re-extract-table
{
  "tableType": "BOM",
  "userNote": "thử lại"
}
```

Expected log:

```
Re-extracting BOM table with user note: thử lại
Available documents: [
  { id: '...', type: 'COMMERCIAL_INVOICE', hasOcr: true },
  { id: '...', type: 'EXPORT_DECLARATION', hasOcr: true },
  { id: '...', type: 'VAT_INVOICE', hasOcr: true },
  { id: '...', type: 'BOM', hasOcr: true } ✅
]
🔄 BOM extraction attempt 1/2...
✅ BOM extraction successful
```

## Debug Commands

### Kiểm tra bundle có documents nào

```javascript
db.documents.find({ bundleId: ObjectId("6912f1ab31e62ca9171a0476") })
  .projection({ _id: 1, documentType: 1, status: 1 })
```

### Kiểm tra lohangDraft có link đúng không

```javascript
db.lohang_drafts.findOne({ 
  linkedDocuments: { 
    $in: [ObjectId("doc1_id"), ObjectId("doc2_id")] 
  }
})
```

### Kiểm tra document có trong lohangDraft không

```javascript
db.lohang_drafts.findOne({
  _id: ObjectId("6912fda9145d7f4767602e33"),
  linkedDocuments: ObjectId("doc4_id") // BOM doc ID
})
```

## Troubleshooting

### Case 1: Log hiển thị "No lohangDraft found"

**Nguyên nhân**: Bundle chưa có document nào được link vào lohangDraft

**Giải pháp**:
1. Kiểm tra xem lohangDraft có tồn tại không
2. Kiểm tra xem bundle có documents cũ không
3. Kiểm tra xem documents cũ có trong linkedDocuments không

### Case 2: BOM đã upload nhưng vẫn báo "Không tìm thấy BOM"

**Nguyên nhân**: 
- Document chưa được link vào lohangDraft
- OCR chưa hoàn thành
- DocumentType không đúng

**Giải pháp**:
1. Check log: `⚠️ No lohangDraft found`
2. Check DB: `linkedDocuments` có BOM doc ID chưa
3. Check document status: `OCR_COMPLETED`
4. Check documentType: phải là `BOM`

### Case 3: Auto-link thành công nhưng re-extract vẫn lỗi

**Nguyên nhân**: OCR chưa hoàn thành

**Giải pháp**:
1. Đợi OCR hoàn thành (check log: `OCR completed for document`)
2. Kiểm tra `document.ocrResult` có dữ liệu chưa
3. Thử re-extract lại

## Expected Flow

```
1. NCC upload documents
   → Bundle created with docs [A, B, C]
   
2. Staff tạo C/O draft
   → LohangDraft created
   → linkedDocuments = [A, B, C]
   
3. Staff upload BOM (document D)
   → Document D inserted
   → Query: Find all docs in bundle → [A, B, C, D]
   → Query: Find lohangDraft with any of [A, B, C, D] → Found! ✅
   → Update: linkedDocuments = [A, B, C, D]
   → Log: ✅ Auto-linked 1 new documents
   
4. OCR completes for document D
   → Status: OCR_COMPLETED
   → ocrResult: "..."
   
5. Staff re-extract BOM
   → Query: Find docs in lohangDraft.linkedDocuments
   → Filter: documentType === 'BOM'
   → Found document D ✅
   → Extract BOM successfully
```
