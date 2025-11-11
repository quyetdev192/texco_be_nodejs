# API CONTINUE - CHUYỂN BƯỚC TỰ ĐỘNG

## 🎯 MỤC ĐÍCH

**API Continue giúp chuyển từ Bước 1 sang Bước 2:**

- ✅ Bước 1 → Bấm Continue → Chuyển sang Bước 2 (hiển thị form)
- ✅ BE tự động cập nhật `currentStep` và `workflowSteps`
- ✅ FE chỉ cần follow `currentStep` để navigate

**Lưu ý:**
- ⚠️ API này **chỉ dùng cho Bước 1 → 2**
- ⚠️ Bước 2 → 3 dùng API `/setup-and-extract`

---

## 📋 API ENDPOINT

```http
POST /api/v1/co/lohang/:id/continue
```

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6912d97fca1eed8b2ca53e6a",
    "currentStep": 2,
    "status": "DRAFT",
    "workflow": {
      "currentStep": 2,
      "steps": [...],
      "nextAction": {
        "type": "SETUP_AND_EXTRACT",
        "endpoint": "/api/v1/co/lohang/6912d97f.../setup-and-extract",
        "method": "POST",
        "label": "Continue",
        "description": "Setup Form & Start Extraction",
        "requiredFields": ["formType", "exchangeRate", "criterionType"]
      },
      "canProceed": true,
      "message": "",
      "status": "DRAFT"
    },
    "message": "Đã chuyển sang bước 2"
  }
}
```

---

## 🔄 FLOW HOÀN CHỈNH

### **Bước 1 → Bước 2**

#### **1. Tạo C/O Draft:**

```bash
POST /api/v1/co/create
{
  "bundleId": "6912a727d048c7387f9e7ad8"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lohangDraft": {
      "_id": "6912d97fca1eed8b2ca53e6a",
      "currentStep": 1,
      "status": "DRAFT",
      "invoiceNo": "DRAFT-1762843007656",
      "linkedDocuments": ["...", "..."]
    }
  }
}
```

#### **2. Get Detail (để lấy workflow):**

```bash
GET /api/v1/co/lohang/6912d97fca1eed8b2ca53e6a
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lohangDraft": {
      "currentStep": 1,
      ...
    },
    "workflow": {
      "currentStep": 1,
      "nextAction": {
        "type": "CONTINUE",
        "endpoint": "/api/v1/co/lohang/6912d97f.../continue",
        "method": "POST",
        "label": "Continue",
        "description": "Continue to Step 2"
      }
    }
  }
}
```

#### **3. Bấm Continue:**

```bash
POST /api/v1/co/lohang/6912d97fca1eed8b2ca53e6a/continue
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6912d97fca1eed8b2ca53e6a",
    "currentStep": 2,
    "status": "DRAFT",
    "workflow": {
      "currentStep": 2,
      "nextAction": {
        "type": "SETUP_AND_EXTRACT",
        ...
      }
    },
    "message": "Đã chuyển sang bước 2"
  }
}
```

#### **4. FE Auto-Navigate:**

```javascript
const response = await fetch('/api/v1/co/lohang/123/continue', {
  method: 'POST'
});

const { data } = await response.json();

console.log('Current step:', data.currentStep); // 2

// Auto navigate
autoNavigate(navigate, id, data.workflow);
// → Navigate to /co/123/setup
```

---

### **Bước 2 → Bước 3**

#### **1. Ở Bước 2 (Setup Form):**

User có thể:
- **Option A:** Giữ nguyên default values (FORM_E, 24500, CTC)
- **Option B:** Sửa lại form values

#### **2. Bấm Continue (với form data):**

```bash
POST /api/v1/co/lohang/6912d97fca1eed8b2ca53e6a/setup-and-extract
{
  "formType": "FORM_E",
  "exchangeRate": 24500,
  "criterionType": "CTC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6912d97fca1eed8b2ca53e6a",
    "formType": "FORM_E",
    "exchangeRate": 24500,
    "criterionType": "CTC",
    "status": "DATA_EXTRACTING",
    "currentStep": 3,
    "message": "Đã setup form và bắt đầu trích xuất dữ liệu"
  }
}
```

#### **3. FE Auto-Navigate + Polling:**

```javascript
const response = await fetch('/api/v1/co/lohang/123/setup-and-extract', {
  method: 'POST',
  body: JSON.stringify(formData)
});

const { data } = await response.json();

console.log('Current step:', data.currentStep); // 3

// Auto navigate to extracting screen
navigate(`/co/${id}/extracting`);

// Start polling
startPolling();
```

---

## 💻 FRONTEND IMPLEMENTATION

### **1. Component: ContinueButton**

```javascript
// components/ContinueButton.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { autoNavigate } from '../utils/navigation';

function ContinueButton({ lohangId, workflow, formData = null }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      const { nextAction } = workflow;
      
      if (!nextAction) {
        alert('Không có action tiếp theo');
        return;
      }

      let response;

      if (nextAction.type === 'CONTINUE') {
        // Bước 1 → Bước 2: Chỉ cần POST
        response = await fetch(nextAction.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          }
        });
      } else if (nextAction.type === 'SETUP_AND_EXTRACT') {
        // Bước 2 → Bước 3: Cần gửi form data
        if (!formData) {
          alert('Vui lòng điền form');
          return;
        }

        response = await fetch(nextAction.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify(formData)
        });
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Continue success:', result.data);
        
        // Auto navigate dựa vào currentStep
        autoNavigate(navigate, lohangId, result.data.workflow);

        // Nếu cần polling
        if (result.data.workflow?.nextAction?.type === 'WAIT') {
          startPolling();
        }
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Continue error:', error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleContinue}
      disabled={isLoading || !workflow.canProceed}
      className="btn-continue"
    >
      {isLoading ? 'Processing...' : workflow.nextAction?.label || 'Continue'}
    </button>
  );
}

export default ContinueButton;
```

---

### **2. Screen: Step1 (Upload Documents)**

```javascript
// screens/Step1Screen.jsx
function Step1Screen() {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const response = await fetch(`/api/v1/co/lohang/${id}`);
    const { data } = await response.json();
    
    setWorkflow(data.workflow);
    setDocuments(data.lohangDraft.linkedDocuments);
  };

  return (
    <div className="step1-screen">
      <h2>Step 1: Upload Documents</h2>
      
      {/* Danh sách documents */}
      <div className="documents-list">
        <h3>Documents ({documents.length})</h3>
        {documents.map(doc => (
          <div key={doc._id} className="document-item">
            <span>{doc.fileName}</span>
            <span>{doc.documentType}</span>
          </div>
        ))}
      </div>

      {/* Upload thêm (optional) */}
      <div className="upload-section">
        <button className="btn-upload">
          Upload More Documents (Optional)
        </button>
      </div>

      {/* Continue Button */}
      {workflow && (
        <ContinueButton 
          lohangId={id} 
          workflow={workflow} 
        />
      )}
    </div>
  );
}
```

---

### **3. Screen: Step2 (Setup Form)**

```javascript
// screens/Step2Screen.jsx
function Step2Screen() {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState(null);
  const [formData, setFormData] = useState({
    formType: 'FORM_E',
    exchangeRate: 24500,
    criterionType: 'CTC'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const response = await fetch(`/api/v1/co/lohang/${id}`);
    const { data } = await response.json();
    
    setWorkflow(data.workflow);
    
    // Load existing values
    setFormData({
      formType: data.lohangDraft.formType || 'FORM_E',
      exchangeRate: data.lohangDraft.exchangeRate || 24500,
      criterionType: data.lohangDraft.criterionType || 'CTC'
    });
  };

  return (
    <div className="step2-screen">
      <h2>Step 2: Setup Form & Criteria</h2>
      
      {/* Form */}
      <div className="form-section">
        <div className="form-group">
          <label>Form Type:</label>
          <select 
            value={formData.formType}
            onChange={(e) => setFormData({...formData, formType: e.target.value})}
          >
            <option value="FORM_E">Form E</option>
            <option value="FORM_B">Form B</option>
          </select>
        </div>

        <div className="form-group">
          <label>Exchange Rate:</label>
          <input 
            type="number"
            value={formData.exchangeRate}
            onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Criterion Type:</label>
          <select 
            value={formData.criterionType}
            onChange={(e) => setFormData({...formData, criterionType: e.target.value})}
          >
            <option value="CTC">CTC</option>
            <option value="CTSH">CTSH</option>
            <option value="RVC40">RVC 40%</option>
            <option value="RVC45">RVC 45%</option>
          </select>
        </div>
      </div>

      {/* Continue Button */}
      {workflow && (
        <ContinueButton 
          lohangId={id} 
          workflow={workflow}
          formData={formData}
        />
      )}
    </div>
  );
}
```

---

### **4. Auto-Navigation Utility**

```javascript
// utils/navigation.js
export function autoNavigate(navigate, lohangId, workflow) {
  const { currentStep, nextAction } = workflow;
  
  // Map step to route
  const routes = {
    1: `/co/${lohangId}/upload`,
    2: `/co/${lohangId}/setup`,
    3: `/co/${lohangId}/extracting`,
    4: `/co/${lohangId}/tables`,
    5: `/co/${lohangId}/confirm`,
    6: `/co/${lohangId}/calculating`,
    7: `/co/${lohangId}/results`,
    8: `/co/${lohangId}/export`
  };

  // Check nếu đang async
  if (nextAction?.type === 'WAIT') {
    if (currentStep === 3) {
      navigate(`/co/${lohangId}/extracting`);
      return;
    }
    if (currentStep === 6) {
      navigate(`/co/${lohangId}/calculating`);
      return;
    }
  }

  // Navigate to step route
  const route = routes[currentStep];
  if (route) {
    navigate(route);
  }
}
```

---

## 📊 WORKFLOW STATES

### **State 1: Bước 1**

```json
{
  "currentStep": 1,
  "nextAction": {
    "type": "CONTINUE",
    "endpoint": "/api/v1/co/lohang/123/continue",
    "method": "POST",
    "label": "Continue"
  }
}
```

**FE Action:** Hiển thị nút "Continue"

---

### **State 2: Bước 2**

```json
{
  "currentStep": 2,
  "nextAction": {
    "type": "SETUP_AND_EXTRACT",
    "endpoint": "/api/v1/co/lohang/123/setup-and-extract",
    "method": "POST",
    "label": "Continue",
    "requiredFields": ["formType", "exchangeRate", "criterionType"]
  }
}
```

**FE Action:** Hiển thị form + nút "Continue"

---

### **State 3: Bước 3 (Extracting)**

```json
{
  "currentStep": 3,
  "nextAction": {
    "type": "WAIT",
    "label": "Extracting Data...",
    "polling": true,
    "pollingInterval": 5000
  }
}
```

**FE Action:** Hiển thị loading + polling

---

## ✅ CHECKLIST CHO FE

- [ ] Implement `ContinueButton` component
- [ ] Handle `nextAction.type === 'CONTINUE'`
- [ ] Handle `nextAction.type === 'SETUP_AND_EXTRACT'`
- [ ] Implement `autoNavigate()` utility
- [ ] Create screens cho từng step
- [ ] Test flow: Step 1 → 2 → 3
- [ ] Handle errors (400, 429)
- [ ] Implement polling cho step 3

---

## 🚀 KẾT QUẢ

**User Experience:**
```
Tạo C/O → Bước 1 (Upload)
  ↓
Bấm "Continue" → Tự động sang Bước 2 (Setup) ✨
  ↓
Điền form → Bấm "Continue" → Tự động sang Bước 3 (Extracting) ✨
  ↓
Polling... → Extract xong → Tự động sang Bước 4 (Review) ✨
```

**Developer Experience:**
```javascript
// Chỉ cần 2 dòng
const response = await fetch(workflow.nextAction.endpoint, { method: 'POST' });
autoNavigate(navigate, id, response.data.workflow);
```

**Mượt mà, tự động, không cần suy nghĩ! 🎉**
