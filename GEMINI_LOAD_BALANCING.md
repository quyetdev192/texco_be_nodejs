# Gemini API Load Balancing

## Tổng quan

Hệ thống sử dụng **Round-Robin Load Balancing** với 3 Gemini API keys để:
- ⚡ **Tăng throughput**: Phân tải request đều trên 3 keys
- 🛡️ **Tránh rate limit**: Mỗi key có quota riêng
- 🔄 **Tự động chuyển đổi**: Round-robin tự động giữa các keys

## Cấu hình

### 1. Thêm API keys vào `.env`

```bash
# Primary key (bắt buộc)
GEMINI_API_KEY=AIzaSyAtFyZ6k42V5Watiz9XKtTcxgIcC6HRhKQ

# Secondary keys (tùy chọn - cho load balancing)
GEMINI_API_KEY1=AIzaSyAToA3EBgqTahuethJEIsFKopasTx5TvxE
GEMINI_API_KEY2=AIzaSyCoOK0kJD37zYnVKd3mg9dYKT9AHMqkMAg
```

### 2. Khởi động server

```bash
npm start
```

Bạn sẽ thấy log:
```
✅ Loaded 3 Gemini API key(s) for load balancing
```

## Cách hoạt động

### Round-Robin Algorithm

```
Request 1 → API Key #1
Request 2 → API Key #2
Request 3 → API Key #3
Request 4 → API Key #1 (quay lại)
...
```

### Ví dụ log

```
🔑 detectDocumentType - Using API key #1/3
🔑 extractStructuredData - Using API key #2/3
🔑 extractWithCustomPrompt - Using API key #3/3
🔑 analyzeOriginCompliance - Using API key #1/3
```

## Lợi ích

### 1. Tăng tốc độ xử lý

| Cấu hình | Throughput | Thời gian xử lý |
|----------|------------|-----------------|
| 1 API key | ~10 req/min | Chậm |
| 3 API keys | ~30 req/min | **Nhanh hơn 3x** |

### 2. Tránh rate limit

- **Gemini Free Tier**: 60 requests/minute per key
- **1 key**: Max 60 req/min
- **3 keys**: Max 180 req/min ✅

### 3. High Availability

- Nếu 1 key bị lỗi/rate limit → 2 keys còn lại vẫn hoạt động
- Tự động chuyển sang key tiếp theo

## Monitoring

### Kiểm tra key nào đang được sử dụng

Xem log trong console:
```
🔑 Using API key #1/3
🔑 Using API key #2/3
🔑 Using API key #3/3
```

### Kiểm tra quota

Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey) để xem quota của từng key.

## Troubleshooting

### Chỉ có 1 key hoạt động

```
✅ Loaded 1 Gemini API key(s) for load balancing
```

→ Kiểm tra `.env`, đảm bảo `GEMINI_API_KEY1` và `GEMINI_API_KEY2` được set đúng.

### Rate limit vẫn xảy ra

- Kiểm tra quota của từng key
- Tăng số lượng keys (thêm `GEMINI_API_KEY3`, `GEMINI_API_KEY4`...)
- Giảm số request đồng thời

## Best Practices

1. **Sử dụng ít nhất 2 keys** cho production
2. **Monitor quota** thường xuyên
3. **Rotate keys** định kỳ để bảo mật
4. **Backup keys** trong trường hợp khẩn cấp

## Code Implementation

Xem chi tiết tại: `src/core/utils/gemini.utils.js`

```javascript
class GeminiService {
  constructor() {
    this.apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY1,
      process.env.GEMINI_API_KEY2
    ].filter(key => key);
    
    this.currentKeyIndex = 0;
  }
  
  getNextApiKey() {
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }
}
```
