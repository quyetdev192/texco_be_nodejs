# AUTO-NAVIGATION GUIDE - TỰ ĐỘNG CHUYỂN BƯỚC

## 🎯 MỤC TIÊU

**FE không cần hard-code navigation, chỉ cần follow `currentStep` từ BE:**

```javascript
// ❌ KHÔNG CẦN LÀM THẾ NÀY
if (action === 'setup') {
  navigate('/setup');
} else if (action === 'extract') {
  navigate('/extract');
}

// ✅ CHỈ CẦN LÀM THẾ NÀY
const route = getRouteByStep(response.data.currentStep);
navigate(route);
```

---

## 📋 STEP → ROUTE MAPPING

| currentStep | Route | UI Screen | Action |
|-------------|-------|-----------|--------|
| 1 | `/co/:id/upload` | Upload documents | Upload file |
| 2 | `/co/:id/setup` | Setup form | Điền form + Continue |
| 3 | `/co/:id/extracting` | Extracting... | Polling + Loading |
| 4 | `/co/:id/tables` | Review tables | Review + Edit |
| 5 | `/co/:id/confirm` | Confirm data | Confirm button |
| 6 | `/co/:id/calculating` | Calculating... | Polling + Loading |
| 7 | `/co/:id/results` | Review results | Review allocation |
| 8 | `/co/:id/export` | Export C/O | Export button |

---

## 💡 HELPER FUNCTION

### **utils/navigation.js**

```javascript
/**
 * Map currentStep to route
 */
export function getRouteByStep(lohangId, currentStep, workflow) {
  const baseRoute = `/co/${lohangId}`;
  
  // Check nếu đang có async operation
  if (workflow?.nextAction?.type === 'WAIT') {
    if (currentStep === 3) return `${baseRoute}/extracting`;
    if (currentStep === 6) return `${baseRoute}/calculating`;
  }
  
  // Map step to route
  const stepRoutes = {
    1: `${baseRoute}/upload`,
    2: `${baseRoute}/setup`,
    3: `${baseRoute}/extracting`,
    4: `${baseRoute}/tables`,
    5: `${baseRoute}/confirm`,
    6: `${baseRoute}/calculating`,
    7: `${baseRoute}/results`,
    8: `${baseRoute}/export`
  };
  
  return stepRoutes[currentStep] || baseRoute;
}

/**
 * Auto navigate based on workflow
 */
export function autoNavigate(navigate, lohangId, workflow) {
  const route = getRouteByStep(lohangId, workflow.currentStep, workflow);
  navigate(route);
}
```

---

## 🔄 FLOW TỰ ĐỘNG

### **Bước 1 → Bước 2:**

```javascript
// User ở bước 1, bấm "Tiếp tục"
const handleContinue = async () => {
  // Gọi API (có thể là upload, hoặc skip upload)
  const response = await fetch(`/api/v1/co/lohang/${id}/continue`, {
    method: 'POST'
  });
  
  const { data, workflow } = response;
  
  console.log('Current step:', workflow.currentStep); // 2
  
  // ✅ Tự động chuyển sang bước 2
  autoNavigate(navigate, id, workflow);
  // → Navigate to /co/123/setup
};
```

---

### **Bước 2 → Bước 3:**

```javascript
// User ở bước 2, điền form và bấm "Tiếp tục"
const handleSetupAndExtract = async (formData) => {
  const response = await fetch(`/api/v1/co/lohang/${id}/setup-and-extract`, {
    method: 'POST',
    body: JSON.stringify(formData)
  });
  
  const { data, workflow } = response;
  
  console.log('Current step:', workflow.currentStep); // 3
  console.log('Next action:', workflow.nextAction.type); // 'WAIT'
  
  // ✅ Tự động chuyển sang bước 3 (extracting)
  autoNavigate(navigate, id, workflow);
  // → Navigate to /co/123/extracting
  
  // Bắt đầu polling
  startPolling();
};
```

---

### **Bước 3 → Bước 4 (Sau khi extract xong):**

```javascript
// Polling để check status
const startPolling = () => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/v1/co/lohang/${id}`);
    const { workflow } = response.data;
    
    console.log('Current step:', workflow.currentStep);
    console.log('Next action:', workflow.nextAction?.type);
    
    if (workflow.nextAction?.type !== 'WAIT') {
      // Đã xong extract
      clearInterval(interval);
      
      console.log('Extract done, current step:', workflow.currentStep); // 4
      
      // ✅ Tự động chuyển sang bước 4 (review tables)
      autoNavigate(navigate, id, workflow);
      // → Navigate to /co/123/tables
    }
  }, 5000);
};
```

---

## 🎨 COMPONENT IMPLEMENTATION

### **1. Layout Component với Auto-Navigation**

```javascript
// components/COWorkflowLayout.jsx
import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { autoNavigate, getRouteByStep } from '../utils/navigation';

function COWorkflowLayout({ children }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [workflow, setWorkflow] = useState(null);

  // Fetch workflow khi vào trang
  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  // Auto-navigate khi workflow thay đổi
  useEffect(() => {
    if (workflow) {
      const expectedRoute = getRouteByStep(id, workflow.currentStep, workflow);
      
      // Nếu đang ở sai route → Auto navigate
      if (location.pathname !== expectedRoute) {
        console.log('Auto-navigating to:', expectedRoute);
        navigate(expectedRoute, { replace: true });
      }
    }
  }, [workflow, location.pathname]);

  const fetchWorkflow = async () => {
    const response = await fetch(`/api/v1/co/lohang/${id}`);
    const { workflow: wf } = response.data;
    setWorkflow(wf);
  };

  return (
    <div className="co-workflow">
      {/* Workflow Stepper */}
      <WorkflowStepper workflow={workflow} />
      
      {/* Content */}
      <div className="workflow-content">
        {children}
      </div>
    </div>
  );
}
```

---

### **2. Continue Button với Auto-Navigation**

```javascript
// components/ContinueButton.jsx
import { autoNavigate } from '../utils/navigation';

function ContinueButton({ lohangId, workflow, onSuccess }) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    setIsSubmitting(true);
    
    try {
      const { nextAction } = workflow;
      
      // Prepare request
      let endpoint = nextAction.endpoint;
      let method = nextAction.method;
      let body = null;
      
      if (nextAction.type === 'SETUP_AND_EXTRACT') {
        // Lấy form data từ form
        const formData = getFormData();
        body = JSON.stringify(formData);
      }
      
      // Call API
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body
      });
      
      const result = await response.json();
      
      if (result.success) {
        // ✅ Tự động navigate dựa vào currentStep
        autoNavigate(navigate, lohangId, result.workflow);
        
        // Callback
        if (onSuccess) onSuccess(result);
        
        // Nếu cần polling
        if (result.workflow?.nextAction?.type === 'WAIT') {
          startPolling();
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button 
      onClick={handleContinue}
      disabled={isSubmitting || !workflow.canProceed}
    >
      {isSubmitting ? 'Processing...' : workflow.nextAction?.label}
    </button>
  );
}
```

---

### **3. Polling Hook với Auto-Navigation**

```javascript
// hooks/usePolling.js
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { autoNavigate } from '../utils/navigation';

export function usePolling(lohangId, shouldPoll, onComplete) {
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  useEffect(() => {
    if (shouldPoll) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [shouldPoll]);

  const startPolling = () => {
    intervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/co/lohang/${lohangId}`);
        const { workflow } = response.data;

        // Check nếu đã xong
        if (workflow.nextAction?.type !== 'WAIT') {
          stopPolling();
          
          // ✅ Tự động navigate sang bước tiếp theo
          autoNavigate(navigate, lohangId, workflow);
          
          // Callback
          if (onComplete) onComplete(workflow);
        }
      } catch (error) {
        console.error('Polling error:', error);
        stopPolling();
      }
    }, 5000);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return { stopPolling };
}
```

---

## 📱 SCREEN COMPONENTS

### **Step 2: Setup Screen**

```javascript
// screens/SetupScreen.jsx
function SetupScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [formData, setFormData] = useState({
    formType: '',
    exchangeRate: '',
    criterionType: ''
  });

  useEffect(() => {
    fetchWorkflow();
  }, []);

  const fetchWorkflow = async () => {
    const response = await fetch(`/api/v1/co/lohang/${id}`);
    setWorkflow(response.data.workflow);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch(`/api/v1/co/lohang/${id}/setup-and-extract`, {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // ✅ Tự động chuyển sang bước 3
      autoNavigate(navigate, id, result.workflow);
    }
  };

  return (
    <div className="setup-screen">
      <h2>Step 2: Setup Form & Criteria</h2>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label>Form Type:</label>
          <select 
            value={formData.formType}
            onChange={(e) => setFormData({...formData, formType: e.target.value})}
          >
            <option value="">-- Select --</option>
            <option value="FORM_E">Form E</option>
            <option value="FORM_B">Form B</option>
          </select>
        </div>

        <div>
          <label>Exchange Rate:</label>
          <input 
            type="number"
            value={formData.exchangeRate}
            onChange={(e) => setFormData({...formData, exchangeRate: e.target.value})}
          />
        </div>

        <div>
          <label>Criterion Type:</label>
          <select 
            value={formData.criterionType}
            onChange={(e) => setFormData({...formData, criterionType: e.target.value})}
          >
            <option value="">-- Select --</option>
            <option value="CTC">CTC</option>
            <option value="CTSH">CTSH</option>
            <option value="RVC40">RVC 40%</option>
          </select>
        </div>

        <button type="submit">
          {workflow?.nextAction?.label || 'Continue'}
        </button>
      </form>
    </div>
  );
}
```

---

### **Step 3: Extracting Screen**

```javascript
// screens/ExtractingScreen.jsx
function ExtractingScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Auto polling
  usePolling(id, true, (workflow) => {
    console.log('Extract completed!');
    // Auto-navigate đã được xử lý trong usePolling hook
  });

  return (
    <div className="extracting-screen">
      <h2>Step 3: Extracting Data...</h2>
      <Spinner />
      <p>Please wait while we extract and analyze your documents.</p>
      <p>This may take a few minutes.</p>
    </div>
  );
}
```

---

### **Step 4: Tables Screen**

```javascript
// screens/TablesScreen.jsx
function TablesScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tables, setTables] = useState(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    const response = await fetch(`/api/v1/co/lohang/${id}/tables`);
    setTables(response.data);
  };

  const handleConfirm = async () => {
    const response = await fetch(`/api/v1/co/lohang/${id}/tables/confirm`, {
      method: 'PUT'
    });
    
    const result = await response.json();
    
    if (result.success) {
      // ✅ Tự động chuyển sang bước tiếp theo
      autoNavigate(navigate, id, result.workflow);
    }
  };

  return (
    <div className="tables-screen">
      <h2>Step 4: Review Tables</h2>
      
      {/* Product Table */}
      <ProductTable data={tables?.productTable} />
      
      {/* NPL Table */}
      <NplTable data={tables?.nplTable} />
      
      {/* BOM Table */}
      <BomTable data={tables?.bomTable} />
      
      <button onClick={handleConfirm}>
        Confirm All Tables
      </button>
    </div>
  );
}
```

---

## 🔄 COMPLETE FLOW

```javascript
// App.jsx - Routes
<Routes>
  <Route path="/co/:id" element={<COWorkflowLayout />}>
    <Route path="upload" element={<UploadScreen />} />
    <Route path="setup" element={<SetupScreen />} />
    <Route path="extracting" element={<ExtractingScreen />} />
    <Route path="tables" element={<TablesScreen />} />
    <Route path="confirm" element={<ConfirmScreen />} />
    <Route path="calculating" element={<CalculatingScreen />} />
    <Route path="results" element={<ResultsScreen />} />
    <Route path="export" element={<ExportScreen />} />
  </Route>
</Routes>

// Flow:
// 1. User vào /co/123 → Auto redirect to /co/123/setup (currentStep: 2)
// 2. User điền form → Submit → Auto navigate to /co/123/extracting (currentStep: 3)
// 3. Polling → Extract xong → Auto navigate to /co/123/tables (currentStep: 4)
// 4. User review → Confirm → Auto navigate to /co/123/confirm (currentStep: 5)
// ... và tiếp tục
```

---

## ✅ LỢI ÍCH

1. **FE không cần biết logic navigation**
   - Chỉ cần follow `currentStep`
   - BE control toàn bộ flow

2. **Dễ maintain**
   - Thay đổi flow? Chỉ cần sửa BE
   - FE tự động adapt

3. **Consistent UX**
   - User luôn ở đúng màn hình
   - Không bị lạc đường

4. **Easy debugging**
   - Check `currentStep` là biết đang ở đâu
   - Log rõ ràng

---

## 📋 CHECKLIST

- [ ] Tạo `utils/navigation.js` với `getRouteByStep()` và `autoNavigate()`
- [ ] Implement `COWorkflowLayout` với auto-navigation
- [ ] Implement `usePolling` hook
- [ ] Update tất cả screens để sử dụng `autoNavigate()`
- [ ] Test flow hoàn chỉnh
- [ ] Handle edge cases (refresh page, back button)

---

## 🚀 KẾT QUẢ

**User experience:**
```
Bước 1 → Bấm Continue → Tự động sang Bước 2 ✨
Bước 2 → Điền form + Continue → Tự động sang Bước 3 ✨
Bước 3 → Đợi extract → Tự động sang Bước 4 ✨
... mượt mà, không cần suy nghĩ!
```

**Developer experience:**
```javascript
// Chỉ cần 1 dòng
autoNavigate(navigate, lohangId, workflow);

// BE control everything!
```

**Happy coding! 🎉**
