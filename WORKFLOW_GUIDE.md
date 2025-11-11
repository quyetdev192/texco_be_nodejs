# HƯỚNG DẪN WORKFLOW CHO FRONTEND

## TỔNG QUAN

Hệ thống C/O có **8 bước** rõ ràng, BE sẽ trả về `workflow` object để FE biết:
- ✅ Đang ở bước nào (`currentStep`)
- ✅ Bước nào đã hoàn thành (`steps[].completed`)
- ✅ Action tiếp theo là gì (`nextAction`)
- ✅ Có thể tiếp tục không (`canProceed`)
- ✅ Có đang xử lý async không (`inProgress`)

---

## 8 BƯỚC WORKFLOW

| Step | Tên | Mô tả | API | Bắt buộc |
|------|-----|-------|-----|----------|
| 1 | Upload Documents | NCC upload chứng từ | `/api/v1/documents/upload` | ❌ Optional |
| 2 | Select Form & Criteria | Chọn Form E/B và tiêu chí | `/api/v1/co/lohang/:id/setup` | ✅ Required |
| 3 | Extract & Analyze Data | AI trích xuất và tổng hợp dữ liệu | `/api/v1/co/lohang/:id/extract-tables` | ✅ Required |
| 4 | Review Tables | Xem và sửa các bảng tổng hợp | `/api/v1/co/lohang/:id/tables` | ✅ Required |
| 5 | Confirm Data | Xác nhận dữ liệu | `/api/v1/co/lohang/:id/tables/confirm` | ✅ Required |
| 6 | Calculate Allocation | Tính toán phân bổ FIFO | `/api/v1/co/calculate/:id` | ✅ Required |
| 7 | Review Results | Xem kết quả tính toán | `/api/v1/co/lohang/:id` | ✅ Required |
| 8 | Export C/O | Xuất file C/O | `/api/v1/co/export/:id` | ✅ Required |

**Lưu ý:**
- ⭐ **Bước 1 (Upload)** có thể bỏ qua nếu đã có documents từ trước
- ⭐ Sau khi **setup Form & Criteria (Bước 2)** → Tự động chuyển sang **Bước 3**
- ⭐ **currentStep** bắt đầu từ **2** khi tạo draft mới

---

## WORKFLOW OBJECT

### Response Format:

```json
{
  "success": true,
  "data": {
    "lohangDraft": { ... },
    "workflow": {
      "currentStep": 3,
      "status": "DATA_EXTRACTING",
      "canProceed": false,
      "message": "Data extraction in progress. Please wait...",
      "steps": [
        {
          "step": 1,
          "name": "Upload Documents",
          "key": "step1_uploadDocuments",
          "completed": true,
          "completedAt": "2025-11-11T05:00:00.000Z"
        },
        {
          "step": 2,
          "name": "Select Form & Criteria",
          "key": "step2_selectFormAndCriteria",
          "completed": true,
          "completedAt": "2025-11-11T05:05:00.000Z"
        },
        {
          "step": 3,
          "name": "Extract & Analyze Data",
          "key": "step3_extractData",
          "completed": false,
          "completedAt": null,
          "inProgress": true
        },
        {
          "step": 4,
          "name": "Review Tables",
          "key": "step4_reviewTables",
          "completed": false,
          "completedAt": null
        }
        // ... các bước khác
      ],
      "nextAction": {
        "type": "WAIT",
        "label": "Extracting Data...",
        "polling": true,
        "pollingInterval": 5000
      }
    }
  }
}
```

---

## NEXT ACTION TYPES

### 1. **SETUP_FORM** - Chọn Form và Tiêu chí

```json
{
  "type": "SETUP_FORM",
  "endpoint": "/api/v1/co/lohang/6912cc77.../setup",
  "method": "PUT",
  "label": "Select Form & Criteria",
  "requiredFields": ["formType", "exchangeRate", "criterionType"]
}
```

**FE Action:**
```javascript
// Hiển thị form để user nhập
<Form onSubmit={handleSubmit}>
  <Select name="formType" options={['FORM_E', 'FORM_B']} />
  <Input name="exchangeRate" type="number" />
  <Select name="criterionType" options={['CTC', 'CTSH', 'RVC40', ...]} />
  <Button type="submit">Continue</Button>
</Form>

// Sau khi submit thành công
const response = await fetch(endpoint, {
  method: 'PUT',
  body: JSON.stringify({ formType, exchangeRate, criterionType })
});

// ⭐ BE tự động chuyển sang bước 3
// response.data.currentStep === 3
// response.data.workflow.nextAction.type === 'TRIGGER_EXTRACT'
```

---

### 2. **TRIGGER_EXTRACT** - Bắt đầu trích xuất

```json
{
  "type": "TRIGGER_EXTRACT",
  "endpoint": "/api/v1/co/lohang/6912cc77.../extract-tables",
  "method": "POST",
  "label": "Start Data Extraction"
}
```

**FE Action:**
```javascript
// Hiển thị nút "Tiếp tục"
<Button 
  onClick={() => {
    // Gọi API
    await fetch(nextAction.endpoint, { method: 'POST' });
    
    // Bắt đầu polling
    startPolling();
  }}
>
  {nextAction.label}
</Button>
```

---

### 3. **WAIT** - Đang xử lý (Polling)

```json
{
  "type": "WAIT",
  "label": "Extracting Data...",
  "polling": true,
  "pollingInterval": 5000
}
```

**FE Action:**
```javascript
// Hiển thị loading và polling
const [isPolling, setIsPolling] = useState(false);

useEffect(() => {
  if (workflow.nextAction?.type === 'WAIT' && workflow.nextAction?.polling) {
    setIsPolling(true);
    
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/co/lohang/${id}`);
      const data = await response.json();
      
      // Kiểm tra đã xong chưa
      if (data.workflow.nextAction?.type !== 'WAIT') {
        clearInterval(interval);
        setIsPolling(false);
        // Chuyển sang bước tiếp theo
      }
    }, workflow.nextAction.pollingInterval);
    
    return () => clearInterval(interval);
  }
}, [workflow]);

// UI
{isPolling && (
  <div>
    <Spinner />
    <p>{workflow.nextAction.label}</p>
    <p>{workflow.message}</p>
  </div>
)}
```

---

### 4. **RETRY_EXTRACTION** - Retry khi lỗi

```json
{
  "type": "RETRY_EXTRACTION",
  "endpoint": "/api/v1/co/lohang/6912cc77.../retry-extraction",
  "method": "POST",
  "label": "Retry Extraction"
}
```

**FE Action:**
```javascript
// Hiển thị lỗi và nút retry
{workflow.status === 'EXTRACTION_FAILED' && (
  <Alert type="error">
    <h3>Extraction Failed</h3>
    <ul>
      {lohangDraft.extractionErrors.map(err => (
        <li key={err.step}>
          <strong>{err.step}:</strong> {err.error}
        </li>
      ))}
    </ul>
    <Button onClick={handleRetry}>
      {workflow.nextAction.label}
    </Button>
  </Alert>
)}
```

---

### 5. **REVIEW_TABLES** - Xem bảng tổng hợp

```json
{
  "type": "REVIEW_TABLES",
  "endpoint": "/api/v1/co/lohang/6912cc77.../tables",
  "method": "GET",
  "label": "Review Extracted Tables"
}
```

**FE Action:**
```javascript
// Redirect đến trang review tables
<Button onClick={() => navigate(`/co/${id}/tables`)}>
  {nextAction.label}
</Button>
```

---

### 6. **CONFIRM_DATA** - Xác nhận dữ liệu

```json
{
  "type": "CONFIRM_DATA",
  "endpoint": "/api/v1/co/lohang/6912cc77.../tables/confirm",
  "method": "PUT",
  "label": "Confirm All Tables"
}
```

---

### 7. **CALCULATE** - Tính toán phân bổ

```json
{
  "type": "CALCULATE",
  "endpoint": "/api/v1/co/calculate/6912cc77...",
  "method": "POST",
  "label": "Calculate Allocation"
}
```

---

## PREVENT SPAM - QUAN TRỌNG!

### ❌ **Không được phép:**

1. **Bấm "Tiếp tục" nhiều lần** khi đang extract
2. **Gọi API extract** khi `inProgress === true`
3. **Bỏ qua bước** (VD: chưa setup form mà đã extract)

### ✅ **BE đã xử lý:**

```javascript
// BE sẽ trả về lỗi nếu:
if (lohangDraft.workflowSteps?.step3_extractData?.inProgress) {
  throw new Error('Đang trích xuất dữ liệu, vui lòng đợi');
  // HTTP 429 - Too Many Requests
}

if (lohangDraft.currentStep < 3) {
  throw new Error('Chưa hoàn thành bước 2: Chọn Form và Tiêu chí');
  // HTTP 400 - Bad Request
}
```

### ✅ **FE cần làm:**

```javascript
// Disable button khi đang xử lý
<Button 
  disabled={
    workflow.nextAction?.type === 'WAIT' ||
    !workflow.canProceed
  }
  onClick={handleContinue}
>
  {workflow.nextAction?.label || 'Continue'}
</Button>

// Hiển thị message
{workflow.message && (
  <Alert type="info">{workflow.message}</Alert>
)}
```

---

## SMART NAVIGATION

### Khi user vào lại bản nháp:

```javascript
// 1. Gọi API lấy detail
const response = await fetch(`/api/v1/co/lohang/${id}`);
const { lohangDraft, workflow } = response.data;

// 2. Xác định màn hình hiển thị
switch (workflow.currentStep) {
  case 2:
    // Hiển thị form chọn Form & Criteria
    // (Bước 1 đã skip hoặc đã hoàn thành)
    navigate(`/co/${id}/setup`);
    break;
    
  case 3:
    if (workflow.nextAction?.type === 'WAIT') {
      // Đang extract → Hiển thị loading + polling
      navigate(`/co/${id}/extracting`);
    } else if (workflow.nextAction?.type === 'TRIGGER_EXTRACT') {
      // Chưa extract → Hiển thị nút "Tiếp tục"
      navigate(`/co/${id}/ready-to-extract`);
    }
    break;
    
  case 4:
    // Hiển thị bảng tổng hợp để review
    navigate(`/co/${id}/tables`);
    break;
    
  case 5:
    // Hiển thị nút confirm
    navigate(`/co/${id}/confirm`);
    break;
    
  case 6:
    if (workflow.nextAction?.type === 'WAIT') {
      // Đang calculate → Hiển thị loading
      navigate(`/co/${id}/calculating`);
    } else {
      // Hiển thị nút calculate
      navigate(`/co/${id}/ready-to-calculate`);
    }
    break;
    
  case 7:
    // Hiển thị kết quả
    navigate(`/co/${id}/results`);
    break;
    
  case 8:
    // Hiển thị nút export
    navigate(`/co/${id}/export`);
    break;
}
```

---

## COMPONENT EXAMPLE

```javascript
// WorkflowStepper.jsx
function WorkflowStepper({ workflow }) {
  return (
    <div className="workflow-stepper">
      {workflow.steps.map(step => (
        <div 
          key={step.step}
          className={`
            step 
            ${step.completed ? 'completed' : ''}
            ${step.step === workflow.currentStep ? 'active' : ''}
            ${step.inProgress ? 'in-progress' : ''}
          `}
        >
          <div className="step-number">{step.step}</div>
          <div className="step-name">{step.name}</div>
          {step.completed && (
            <div className="step-time">
              {formatDate(step.completedAt)}
            </div>
          )}
          {step.inProgress && (
            <Spinner size="small" />
          )}
        </div>
      ))}
    </div>
  );
}

// ContinueButton.jsx
function ContinueButton({ workflow, onContinue }) {
  const { nextAction, canProceed, message } = workflow;
  
  if (!nextAction) return null;
  
  if (nextAction.type === 'WAIT') {
    return (
      <div className="waiting-state">
        <Spinner />
        <p>{nextAction.label}</p>
        {message && <p className="message">{message}</p>}
      </div>
    );
  }
  
  return (
    <div>
      {message && <Alert type="info">{message}</Alert>}
      <Button
        disabled={!canProceed}
        onClick={onContinue}
      >
        {nextAction.label}
      </Button>
    </div>
  );
}
```

---

## ERROR HANDLING

### 1. **Extraction Failed**

```javascript
if (workflow.status === 'EXTRACTION_FAILED') {
  return (
    <Alert type="error">
      <h3>Data Extraction Failed</h3>
      <p>The following errors occurred:</p>
      <ul>
        {lohangDraft.extractionErrors.map(err => (
          <li key={err.step}>
            <strong>{getStepName(err.step)}:</strong> {err.error}
            <Button 
              size="small" 
              onClick={() => showErrorDetails(err)}
            >
              View Details
            </Button>
          </li>
        ))}
      </ul>
      <div className="actions">
        <Button onClick={handleRetry}>
          {workflow.nextAction.label}
        </Button>
        <Button 
          variant="secondary" 
          onClick={() => navigate(`/co/${id}/re-extract`)}
        >
          Re-extract Specific Table
        </Button>
      </div>
    </Alert>
  );
}
```

### 2. **Step Validation Error**

```javascript
try {
  await fetch(nextAction.endpoint, { method: nextAction.method });
} catch (error) {
  if (error.status === 400) {
    // Chưa hoàn thành bước trước
    showAlert({
      type: 'warning',
      title: 'Cannot Proceed',
      message: error.message // "Chưa hoàn thành bước 2: Chọn Form và Tiêu chí"
    });
  } else if (error.status === 429) {
    // Spam request
    showAlert({
      type: 'warning',
      title: 'Please Wait',
      message: 'Data extraction is already in progress. Please wait...'
    });
  }
}
```

---

## BEST PRACTICES

### ✅ **DO:**

1. **Luôn check `canProceed`** trước khi cho phép user action
2. **Implement polling** khi `nextAction.polling === true`
3. **Disable buttons** khi `inProgress === true`
4. **Hiển thị progress** bằng workflow stepper
5. **Handle errors** từ BE một cách rõ ràng
6. **Smart navigation** dựa vào `currentStep`

### ❌ **DON'T:**

1. **Không skip validation** từ BE
2. **Không cho phép spam** API calls
3. **Không hard-code** step logic
4. **Không ignore** `workflow.message`
5. **Không quên** clear polling interval

---

## SUMMARY

- ✅ BE trả về đầy đủ `workflow` object
- ✅ FE chỉ cần follow `nextAction`
- ✅ Prevent spam với `inProgress` flag
- ✅ Smart navigation với `currentStep`
- ✅ Clear error messages
- ✅ Polling cho async operations

**Kết quả:** UX mượt mà, không bị spam Gemini API, user luôn biết đang ở đâu! 🚀
