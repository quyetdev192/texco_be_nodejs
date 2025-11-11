# HƯỚNG DẪN WORKFLOW TỐI ƯU - CHỈ 1 NÚT BẤM

## 🎯 MỤC TIÊU

**Giảm số lần bấm nút từ 2 → 1:**

### ❌ **Cách CŨ (2 lần bấm):**

```
1. User upload/bổ sung file
2. Bấm "Tiếp tục" → Hiển thị form
3. Nhập Form Type, Exchange Rate, Criterion
4. Bấm "Setup" → Lưu form
5. Bấm "Tiếp tục" lần nữa → Bắt đầu extract
```

### ✅ **Cách MỚI (1 lần bấm):**

```
1. User upload/bổ sung file
2. Bấm "Tiếp tục" → Hiển thị form
3. Nhập Form Type, Exchange Rate, Criterion
4. Bấm "Tiếp tục" → Setup + Extract cùng lúc ✨
```

---

## 🆕 API MỚI: SETUP + EXTRACT

### **Endpoint:**

```http
POST /api/v1/co/lohang/:id/setup-and-extract
```

### **Request Body:**

```json
{
  "formType": "FORM_E",
  "exchangeRate": 24500,
  "criterionType": "CTC"
}
```

### **Response:**

```json
{
  "success": true,
  "data": {
    "_id": "6912cc77d27241e631a4194b",
    "formType": "FORM_E",
    "exchangeRate": 24500,
    "criterionType": "CTC",
    "status": "DATA_EXTRACTING",
    "currentStep": 3,
    "message": "Đã setup form và bắt đầu trích xuất dữ liệu"
  }
}
```

---

## 📊 SO SÁNH 2 CÁCH

### **Cách 1: API Riêng (Cũ - 2 API calls)**

```javascript
// Step 1: Setup form
const setupResponse = await fetch(`/api/v1/co/lohang/${id}/setup`, {
  method: 'PUT',
  body: JSON.stringify({ formType, exchangeRate, criterionType })
});

// Step 2: Trigger extract
const extractResponse = await fetch(`/api/v1/co/lohang/${id}/extract-tables`, {
  method: 'POST'
});

// Total: 2 API calls, 2 button clicks
```

### **Cách 2: API Kết hợp (Mới - 1 API call)** ⭐

```javascript
// 1 API call làm cả 2 việc
const response = await fetch(`/api/v1/co/lohang/${id}/setup-and-extract`, {
  method: 'POST',
  body: JSON.stringify({ formType, exchangeRate, criterionType })
});

// Total: 1 API call, 1 button click ✨
```

---

## 💡 WORKFLOW OBJECT MỚI

### **Khi ở Bước 2:**

```json
{
  "workflow": {
    "currentStep": 2,
    "status": "DRAFT",
    "canProceed": true,
    "nextAction": {
      "type": "SETUP_AND_EXTRACT",
      "endpoint": "/api/v1/co/lohang/6912cc77.../setup-and-extract",
      "method": "POST",
      "label": "Continue",
      "description": "Setup Form & Start Extraction",
      "requiredFields": ["formType", "exchangeRate", "criterionType"],
      "alternativeEndpoint": "/api/v1/co/lohang/6912cc77.../setup"
    }
  }
}
```

**Giải thích:**
- `type: "SETUP_AND_EXTRACT"` - Loại action mới
- `label: "Continue"` - Text hiển thị trên nút
- `description` - Mô tả chi tiết action
- `alternativeEndpoint` - API cũ (nếu muốn tách riêng)

---

## 🎨 FRONTEND IMPLEMENTATION

### **Component: ContinueButton.jsx**

```javascript
import { useState } from 'react';

function ContinueButton({ lohangId, workflow }) {
  const [formData, setFormData] = useState({
    formType: '',
    exchangeRate: '',
    criterionType: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (workflow.nextAction?.type === 'SETUP_AND_EXTRACT') {
      // Validate form
      if (!formData.formType || !formData.exchangeRate || !formData.criterionType) {
        alert('Vui lòng điền đầy đủ thông tin');
        return;
      }

      setIsSubmitting(true);
      
      try {
        // 1 API call duy nhất
        const response = await fetch(workflow.nextAction.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
          // ✅ Đã setup + bắt đầu extract
          // Chuyển sang màn hình polling
          navigate(`/co/${lohangId}/extracting`);
          
          // Bắt đầu polling để check status
          startPolling();
        }
      } catch (error) {
        console.error('Error:', error);
        alert(error.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="continue-section">
      {/* Form nhập liệu */}
      <div className="form-group">
        <label>Form Type:</label>
        <select 
          value={formData.formType}
          onChange={(e) => setFormData({ ...formData, formType: e.target.value })}
        >
          <option value="">-- Select --</option>
          <option value="FORM_E">Form E</option>
          <option value="FORM_B">Form B</option>
        </select>
      </div>

      <div className="form-group">
        <label>Exchange Rate:</label>
        <input 
          type="number"
          value={formData.exchangeRate}
          onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
          placeholder="24500"
        />
      </div>

      <div className="form-group">
        <label>Criterion Type:</label>
        <select 
          value={formData.criterionType}
          onChange={(e) => setFormData({ ...formData, criterionType: e.target.value })}
        >
          <option value="">-- Select --</option>
          <option value="CTC">CTC</option>
          <option value="CTSH">CTSH</option>
          <option value="RVC40">RVC 40%</option>
          <option value="RVC45">RVC 45%</option>
        </select>
      </div>

      {/* Nút Continue */}
      <button 
        onClick={handleContinue}
        disabled={isSubmitting || !workflow.canProceed}
        className="btn-continue"
      >
        {isSubmitting ? 'Processing...' : workflow.nextAction?.label}
      </button>

      {workflow.nextAction?.description && (
        <p className="action-description">
          {workflow.nextAction.description}
        </p>
      )}
    </div>
  );
}
```

---

### **Polling sau khi Extract:**

```javascript
function useExtractionPolling(lohangId) {
  const [isPolling, setIsPolling] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState(null);

  const startPolling = () => {
    setIsPolling(true);

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/co/lohang/${lohangId}`);
        const data = await response.json();

        setExtractionStatus(data.workflow);

        // Kiểm tra đã xong chưa
        if (data.workflow.nextAction?.type !== 'WAIT') {
          clearInterval(interval);
          setIsPolling(false);

          // Chuyển sang bước tiếp theo
          if (data.workflow.currentStep === 4) {
            navigate(`/co/${lohangId}/tables`);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(interval);
        setIsPolling(false);
      }
    }, 5000); // Poll mỗi 5 giây

    return () => clearInterval(interval);
  };

  return { isPolling, extractionStatus, startPolling };
}
```

---

## 🔄 FLOW HOÀN CHỈNH

### **Bước 1: User vào trang C/O Draft**

```javascript
// Lấy workflow info
const { data } = await fetch(`/api/v1/co/lohang/${id}`);
const { workflow } = data;

// Check currentStep
if (workflow.currentStep === 2) {
  // Hiển thị form + nút Continue
  return <ContinueButton workflow={workflow} />;
}
```

---

### **Bước 2: User điền form và bấm Continue**

```javascript
// User nhập:
// - Form Type: FORM_E
// - Exchange Rate: 24500
// - Criterion: CTC

// Bấm Continue → Gọi API
const response = await fetch('/api/v1/co/lohang/123/setup-and-extract', {
  method: 'POST',
  body: JSON.stringify({
    formType: 'FORM_E',
    exchangeRate: 24500,
    criterionType: 'CTC'
  })
});

// Response:
{
  "status": "DATA_EXTRACTING",
  "currentStep": 3,
  "message": "Đã setup form và bắt đầu trích xuất dữ liệu"
}
```

---

### **Bước 3: Hiển thị Loading + Polling**

```javascript
// Navigate to extracting page
navigate(`/co/${id}/extracting`);

// Start polling
const interval = setInterval(async () => {
  const { workflow } = await fetch(`/api/v1/co/lohang/${id}`);
  
  if (workflow.nextAction?.type === 'WAIT') {
    // Vẫn đang extract
    showLoading(workflow.nextAction.label); // "Extracting Data..."
  } else {
    // Đã xong
    clearInterval(interval);
    navigate(`/co/${id}/tables`); // Chuyển sang review tables
  }
}, 5000);
```

---

## 📋 CHECKLIST CHO FE

### ✅ **Cần làm:**

1. **Cập nhật Component:**
   - [ ] Thêm form input cho formType, exchangeRate, criterionType
   - [ ] Gọi API `/setup-and-extract` thay vì 2 API riêng
   - [ ] Hiển thị loading sau khi submit
   - [ ] Implement polling

2. **Handle nextAction:**
   - [ ] Check `type === 'SETUP_AND_EXTRACT'`
   - [ ] Hiển thị form nếu chưa điền
   - [ ] Disable button khi `isSubmitting`
   - [ ] Validate form trước khi submit

3. **Error Handling:**
   - [ ] Handle validation errors (400)
   - [ ] Handle spam errors (429)
   - [ ] Show error message rõ ràng

4. **UX Improvements:**
   - [ ] Show progress indicator
   - [ ] Disable form khi đang submit
   - [ ] Clear form sau khi success
   - [ ] Auto-navigate sau khi extract xong

---

## 🎯 KẾT QUẢ

### **Trước:**
```
Upload → Continue → Form → Setup → Continue → Extract
         (Click 1)         (Click 2)  (Click 3)
```

### **Sau:**
```
Upload → Continue (với form) → Setup + Extract
         (Click 1)
```

**Giảm từ 3 clicks → 1 click!** 🚀

---

## 📝 LƯU Ý

1. **API cũ vẫn hoạt động:**
   - `/setup` (PUT) - Chỉ setup form
   - `/extract-tables` (POST) - Chỉ extract
   - Dùng khi muốn tách riêng 2 bước

2. **API mới khuyên dùng:**
   - `/setup-and-extract` (POST) - Setup + Extract cùng lúc
   - Tối ưu UX, giảm số lần bấm

3. **Prevent Spam:**
   - BE vẫn check `inProgress` flag
   - Không cho phép gọi lại khi đang extract
   - FE nên disable button khi submit

4. **Polling:**
   - Poll mỗi 5 giây
   - Stop khi `nextAction.type !== 'WAIT'`
   - Navigate tự động khi xong

---

## 🔗 API REFERENCE

| Endpoint | Method | Mục đích | Khuyên dùng |
|----------|--------|----------|-------------|
| `/setup` | PUT | Chỉ setup form | ❌ Cũ |
| `/extract-tables` | POST | Chỉ extract | ❌ Cũ |
| `/setup-and-extract` | POST | Setup + Extract | ✅ Mới |

---

## 📞 SUPPORT

Nếu có vấn đề, check:
1. `workflow.nextAction.type` có phải `SETUP_AND_EXTRACT` không
2. Form data có đầy đủ không
3. Polling có đang chạy không
4. Error response từ BE

**Happy coding! 🚀**
