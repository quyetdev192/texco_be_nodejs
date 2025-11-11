# Changelog: Bỏ HS Code khỏi Bảng NPL

## Ngày: 2025-11-11

## Thay đổi

### 1. Bỏ hsCode khỏi NPL extraction prompt

**File**: `src/core/utils/dataExtractor.utils.js`

**Trước**:
```javascript
{
  "materials": [
    {
      "nplCode": "string",
      "nplName": "string",
      "hsCode": "string hoặc null",  // ❌ Không cần
      "quantityImported": number,
      "unit": "string",
      "unitPriceVnd": number,
      "totalValueVnd": number
    }
  ]
}
```

**Sau**:
```javascript
{
  "materials": [
    {
      "nplCode": "string",
      "nplName": "string",
      // hsCode đã bỏ ✅
      "quantityImported": number,
      "unit": "string",
      "unitPriceVnd": number,
      "totalValueVnd": number
    }
  ]
}
```

### 2. Bỏ hsCode khỏi NPL material object

**File**: `src/core/utils/dataExtractor.utils.js` (line 248-266)

**Trước**:
```javascript
return {
  stt: stt++,
  nplCode: m.nplCode || m.nplName || 'N/A',
  nplName: m.nplName || 'N/A',
  hsCode: m.hsCode || '',  // ❌ Không cần
  invoiceNo: result.invoiceNo || 'N/A',
  // ...
};
```

**Sau**:
```javascript
return {
  stt: stt++,
  nplCode: m.nplCode || m.nplName || 'N/A',
  nplName: m.nplName || 'N/A',
  // hsCode đã bỏ ✅
  invoiceNo: result.invoiceNo || 'N/A',
  // ...
};
```

### 3. Comment hsCode trong NPL model

**File**: `src/api/models/extractedNplTable.model.js` (line 28)

**Trước**:
```javascript
materials: [{
  stt: { type: Number },
  nplCode: { type: String },
  nplName: { type: String },
  hsCode: { type: String }, // HS Code
  invoiceNo: { type: String },
  // ...
}]
```

**Sau**:
```javascript
materials: [{
  stt: { type: Number },
  nplCode: { type: String },
  nplName: { type: String },
  // hsCode: { type: String }, // HS Code - KHÔNG CẦN cho bảng NPL ✅
  invoiceNo: { type: String },
  // ...
}]
```

## Lý do

- **Bảng NPL** (Nhập kho Nguyên phụ liệu) chỉ cần thông tin về hóa đơn VAT
- **HS Code** chỉ cần cho:
  - ✅ Bảng Sản phẩm (Product Table)
  - ✅ Bảng BOM (Bill of Materials)
- Bỏ hsCode giúp:
  - ⚡ Giảm độ phức tạp của prompt
  - ⚡ Tăng tốc độ extraction
  - ✅ Tránh lỗi khi AI không tìm thấy HS Code

## Impact

### API Response

**Endpoint**: `GET /api/v1/co/lohang/:id/tables`

**Trước**:
```json
{
  "nplTable": {
    "materials": [
      {
        "stt": 1,
        "nplCode": "VAN_MDF_001",
        "nplName": "Ván MDF 15mm",
        "hsCode": "",  // ❌ Thường rỗng
        "quantityImported": 100,
        "unit": "M3"
      }
    ]
  }
}
```

**Sau**:
```json
{
  "nplTable": {
    "materials": [
      {
        "stt": 1,
        "nplCode": "VAN_MDF_001",
        "nplName": "Ván MDF 15mm",
        // hsCode không còn ✅
        "quantityImported": 100,
        "unit": "M3"
      }
    ]
  }
}
```

### Database

**Collection**: `extracted_npl_tables`

- Documents cũ: Có thể vẫn có field `hsCode` (giá trị rỗng)
- Documents mới: Không có field `hsCode`
- **Backward compatible**: ✅ Không ảnh hưởng đến data cũ

## Testing

### Test case 1: Extract NPL từ VAT Invoice

```bash
POST /api/v1/co/lohang/:id/re-extract-table
{
  "tableType": "NPL",
  "userNote": "test"
}
```

**Expected**:
- ✅ Gemini prompt không có hsCode
- ✅ Response không có hsCode
- ✅ DB không lưu hsCode

### Test case 2: Verify existing data

```javascript
// MongoDB query
db.extracted_npl_tables.findOne({})

// Old documents (có hsCode)
{
  "materials": [
    {
      "nplCode": "...",
      "nplName": "...",
      "hsCode": "",  // Có thể có, thường rỗng
      "quantityImported": 100
    }
  ]
}

// New documents (không có hsCode)
{
  "materials": [
    {
      "nplCode": "...",
      "nplName": "...",
      // hsCode không có ✅
      "quantityImported": 100
    }
  ]
}
```

## Migration

**Không cần migration** vì:
- Field `hsCode` đã được comment trong model (không validate)
- Data cũ vẫn hoạt động bình thường
- Data mới không có field này

Nếu muốn clean up data cũ:

```javascript
// Optional: Remove hsCode from existing documents
db.extracted_npl_tables.updateMany(
  {},
  { $unset: { "materials.$[].hsCode": "" } }
)
```

## Related Files

- ✅ `src/core/utils/dataExtractor.utils.js` - Extraction logic
- ✅ `src/api/models/extractedNplTable.model.js` - Model definition
- `src/api/handles/coProcess.handle.js` - Re-extract handler (không cần sửa)
- `src/api/controllers/extractedTables.controller.js` - API controller (không cần sửa)

## Notes

- ✅ Thay đổi chỉ ảnh hưởng đến **bảng NPL**
- ✅ **Bảng Product** và **Bảng BOM** vẫn có hsCode
- ✅ Backward compatible với data cũ
- ✅ Không cần restart DB hoặc migration
