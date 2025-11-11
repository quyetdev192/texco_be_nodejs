# QUICK START GUIDE - FE TEAM

## 🎯 TÓM TẮT

**Hệ thống có 3 cách để chuyển bước:**

1. **API Continue** - Chuyển bước đơn giản (Bước 1 → 2)
2. **API Setup + Extract** - Chuyển bước + Bắt đầu extract (Bước 2 → 3)
3. **Auto-Navigation** - FE tự động navigate dựa vào `currentStep`

---

## 📋 3 API CHÍNH

### **1. Continue (Bước 1 → 2)**

```bash
POST /api/v1/co/lohang/:id/continue
```

**Khi nào dùng:** User ở bước 1, bấm "Continue"

**Response:**
```json
{
  "currentStep": 2,
  "workflow": { "nextAction": { "type": "SETUP_AND_EXTRACT" } }
}
```

---

### **2. Setup + Extract (Bước 2 → 3)**

```bash
POST /api/v1/co/lohang/:id/setup-and-extract
Body: { "formType": "FORM_E", "exchangeRate": 24500, "criterionType": "CTC" }
```

**Khi nào dùng:** User ở bước 2, điền form và bấm "Continue"

**Response:**
```json
{
  "currentStep": 3,
  "status": "DATA_EXTRACTING",
  "workflow": { "nextAction": { "type": "WAIT" } }
}
```

---

### **3. Get Detail (Lấy workflow)**

```bash
GET /api/v1/co/lohang/:id
```

**Khi nào dùng:** 
- Khi vào trang
- Khi polling
- Sau mỗi action

**Response:**
```json
{
  "lohangDraft": { "currentStep": 2, ... },
  "workflow": {
    "currentStep": 2,
    "nextAction": {
      "type": "SETUP_AND_EXTRACT",
      "endpoint": "/api/v1/co/lohang/123/setup-and-extract",
      "method": "POST",
      "label": "Continue"
    }
  }
}
```

---

## 💻 CODE MẪU

### **1. Continue Button Component**

```javascript
function ContinueButton({ lohangId, workflow, formData }) {
  const navigate = useNavigate();

  const handleClick = async () => {
    const { nextAction } = workflow;
    
    // Gọi API
    const response = await fetch(nextAction.endpoint, {
      method: nextAction.method,
      body: formData ? JSON.stringify(formData) : null
    });
    
    const result = await response.json();
    
    // Auto navigate
    autoNavigate(navigate, lohangId, result.data.workflow);
  };

  return (
    <button onClick={handleClick}>
      {workflow.nextAction?.label}
    </button>
  );
}
```

---

### **2. Auto Navigate Function**

```javascript
function autoNavigate(navigate, lohangId, workflow) {
  const routes = {
    1: `/co/${lohangId}/upload`,
    2: `/co/${lohangId}/setup`,
    3: `/co/${lohangId}/extracting`,
    4: `/co/${lohangId}/tables`
  };
  
  navigate(routes[workflow.currentStep]);
}
```

---

### **3. Polling Hook**

```javascript
function usePolling(lohangId, shouldPoll) {
  useEffect(() => {
    if (!shouldPoll) return;
    
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/co/lohang/${lohangId}`);
      const { workflow } = response.data;
      
      if (workflow.nextAction?.type !== 'WAIT') {
        clearInterval(interval);
        autoNavigate(navigate, lohangId, workflow);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [shouldPoll]);
}
```

---

## 🔄 FLOW ĐẦY ĐỦ

```javascript
// 1. Tạo C/O
const createResponse = await fetch('/api/v1/co/create', {
  method: 'POST',
  body: JSON.stringify({ bundleId: '123' })
});
// → currentStep: 1

// 2. Get detail
const detailResponse = await fetch('/api/v1/co/lohang/123');
const { workflow } = detailResponse.data;
// → nextAction.type: 'CONTINUE'

// 3. Bấm Continue (Bước 1 → 2)
const continueResponse = await fetch(workflow.nextAction.endpoint, {
  method: 'POST'
});
// → currentStep: 2
autoNavigate(navigate, '123', continueResponse.data.workflow);
// → Navigate to /co/123/setup

// 4. Điền form và Continue (Bước 2 → 3)
const setupResponse = await fetch('/api/v1/co/lohang/123/setup-and-extract', {
  method: 'POST',
  body: JSON.stringify({ formType: 'FORM_E', exchangeRate: 24500, criterionType: 'CTC' })
});
// → currentStep: 3, status: 'DATA_EXTRACTING'
autoNavigate(navigate, '123', setupResponse.data.workflow);
// → Navigate to /co/123/extracting

// 5. Polling
const interval = setInterval(async () => {
  const pollResponse = await fetch('/api/v1/co/lohang/123');
  if (pollResponse.data.workflow.nextAction?.type !== 'WAIT') {
    clearInterval(interval);
    autoNavigate(navigate, '123', pollResponse.data.workflow);
    // → Navigate to /co/123/tables
  }
}, 5000);
```

---

## 📚 TÀI LIỆU CHI TIẾT

1. **`CONTINUE_API_GUIDE.md`** - API Continue chi tiết
2. **`AUTO_NAVIGATION_GUIDE.md`** - Auto-navigation chi tiết
3. **`WORKFLOW_OPTIMIZATION_GUIDE.md`** - Setup + Extract API
4. **`WORKFLOW_GUIDE.md`** - Tổng quan workflow
5. **`API_ENDPOINTS_COMPLETE.md`** - Tất cả API endpoints

---

## ✅ CHECKLIST

- [ ] Đọc `CONTINUE_API_GUIDE.md`
- [ ] Implement `ContinueButton` component
- [ ] Implement `autoNavigate()` function
- [ ] Implement `usePolling()` hook
- [ ] Create screens: Upload, Setup, Extracting, Tables
- [ ] Test flow: 1 → 2 → 3 → 4
- [ ] Handle errors

---

## 🚀 BẮT ĐẦU

```bash
# 1. Đọc guide
cat CONTINUE_API_GUIDE.md

# 2. Test API
curl -X POST http://localhost:3000/api/v1/co/lohang/123/continue \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Implement FE
# - Copy code mẫu từ guide
# - Test từng bước
# - Deploy

# Done! 🎉
```

**Happy coding! 🚀**
