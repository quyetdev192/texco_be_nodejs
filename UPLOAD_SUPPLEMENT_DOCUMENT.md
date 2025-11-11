# Upload Bổ Sung Document - Hướng Dẫn

## Vấn đề

Khi **nhân viên C/O upload bổ sung document** (VD: BOM) sau khi đã tạo lô hàng:
- ❌ **Trước**: Document không được link vào `lohangDraft.linkedDocuments` → Lỗi "Không tìm thấy BOM document"
- ✅ **Sau**: Document tự động được link vào lohangDraft

## Giải pháp

### 1. Tự động link documents mới vào lohangDraft

Khi nhân viên C/O upload bổ sung document qua API:
```
POST /api/v1/review/documents/:bundleId/add
```

Hệ thống sẽ:
1. Insert documents mới vào DB
2. **Tìm lohangDraft** liên kết với bundle
3. **Tự động thêm** document IDs vào `lohangDraft.linkedDocuments`
4. Khởi chạy OCR

### 2. Code implementation

```javascript
// src/api/handles/document.handle.js

// Insert documents
const inserted = await Document.insertMany(docsToInsert);

// ✅ TỰ ĐỘNG LINK DOCUMENTS MỚI VÀO LOHANG DRAFT (nếu có)
const LohangDraft = buildModelFromClass(LohangDraftClass);

const lohangDraft = await LohangDraft.findOne({ 
    linkedDocuments: { $in: bundle.documents || [] }
});

if (lohangDraft) {
    const newDocIds = inserted.map(d => d._id);
    await LohangDraft.findByIdAndUpdate(lohangDraft._id, {
        $addToSet: { linkedDocuments: { $each: newDocIds } },
        updatedAt: new Date()
    });
    console.log(`✅ Auto-linked ${newDocIds.length} new documents to lohangDraft ${lohangDraft._id}`);
}
```

### 3. Cải thiện error message

Khi không tìm thấy BOM document, hiển thị thông tin chi tiết:

```javascript
if (bomDocs.length === 0) {
    const availableTypes = [...new Set(documents.map(d => d.documentType))];
    throw new Error(
        `Không tìm thấy BOM document trong lô hàng này. ` +
        `Các loại chứng từ hiện có: ${availableTypes.join(', ')}. ` +
        `Vui lòng upload file BOM trước khi re-extract.`
    );
}
```

## Workflow

### Trước khi fix

```
1. NCC upload documents → Bundle created
2. Staff tạo C/O draft → linkedDocuments = [doc1, doc2, doc3]
3. Staff upload BOM bổ sung → Document created
   ❌ linkedDocuments vẫn = [doc1, doc2, doc3] (không có BOM)
4. Staff re-extract BOM → Error: "Không tìm thấy BOM document"
```

### Sau khi fix

```
1. NCC upload documents → Bundle created
2. Staff tạo C/O draft → linkedDocuments = [doc1, doc2, doc3]
3. Staff upload BOM bổ sung → Document created
   ✅ linkedDocuments = [doc1, doc2, doc3, doc4_BOM]
4. Staff re-extract BOM → Success! ✅
```

## Testing

### Test case 1: Upload BOM sau khi tạo lô hàng

```bash
# 1. Tạo lô hàng (chưa có BOM)
POST /api/v1/co/create
{
  "bundleId": "6912f1ab31e62ca9171a0476"
}

# 2. Upload BOM bổ sung
POST /api/v1/review/documents/6912f1ab31e62ca9171a0476/add
{
  "documents": [
    {
      "fileName": "BOM.xlsx",
      "storagePath": "s3://...",
      "documentType": "BOM",
      "ocrPages": [...]
    }
  ]
}

# 3. Đợi OCR hoàn thành (check logs)
# Log: ✅ Auto-linked 1 new documents to lohangDraft 6912fb5af60f4eeab045bc7c

# 4. Re-extract BOM
POST /api/v1/co/lohang/6912fb5af60f4eeab045bc7c/re-extract-table
{
  "tableType": "BOM",
  "userNote": "thử lại"
}

# Expected: Success! ✅
```

### Test case 2: Upload nhiều documents cùng lúc

```bash
POST /api/v1/review/documents/:bundleId/add
{
  "documents": [
    { "fileName": "BOM.xlsx", "documentType": "BOM", ... },
    { "fileName": "VAT_Invoice_2.pdf", "documentType": "VAT_INVOICE", ... }
  ]
}

# Log: ✅ Auto-linked 2 new documents to lohangDraft ...
```

## Debug

### Kiểm tra linkedDocuments

```javascript
// MongoDB query
db.lohang_drafts.findOne({ _id: ObjectId("6912fb5af60f4eeab045bc7c") })

// Check linkedDocuments array
{
  "_id": "6912fb5af60f4eeab045bc7c",
  "linkedDocuments": [
    "6912f1ab31e62ca9171a0477", // COMMERCIAL_INVOICE
    "6912f1ab31e62ca9171a0478", // BOM (newly added) ✅
    "6912f1ab31e62ca9171a0479"  // VAT_INVOICE
  ]
}
```

### Kiểm tra log

```bash
# Khi upload bổ sung
✅ Auto-linked 1 new documents to lohangDraft 6912fb5af60f4eeab045bc7c

# Khi re-extract
Available documents: [
  { id: '...', type: 'COMMERCIAL_INVOICE', hasOcr: true },
  { id: '...', type: 'BOM', hasOcr: true }, ✅
  { id: '...', type: 'VAT_INVOICE', hasOcr: true }
]
```

## Notes

- ✅ Tự động link documents mới vào lohangDraft
- ✅ Hỗ trợ upload nhiều documents cùng lúc
- ✅ Không ảnh hưởng đến documents cũ (dùng `$addToSet`)
- ✅ Log rõ ràng để debug
- ✅ Error message chi tiết khi thiếu document

## Related Files

- `src/api/handles/document.handle.js` - staffAddDocuments()
- `src/api/handles/coProcess.handle.js` - reExtractTable()
- `src/api/models/lohangDraft.model.js` - linkedDocuments field
