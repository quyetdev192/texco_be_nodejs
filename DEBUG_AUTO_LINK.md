# Debug Auto-Link Documents to LohangDraft

## Khi upload BOM bổ sung, xem log này:

```
========== AUTO-LINK TO LOHANG DRAFT ==========
Bundle ID: 6912f1ab31e62ca9171a0476
All documents in bundle: 4
Document IDs: [
  '6912f1ab31e62ca9171a0477',
  '6912f1ab31e62ca9171a0478', 
  '6912f1ab31e62ca9171a0479',
  '6912f1ab31e62ca9171a047a'  // BOM mới
]
```

### Case 1: Tìm thấy lohangDraft ✅

```
✅ Found lohangDraft: 6912fda9145d7f4767602e33
Current linkedDocuments: 3
New documents to link: ['6912f1ab31e62ca9171a047a']
✅ Auto-linked 1 new documents to lohangDraft 6912fda9145d7f4767602e33
===============================================
```

→ **Thành công!** BOM đã được link vào lohangDraft

### Case 2: Không tìm thấy lohangDraft ❌

```
⚠️ No lohangDraft found for bundle 6912f1ab31e62ca9171a0476
Searched with document IDs: [
  '6912f1ab31e62ca9171a0477',
  '6912f1ab31e62ca9171a0478',
  '6912f1ab31e62ca9171a0479',
  '6912f1ab31e62ca9171a047a'
]
Documents not linked. Please check:
1. Does lohangDraft exist for this bundle?
2. Are any of these document IDs in lohangDraft.linkedDocuments?
===============================================
```

→ **Thất bại!** Cần kiểm tra DB

## Kiểm tra DB

### 1. Kiểm tra lohangDraft có tồn tại không

```javascript
db.lohang_drafts.find({}).projection({ _id: 1, linkedDocuments: 1 })
```

### 2. Kiểm tra documents trong bundle

```javascript
db.documents.find({ 
  bundleId: ObjectId("6912f1ab31e62ca9171a0476") 
}).projection({ _id: 1, documentType: 1 })
```

### 3. Kiểm tra xem document IDs có trong lohangDraft không

```javascript
// Lấy document IDs từ bundle
const docIds = db.documents.find({ 
  bundleId: ObjectId("6912f1ab31e62ca9171a0476") 
}).map(d => d._id)

// Tìm lohangDraft có chứa bất kỳ doc nào
db.lohang_drafts.findOne({
  linkedDocuments: { $in: docIds }
})
```

### 4. Nếu không tìm thấy → Manual link

```javascript
// Lấy lohangDraft ID
const lohangDraftId = ObjectId("6912fda9145d7f4767602e33")

// Lấy BOM document ID
const bomDocId = ObjectId("6912f1ab31e62ca9171a047a")

// Manual link
db.lohang_drafts.updateOne(
  { _id: lohangDraftId },
  { 
    $addToSet: { linkedDocuments: bomDocId },
    $set: { updatedAt: new Date() }
  }
)
```

## Nguyên nhân có thể

### 1. LohangDraft chưa được tạo

**Triệu chứng**: Log hiển thị "No lohangDraft found"

**Kiểm tra**:
```javascript
db.lohang_drafts.countDocuments({})
```

**Giải pháp**: Tạo lohangDraft trước khi upload BOM

### 2. Documents cũ không có trong linkedDocuments

**Triệu chứng**: 
- Bundle có documents: [A, B, C]
- LohangDraft.linkedDocuments = [X, Y, Z]
- Không có document nào trùng → Không tìm thấy

**Kiểm tra**:
```javascript
// Lấy documents từ bundle
const bundleDocs = db.documents.find({ 
  bundleId: ObjectId("6912f1ab31e62ca9171a0476") 
}).map(d => d._id)

// Lấy linkedDocuments từ lohangDraft
const lohangDraft = db.lohang_drafts.findOne({ 
  _id: ObjectId("6912fda9145d7f4767602e33") 
})

// So sánh
bundleDocs.some(id => lohangDraft.linkedDocuments.includes(id))
// → Phải return true
```

**Giải pháp**: Link documents cũ vào lohangDraft trước

### 3. Bundle ID không đúng

**Triệu chứng**: Upload vào bundle A nhưng lohangDraft link với bundle B

**Kiểm tra**:
```javascript
// Lấy bundleId từ lohangDraft
const lohangDraft = db.lohang_drafts.findOne({ 
  _id: ObjectId("6912fda9145d7f4767602e33") 
})

const linkedDocs = db.documents.find({
  _id: { $in: lohangDraft.linkedDocuments }
}).projection({ bundleId: 1 })

// Check bundleId có đúng không
```

## Test Workflow

### 1. Tạo lohangDraft từ bundle

```bash
POST /api/v1/co/create
{
  "bundleId": "6912f1ab31e62ca9171a0476"
}

# Response
{
  "lohangDraftId": "6912fda9145d7f4767602e33",
  "linkedDocuments": ["doc1", "doc2", "doc3"]
}
```

### 2. Upload BOM bổ sung

```bash
POST /api/v1/review/documents/6912f1ab31e62ca9171a0476/add
{
  "documents": [
    {
      "fileName": "BOM.xlsx",
      "documentType": "BOM",
      ...
    }
  ]
}
```

### 3. Xem log

```
========== AUTO-LINK TO LOHANG DRAFT ==========
Bundle ID: 6912f1ab31e62ca9171a0476
All documents in bundle: 4
Document IDs: ['doc1', 'doc2', 'doc3', 'doc4_BOM']
✅ Found lohangDraft: 6912fda9145d7f4767602e33
Current linkedDocuments: 3
New documents to link: ['doc4_BOM']
✅ Auto-linked 1 new documents to lohangDraft 6912fda9145d7f4767602e33
===============================================
```

### 4. Verify DB

```javascript
db.lohang_drafts.findOne({ 
  _id: ObjectId("6912fda9145d7f4767602e33") 
})

// linkedDocuments phải có doc4_BOM
{
  "_id": "6912fda9145d7f4767602e33",
  "linkedDocuments": [
    "doc1",
    "doc2", 
    "doc3",
    "doc4_BOM" ✅
  ]
}
```

### 5. Re-extract BOM

```bash
POST /api/v1/co/lohang/6912fda9145d7f4767602e33/re-extract-table
{
  "tableType": "BOM",
  "userNote": "thử lại"
}

# Expected: Success! ✅
```

## Summary

Khi upload BOM bổ sung:
1. ✅ Document được insert vào DB
2. ✅ Tìm tất cả documents trong bundle
3. ✅ Tìm lohangDraft có chứa bất kỳ document nào
4. ✅ Auto-link BOM mới vào lohangDraft
5. ✅ Log chi tiết để debug

Nếu vẫn lỗi → Xem log để biết nguyên nhân cụ thể!
