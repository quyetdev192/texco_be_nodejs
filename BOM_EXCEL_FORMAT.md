# BOM Excel Format - Hướng Dẫn

## Cấu trúc Excel BOM

### Header (2 rows)

```
Row 1: STT của SKU
| MA NL | HS CODE | TEN NL | QUY CACH | DVT | 1 | 2 | 3 | 4 | 5 | ... |

Row 2: Mã SKU
| MA NL | HS CODE | TEN NL | QUY CACH | DVT | E-31 | C-31 | C-37 | C-61D | C-73D | ... |
```

### Data rows (row 3+)

```
| VanMDF | 54111400 | Ván MDF 15mm | 15*1220*2440 | M3 | 0.01826344 | 0.01826344 | 0.01826344 | 0.055528586 | 0.027243883 | ... |
| GoThang | 44079990 | Gỗ thông (HH 50%) | ... | M3 | 0.01458691 | 0.01458691 | ... |
```

## Cột cố định

1. **MA NL** (Mã NPL): Mã nguyên phụ liệu
2. **HS CODE**: Mã HS Code (8 số)
3. **TEN NL** (Tên NPL): Tên nguyên phụ liệu - **BẮT BUỘC**
4. **QUY CACH**: Quy cách/Specification
5. **DVT** (Đơn vị tính): Unit - **BẮT BUỘC**

## Cột động (SKU)

Sau cột **DVT**, mỗi cột là 1 SKU:
- **Row 1**: STT của SKU (1, 2, 3, 4, ...)
- **Row 2**: Mã SKU (E-31, C-31, C-37, ...)
- **Row 3+**: Định mức cho SKU đó (số thập phân)

## Ví dụ thực tế

```
| MA NL      | HS CODE  | TEN NL                | QUY CACH        | DVT | 1        | 2        | 3        | 4        |
|------------|----------|-----------------------|-----------------|-----|----------|----------|----------|----------|
|            |          |                       |                 |     | E-31     | C-31     | C-37     | C-61D    |
| VanMDF     | 54111400 | Ván MDF 15*1220*2440  | 15*1220*2440 P2 | M3  | 0.018263 | 0.018263 | 0.018263 | 0.055529 |
| GoThang    | 44079990 | Gỗ thông (HH 50%)     |                 | M3  | 0.014587 | 0.014587 | 0.011635 | 0.015218 |
| ViDauBung  | 73181200 | Vít đầu bung φ4*25    | φ4*25           | con | 92       | 72       | 48       | 52       |
```

## Parser Logic

### 1. Đọc 2 rows header

```javascript
const sttRow = rawData[0];      // Row 1: STT
const skuCodeRow = rawData[1];  // Row 2: Mã SKU
```

### 2. Xác định cột cố định

```javascript
const fixedColumns = {
  maNL: findColumnIndex(skuCodeRow, ['MA NL', 'MÃ NL']),
  hsCode: findColumnIndex(skuCodeRow, ['HS CODE']),
  tenNL: findColumnIndex(skuCodeRow, ['TEN NL', 'TÊN NL']),
  quyCach: findColumnIndex(skuCodeRow, ['QUY CACH']),
  dvt: findColumnIndex(skuCodeRow, ['DVT', 'ĐVT'])
};
```

### 3. Xác định cột SKU

```javascript
// Các cột sau DVT là SKU
for (let i = dvtIndex + 1; i < skuCodeRow.length; i++) {
  const stt = sttRow[i];           // STT từ row 1
  const skuCode = skuCodeRow[i];   // Mã SKU từ row 2
  
  if (skuCode && skuCode !== '') {
    skuColumns.push({
      index: i,
      stt: stt,
      skuCode: skuCode
    });
  }
}
```

### 4. Parse data rows

```javascript
// Bắt đầu từ row 3 (index 2)
for (let rowIndex = 2; rowIndex < rawData.length; rowIndex++) {
  const row = rawData[rowIndex];
  
  // Lấy thông tin NPL
  const maNL = getCellValue(row, fixedColumns.maNL);
  const tenNL = getCellValue(row, fixedColumns.tenNL);
  const hsCode = getCellValue(row, fixedColumns.hsCode);
  const dvt = getCellValue(row, fixedColumns.dvt);
  
  // Lấy định mức cho từng SKU
  const normPerSku = {};
  for (const skuCol of skuColumns) {
    const normValue = getCellValue(row, skuCol.index);
    normPerSku[skuCol.skuCode] = parseNumber(normValue);
  }
  
  materials.push({
    nplCode: maNL,
    nplName: tenNL,
    hsCode: hsCode,
    unit: dvt,
    normPerSku: normPerSku
  });
}
```

### 5. Merge với Product Table

```javascript
// Excel BOM có: { stt, skuCode }
// Product Table có: { skuCode, productName }

const mergedSkuList = parsedData.skuList.map(excelSku => {
  const productSku = skuListFromProductTable.find(
    p => p.skuCode === excelSku.skuCode
  );
  
  return {
    stt: excelSku.stt,              // Từ Excel BOM
    skuCode: excelSku.skuCode,      // Từ Excel BOM
    productName: productSku?.productName || ''  // Từ Product Table
  };
});
```

## Output Format

### ExtractedBomTable

```json
{
  "lohangDraftId": "...",
  "bundleId": "...",
  "bomData": [
    {
      "stt": 1,
      "nplCode": "VanMDF",
      "nplName": "Ván MDF 15*1220*2440",
      "hsCode": "54111400",
      "unit": "M3",
      "normPerSku": {
        "E-31": 0.018263,
        "C-31": 0.018263,
        "C-37": 0.018263,
        "C-61D": 0.055529
      }
    }
  ],
  "skuList": [
    {
      "stt": "1",
      "skuCode": "E-31",
      "productName": "Tủ E-31"
    },
    {
      "stt": "2",
      "skuCode": "C-31",
      "productName": "Tủ C-31"
    }
  ],
  "totalMaterials": 50,
  "totalSkus": 10,
  "aiConfidence": 100,
  "aiModel": "EXCEL_UPLOAD",
  "bomExcelUrl": "https://s3.../BOM.xlsx"
}
```

## Validation Rules

### 1. Header validation

- ✅ Phải có ít nhất 3 rows (2 header + 1 data)
- ✅ Row 1 phải có STT của SKU
- ✅ Row 2 phải có mã SKU
- ✅ Phải tìm thấy cột DVT

### 2. Column validation

- ✅ **TEN NL** là bắt buộc
- ✅ **DVT** là bắt buộc
- ⚠️ MA NL, HS CODE, QUY CACH là optional

### 3. SKU validation

- ✅ Phải có ít nhất 1 cột SKU sau DVT
- ✅ SKU code không được rỗng
- ⚠️ STT có thể rỗng (sẽ để empty string)

### 4. Data validation

- ✅ Định mức phải là số (hoặc 0 nếu rỗng)
- ✅ Skip row rỗng
- ✅ Skip row header phụ (có chứa "STT", "Số TT")

## Error Handling

### 1. Excel file không hợp lệ

```javascript
if (!rawData || rawData.length < 3) {
  throw new Error('Excel file rỗng hoặc không đủ dữ liệu (cần ít nhất 3 rows)');
}
```

### 2. Không tìm thấy cột SKU

```javascript
if (skuColumns.length === 0) {
  throw new Error('Không tìm thấy cột SKU trong Excel');
}
```

### 3. Row không có tên NPL

```javascript
if (!tenNL) {
  console.warn(`Row ${rowIndex + 1}: Bỏ qua vì không có tên NPL`);
  continue;
}
```

### 4. Row không có định mức

```javascript
// Chỉ thêm material nếu có ít nhất 1 định mức > 0
if (hasNorm) {
  materials.push(material);
}
```

## Testing

### Test case 1: Excel BOM hợp lệ

```bash
# Input: BOM.xlsx với 2 header rows + 50 data rows
# Expected: Parse thành công 50 materials

✅ Parsed 50 materials with norms
✅ SKU list: 10 SKUs
✅ Confidence: 100%
```

### Test case 2: Excel BOM thiếu header

```bash
# Input: BOM.xlsx chỉ có 1 row
# Expected: Error

❌ Error: Excel file rỗng hoặc không đủ dữ liệu (cần ít nhất 3 rows)
```

### Test case 3: Excel BOM không có cột SKU

```bash
# Input: BOM.xlsx không có cột sau DVT
# Expected: Error

❌ Error: Không tìm thấy cột SKU trong Excel
```

### Test case 4: Row có tên NPL nhưng không có định mức

```bash
# Input: Row có TEN NL nhưng tất cả định mức = 0
# Expected: Skip row đó

⚠️ Row skipped (no norms)
```

## Notes

- ✅ Parser tự động detect 2 rows header
- ✅ Hỗ trợ nhiều tên cột (MA NL, MÃ NL, NPL CODE, ...)
- ✅ Tự động merge SKU list với Product Table
- ✅ 100% confidence vì parse trực tiếp từ Excel
- ✅ Lưu URL Excel để tham khảo sau này
